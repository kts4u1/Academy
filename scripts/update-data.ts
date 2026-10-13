// 교육청(NEIS) 학원교습소정보를 전국에서 받아 앱이 읽는 정적 데이터 파일을 만든다.
// GitHub Actions 가 매주 실행한다 (.github/workflows/update-data.yml).
//
//   NEIS_KEY=발급키 npm run data:update        Open API 로 전국 17개 교육청 (매주 최신)
//   npm run data:update                       인증키가 없으면 교육청이 매달 올리는 전국 파일(CSV)
//   npm run data:update -- --source file      인증키가 있어도 전국 파일로
//   npm run data:update -- --offices B10,F10  (API) 일부 교육청만 – 개발용
//   npm run data:update -- --from-raw .neis-raw        보관해 둔 원자료로 다시 가공 (코드만 바뀌었을 때)
//   npm run data:update -- --from-raw rows.json|x.csv  원자료 JSON 배열(개발용 표본) 또는 교육청 CSV 로
//
// API 로 받다가 실패하면(인증키 오류·서버 장애·중간에 끊김) 전국 파일로 대신 만든다.
// 둘 다 실패하면 아무것도 바꾸지 않고 오류로 끝난다 → 지난번 배포가 그대로 남는다.
//
// 결과
//   .neis-raw/            교육청 원자료 (Actions 캐시에 보관했다가 코드만 바뀐 push 때 다시 가공)
//   public/data/manifest.json        갱신 시각, 출처, 지역별 학원 수, 파일 목록
//   public/data/d/{시군구코드}.json   시·군·구별 학원·교습소와 과정별 교습비
//   public/data/b/{이름 해시}.json    주소로 구를 정하지 못한 학원 (예: 성남시 · 구 미상)
//   public/data/market.json          시·군·구·시·도별 과목 × 대상 교습비 시세

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildOutput, type RawSnapshot } from '../src/data/buildData';
import { EDU_OFFICES } from '../src/data/regions';
import { fetchAllNeisAcademies, neisErrorMessage, type NeisRawRow } from '../src/lib/neis';
import { baseDateOf, csvToRawRows, decodeKorean, downloadNeisFile, findLatestNeisFile } from '../src/lib/neisFile';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'data');
const tmpDir = join(root, 'public', '.data-tmp');
const rawDir = join(root, '.neis-raw');

function parseArgs(argv: string[]) {
  const get = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const source = get('source');
  return {
    source: source === 'file' || source === 'api' ? source : undefined,
    fromRaw: get('from-raw'),
    offices: get('offices')?.split(',').map((s) => s.trim()),
  };
}

function writeJson(path: string, data: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data));
}

function groupByOffice(rows: NeisRawRow[]): RawSnapshot['offices'] {
  const by = new Map<string, NeisRawRow[]>();
  for (const r of rows) by.set(r.ATPT_OFCDC_SC_CODE, [...(by.get(r.ATPT_OFCDC_SC_CODE) ?? []), r]);
  return Array.from(by.entries(), ([code, list]) => ({ code, total: list.length, rows: list }));
}

// ───────────── 받기 ─────────────

async function fetchFromApi(key: string, only?: string[]): Promise<RawSnapshot> {
  const offices: RawSnapshot['offices'] = [];
  for (const office of EDU_OFFICES.filter((o) => !only || only.includes(o.code))) {
    process.stdout.write(`${office.office} (${office.code}) … `);
    const r = await fetchAllNeisAcademies({ key, officeCode: office.code }, { maxRows: Number.POSITIVE_INFINITY, pageDelayMs: 300 });
    // 중간 페이지가 비어 끊기거나(교육청 자료 갱신 중 등) 한 곳도 없으면 반쪽 데이터를 배포하지 않는다
    if (r.total === 0) throw new Error(`${office.office}: 학원이 0곳으로 나왔습니다.`);
    if (r.truncated || r.raw.length < r.total * 0.99) throw new Error(`${office.office}: ${r.total.toLocaleString()}곳 중 ${r.raw.length.toLocaleString()}곳만 받았습니다.`);
    offices.push({ code: office.code, total: r.total, rows: r.raw });
    console.log(`${r.raw.length.toLocaleString()} / ${r.total.toLocaleString()}건`);
  }
  return { kind: 'api', fetchedAt: new Date().toISOString(), offices };
}

async function fetchFromFile(): Promise<RawSnapshot> {
  const file = await findLatestNeisFile();
  console.log(`교육청 전국 파일: ${file.name} (기준일 ${file.baseDate})`);
  const rows = csvToRawRows(await downloadNeisFile(file.fileSeq));
  return { kind: 'file', fetchedAt: new Date().toISOString(), baseDate: file.baseDate, fileName: file.name, offices: groupByOffice(rows) };
}

/** 전국 자료가 빠짐없이 들어 있는지 (일부 교육청만 받은 개발용 실행은 제외) */
function checkComplete(snap: RawSnapshot) {
  const codes = new Set(snap.offices.filter((o) => o.rows.length > 0).map((o) => o.code));
  const missing = EDU_OFFICES.filter((o) => !codes.has(o.code));
  if (missing.length) throw new Error(`교육청 자료가 빠졌습니다: ${missing.map((o) => o.office).join(', ')}`);
}

function saveRaw(snap: RawSnapshot) {
  rmSync(rawDir, { recursive: true, force: true });
  mkdirSync(rawDir, { recursive: true });
  const { offices, ...meta } = snap;
  writeJson(join(rawDir, 'meta.json'), { ...meta, offices: offices.map((o) => ({ code: o.code, total: o.total })) });
  for (const o of offices) writeJson(join(rawDir, `rows-${o.code}.json`), o.rows);
}

function loadRaw(path: string): RawSnapshot {
  if (statSync(path).isDirectory()) {
    const meta = JSON.parse(readFileSync(join(path, 'meta.json'), 'utf8')) as Omit<RawSnapshot, 'offices'> & { offices: { code: string; total: number }[] };
    const files = new Set(readdirSync(path));
    return {
      ...meta,
      offices: meta.offices.map((o) => ({ ...o, rows: files.has(`rows-${o.code}.json`) ? (JSON.parse(readFileSync(join(path, `rows-${o.code}.json`), 'utf8')) as NeisRawRow[]) : [] })),
    };
  }
  if (path.toLowerCase().endsWith('.csv')) {
    const rows = csvToRawRows(decodeKorean(new Uint8Array(readFileSync(path))));
    // 파일 이름에 기준일이 있으면 쓴다: 학원교습소정보_2026년09월30일기준.csv, academies-2026-09-30.csv
    const name = basename(path);
    const iso = name.match(/(\d{4})-(\d{2})-(\d{2})/);
    const baseDate = baseDateOf(name) ?? (iso ? iso[0] : undefined);
    return { kind: 'file', fetchedAt: statSync(path).mtime.toISOString(), ...(baseDate ? { baseDate } : {}), fileName: name, offices: groupByOffice(rows) };
  }
  // 개발용 표본: 원자료 JSON 배열
  const rows = JSON.parse(readFileSync(path, 'utf8')) as NeisRawRow[];
  return { kind: 'sample', fetchedAt: new Date().toISOString(), offices: groupByOffice(rows) };
}

function writeOutput(files: Map<string, unknown>) {
  rmSync(tmpDir, { recursive: true, force: true });
  for (const [file, data] of files) writeJson(join(tmpDir, file), data);
  // 다 만든 뒤에 한 번에 바꿔 끼운다
  if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
  renameSync(tmpDir, outDir);
}

// ───────────── 실행 ─────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const key = process.env.NEIS_KEY?.trim() ?? '';
  let snap: RawSnapshot;

  if (args.fromRaw) {
    snap = loadRaw(args.fromRaw);
    console.log(`원자료 ${snap.offices.reduce((s, o) => s + o.rows.length, 0).toLocaleString()}건을 읽었습니다 (${snap.kind}).`);
  } else {
    snap = await (async () => {
      if (key && args.source !== 'file') {
        try {
          const s = await fetchFromApi(key, args.offices);
          if (!args.offices) checkComplete(s);
          return s;
        } catch (err) {
          const message = neisErrorMessage(err) === '알 수 없는 오류가 발생했습니다.' && err instanceof Error ? err.message : neisErrorMessage(err);
          // GitHub Actions 화면에 경고로 보이게 한다
          console.log(`\n::warning::교육청 Open API 로 받지 못해 전국 파일로 대신 만듭니다: ${message}`);
          if (args.source === 'api' || args.offices) throw err;
        }
      } else if (!key) {
        console.log('NEIS_KEY 가 없어 교육청이 매달 올리는 전국 파일을 씁니다. (매주 최신 자료는 인증키를 GitHub Secrets 의 NEIS_KEY 로 등록하세요)');
      }
      const s = await fetchFromFile();
      checkComplete(s);
      return s;
    })();
    saveRaw(snap);
  }

  const { manifest, files } = buildOutput(snap);
  writeOutput(files);
  const t = manifest.totals;
  console.log(
    `\n완료: 학원·교습소 ${t.academies.toLocaleString()}곳 (교습비 공개 ${t.priced.toLocaleString()}곳), 과정 ${t.courses.toLocaleString()}개` +
      `${t.unassigned ? `, 구 미상 ${t.unassigned.toLocaleString()}곳` : ''} · 출처 ${manifest.source}${manifest.baseDate ? ` (${manifest.baseDate} 기준)` : ''}`,
  );
}

main().catch((err) => {
  console.error(`실패: ${err instanceof Error ? err.message : err}\n기존 데이터를 그대로 둡니다.`);
  process.exit(1);
});
