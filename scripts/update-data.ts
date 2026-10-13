// 교육청(NEIS) 학원교습소정보를 전국에서 내려받아 앱이 읽는 정적 데이터 파일을 만든다.
// GitHub Actions 가 매주 실행한다 (.github/workflows/update-data.yml).
//
//   NEIS_KEY=발급키 npm run data:update              전국 17개 교육청
//   NEIS_KEY=발급키 npm run data:update -- --offices B10,F10   일부 교육청만
//   npm run data:update -- --sample                  인증키 없이 교육청별 5건 (동작 확인용)
//   npm run data:update -- --from-raw rows.json      저장해 둔 교육청 원자료(JSON 배열)로 만들기 (개발용 표본)
//
// 결과 (public/data/):
//   manifest.json        갱신 시각, 지역별 학원 수, 파일 목록
//   d/{시군구코드}.json   시·군·구별 학원·교습소와 과정별 교습비
//   b/{번호}.json         주소로 구를 정하지 못한 학원 (예: 성남시 · 구 미상)
//   market.json          시·군·구·시·도별 과목×연령 교습비 시세
//
// 한 교육청이라도 받다가 실패하면 기존 데이터를 그대로 두고 오류로 끝낸다.

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DISTRICTS, EDU_OFFICES } from '../src/data/regions';
import { fetchAllNeisAcademies, neisErrorMessage, toNeisAcademy, type NeisRawRow } from '../src/lib/neis';
import { buildMarket, toRealAcademy, type RealAcademy } from '../src/lib/realData';
import type { DataManifest } from '../src/data/manifest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'data');
const tmpDir = join(root, 'public', '.data-tmp');

function parseArgs(argv: string[]) {
  const get = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return { sample: argv.includes('--sample'), fromRaw: get('from-raw'), offices: get('offices')?.split(',').map((s) => s.trim()) };
}

function writeJson(path: string, data: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const key = process.env.NEIS_KEY?.trim() ?? '';
  if (!key && !args.sample && !args.fromRaw) {
    console.log('NEIS_KEY 가 없어 교육청 데이터를 받지 않았습니다. (기존 데이터 유지)');
    console.log('GitHub: 저장소 Settings → Secrets and variables → Actions → New repository secret → 이름 NEIS_KEY');
    return;
  }

  const offices = EDU_OFFICES.filter((o) => !args.offices || args.offices.includes(o.code));
  const academies: RealAcademy[] = [];
  const officeStats: DataManifest['offices'] = [];
  let skippedClosed = 0;

  if (args.fromRaw) {
    const raw = JSON.parse(readFileSync(args.fromRaw, 'utf8')) as NeisRawRow[];
    const byId = new Map(raw.map((r) => [`${r.ATPT_OFCDC_SC_CODE}-${r.ACA_ASNUM}`, r]));
    for (const r of byId.values()) {
      const office = EDU_OFFICES.find((o) => o.code === r.ATPT_OFCDC_SC_CODE);
      const row = toNeisAcademy(r);
      if (!office || (row.status && row.status !== '개원')) continue;
      academies.push(toRealAcademy(row, office.sido));
    }
    console.log(`원자료 ${byId.size.toLocaleString()}곳을 읽었습니다.`);
  }

  for (const office of args.fromRaw ? [] : offices) {
    process.stdout.write(`${office.office} (${office.code}) … `);
    try {
      const r = await fetchAllNeisAcademies(
        { key: args.sample ? undefined : key, officeCode: office.code },
        { maxRows: Number.POSITIVE_INFINITY, pageDelayMs: 300 },
      );
      let kept = 0;
      for (const row of r.rows) {
        if (row.status && row.status !== '개원') {
          skippedClosed++;
          continue;
        }
        academies.push(toRealAcademy(row, office.sido));
        kept++;
      }
      officeStats.push({ code: office.code, sido: office.sido, total: r.total, fetched: r.rows.length, kept });
      console.log(`${r.rows.length.toLocaleString()} / ${r.total.toLocaleString()}건`);
    } catch (err) {
      console.error(`\n실패: ${neisErrorMessage(err)}\n기존 데이터를 그대로 둡니다.`);
      process.exit(1);
    }
  }

  // 시·군·구별로 나누기
  rmSync(tmpDir, { recursive: true, force: true });
  const byDistrict = new Map<string, RealAcademy[]>();
  const byBucket = new Map<string, RealAcademy[]>();
  for (const a of academies) {
    const k = `${a.sido}|${a.sigungu}`;
    const map = a.unassigned ? byBucket : byDistrict;
    map.set(k, [...(map.get(k) ?? []), a]);
  }
  const sortAcademies = (list: RealAcademy[]) => list.sort((x, y) => x.name.localeCompare(y.name, 'ko'));
  const priced = (list: RealAcademy[]) => list.filter((a) => a.courses.length > 0).length;

  const districts: DataManifest['districts'] = DISTRICTS.map((d) => {
    const list = sortAcademies(byDistrict.get(`${d.sido}|${d.sigungu}`) ?? []);
    const file = `d/${d.code}.json`;
    if (list.length) writeJson(join(tmpDir, file), list);
    return { sido: d.sido, sigungu: d.sigungu, code: d.code, file: list.length ? file : null, academies: list.length, priced: priced(list) };
  });
  const buckets: DataManifest['buckets'] = Array.from(byBucket.entries()).map(([k, list], i) => {
    const [sido, name] = k.split('|');
    const file = `b/${i}.json`;
    writeJson(join(tmpDir, file), sortAcademies(list));
    return { sido, name, file, academies: list.length, priced: priced(list) };
  });

  const market = buildMarket(academies);
  const updatedAt = new Date().toISOString();
  writeJson(join(tmpDir, 'market.json'), { updatedAt, rows: market });
  const manifest: DataManifest = {
    version: 1,
    updatedAt,
    sampleMode: args.sample || Boolean(args.fromRaw),
    source: '나이스 교육정보 개방 포털 학원교습소정보(acaInsTiInfo)',
    totals: {
      academies: academies.length,
      priced: priced(academies),
      courses: academies.reduce((s, a) => s + a.courses.length, 0),
      unassigned: buckets.reduce((s, b) => s + b.academies, 0),
      skippedClosed,
    },
    offices: officeStats,
    districts,
    buckets,
  };
  writeJson(join(tmpDir, 'manifest.json'), manifest);

  // 다 만든 뒤에 한 번에 바꿔 끼운다
  if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
  renameSync(tmpDir, outDir);
  console.log(
    `\n완료: 학원·교습소 ${manifest.totals.academies.toLocaleString()}곳 (교습비 공개 ${manifest.totals.priced.toLocaleString()}곳), 과정 ${manifest.totals.courses.toLocaleString()}개, 시세 ${market.length.toLocaleString()}행` +
      `${manifest.totals.unassigned ? `, 구 미상 ${manifest.totals.unassigned.toLocaleString()}곳` : ''}${manifest.sampleMode ? ' [표본]' : ''}`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
