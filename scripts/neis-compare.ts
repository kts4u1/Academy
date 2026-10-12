// 교육청(NEIS) 실제 교습비를 여러 지역에서 내려받아 예시 데이터와 비교 보고서를 만든다.
//
// 사용법:
//   NEIS_KEY=발급키 npm run neis:compare                       # 대표 지역 14곳
//   NEIS_KEY=발급키 npm run neis:compare -- --sido 서울          # 서울 25개 구 전부
//   NEIS_KEY=발급키 npm run neis:compare -- --regions "광주 광산구,경기 성남시 분당구"
//
// 결과:
//   docs/neis-comparison.md   사람이 읽는 비교 보고서
//   src/data/neisSnapshot.json 앱이 '교육청 실제 시세'로 보여주는 요약 통계 (학원 이름·주소 없음)

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAcademies } from '../src/data';
import { AGE_LABELS, SUBJECT_MAP } from '../src/data/categories';
import { DISTRICTS, EDU_OFFICES, filterNeisForDistrict, findDistrict, neisZoneNames, type District } from '../src/data/regions';
import { fetchAllNeisAcademies, type NeisAcademy } from '../src/lib/neis';
import { classifyRows, compareWithSample, coverage, pricedByKind, type ComparisonRow } from '../src/lib/neisCompare';
import { quantile } from '../src/lib/stats';

const DEFAULT_REGIONS = [
  '서울 강남구',
  '서울 노원구',
  '서울 관악구',
  '부산 해운대구',
  '대구 수성구',
  '인천 연수구',
  '광주 광산구',
  '광주 서구',
  '대전 서구',
  '경기 성남시 분당구',
  '경기 고양시 일산동구',
  '충북 청주시 흥덕구',
  '전남 순천시',
  '제주 제주시',
];

function parseArgs(argv: string[]) {
  const get = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return { key: get('key') ?? process.env.NEIS_KEY ?? '', sido: get('sido'), regions: get('regions'), maxRows: Number(get('max-rows') ?? 6000) };
}

function pickDistricts(args: ReturnType<typeof parseArgs>): District[] {
  if (args.sido) return DISTRICTS.filter((d) => d.sido === args.sido);
  const names = args.regions ? args.regions.split(',').map((s) => s.trim()) : DEFAULT_REGIONS;
  return names.map((name) => {
    const [sido, ...rest] = name.split(' ');
    const d = findDistrict(sido, rest.join(' '));
    if (!d) throw new Error(`지역을 찾을 수 없음: ${name}`);
    return d;
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function loadDistrict(district: District, key: string, maxRows: number) {
  const office = EDU_OFFICES.find((o) => o.sido === district.sido)!;
  const byId = new Map<string, NeisAcademy>();
  let total = 0;
  for (const zone of neisZoneNames(district)) {
    const r = await fetchAllNeisAcademies({ key, officeCode: office.code, sigungu: zone }, { maxRows });
    total += r.total;
    for (const row of r.rows) byId.set(row.id, row);
    await sleep(300);
  }
  const filtered = filterNeisForDistrict(Array.from(byId.values()), district);
  return { rows: filtered.rows, total, cityWide: filtered.cityWide, unassigned: filtered.unassigned };
}

const pct = (v: number | null) => (v === null ? '-' : `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`);
const man = (v: number) => `${(v / 10000).toFixed(1).replace(/\.0$/, '')}만`;
const label = (r: Pick<ComparisonRow, 'subjectId' | 'age'>) => `${SUBJECT_MAP[r.subjectId]?.name ?? r.subjectId}${r.age ? ` ${AGE_LABELS[r.age]}` : ' (전체)'}`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.key) {
    console.error('인증키가 필요합니다. NEIS_KEY=발급키 npm run neis:compare');
    process.exit(1);
  }
  const academies = getAcademies();
  const districts = pickDistricts(args);
  const fetchedAt = new Date().toISOString().slice(0, 10);
  const report: string[] = [];
  const snapshot: { sido: string; sigungu: string; subjectId: string; age: string | null; n: number; academies: number; p25: number; median: number; p75: number }[] = [];
  const allRows: (ComparisonRow & { district: string })[] = [];

  for (const district of districts) {
    const name = `${district.sido} ${district.sigungu}`;
    process.stdout.write(`${name} … `);
    const { rows, total, cityWide, unassigned } = await loadDistrict(district, args.key, args.maxRows);
    const items = classifyRows(rows);
    const cov = coverage(items);
    const table = compareWithSample(items, academies, { sido: district.sido, sigungu: district.sigungu }, 5);
    console.log(`학원 ${rows.length}/${total}, 과정 ${cov.total}, 비교 ${cov.comparable}, 표 ${table.length}행`);
    for (const r of table) {
      allRows.push({ ...r, district: name });
      snapshot.push({
        sido: district.sido,
        sigungu: district.sigungu,
        subjectId: r.subjectId,
        age: r.age,
        n: r.real.n,
        academies: r.realAcademies,
        p25: Math.round(r.real.p25),
        median: Math.round(r.real.median),
        p75: Math.round(r.real.p75),
      });
    }
    report.push(`### ${name}`, '');
    const kinds = pricedByKind(rows)
      .map((k) => `${k.kind} ${k.total}곳 중 교습비 공개 ${k.priced}곳`)
      .join(', ');
    report.push(
      `학원·교습소 ${rows.length.toLocaleString()}곳${cityWide ? ' (주소로 구를 가릴 수 없는 곳이 많아 시 전체 기준)' : ''}${unassigned ? ` · 구를 알 수 없어 뺀 곳 ${unassigned}` : ''} (${kinds}) · 교습비 과정 ${cov.total.toLocaleString()}개 · 비교 사용 ${cov.comparable.toLocaleString()}개 (과목 미상 ${cov.noSubject}, 특강·이상치 ${cov.excluded}, 1:1 ${cov.privateLessons})`,
      '',
    );
    if (table.length === 0) {
      report.push('비교할 표본이 부족합니다.', '');
      continue;
    }
    report.push('| 과목·대상 | 교육청 실제 중앙값 (과정 수) | 실제 중간 50% | 예시 데이터 중앙값 | 예시가 실제보다 |', '| --- | --- | --- | --- | --- |');
    for (const r of table) {
      report.push(
        `| ${label(r)} | ${man(r.real.median)} (${r.real.n}) | ${man(r.real.p25)}~${man(r.real.p75)} | ${r.sample ? `${man(r.sample.median)} (${r.sample.n}, ${r.sampleScope})` : '-'} | ${pct(r.diff)} |`,
      );
    }
    report.push('');
  }

  // 지역을 합친 과목·연령별 오차: 예시 데이터를 어느 방향으로 고쳐야 하는지
  const groups = new Map<string, number[]>();
  for (const r of allRows) {
    if (r.diff === null) continue;
    const k = `${r.subjectId}|${r.age ?? ''}`;
    groups.set(k, [...(groups.get(k) ?? []), r.diff]);
  }
  const summary = Array.from(groups.entries())
    .map(([k, diffs]) => {
      const [subjectId, age] = k.split('|');
      const sorted = [...diffs].sort((a, b) => a - b);
      return { subjectId, age: (age || null) as ComparisonRow['age'], districts: diffs.length, median: quantile(sorted, 0.5) };
    })
    .sort((a, b) => Math.abs(b.median) - Math.abs(a.median));

  const head = [
    '# 교육청 실제 교습비 vs 예시 데이터 비교',
    '',
    `- 조회일: ${fetchedAt} · 출처: 나이스 교육정보 개방 포털 학원교습소정보(acaInsTiInfo)`,
    `- 지역 ${districts.length}곳: ${districts.map((d) => `${d.sido} ${d.sigungu}`).join(', ')}`,
    '- 비교 기준: 교육청 신고 과정별 1인 교습비(1:1·특강·재료비·3만원 이하·300만원 초과 제외) 중앙값 vs 예시 데이터 월 수강료 중앙값(그룹·소수정예, 공공시설 제외)',
    '- "예시가 실제보다" +20% = 예시 데이터가 실제보다 20% 비싸게 잡혀 있음',
    '- 주의: 교육청 자료의 과정별 교습비는 주로 교습소(1인 운영 소규모)에만 채워져 있어, 실제 값은 교습소 시세에 가깝습니다',
    '',
    '## 과목·연령별 종합 (지역별 오차의 중앙값)',
    '',
    '| 과목·대상 | 비교 지역 수 | 예시가 실제보다 |',
    '| --- | --- | --- |',
    ...summary.map((s) => `| ${label(s)} | ${s.districts} | ${pct(s.median)} |`),
    '',
    '## 지역별 상세',
    '',
  ];

  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  writeFileSync(join(root, 'docs', 'neis-comparison.md'), [...head, ...report].join('\n'));
  writeFileSync(join(root, 'src', 'data', 'neisSnapshot.json'), JSON.stringify({ fetchedAt, rows: snapshot }, null, 1) + '\n');
  console.log(`\n보고서: docs/neis-comparison.md\n스냅샷: src/data/neisSnapshot.json (${snapshot.length}행)`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
