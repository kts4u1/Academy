// 국민체육진흥공단 공공데이터(공공데이터포털)로 체육시설·스포츠강좌 원자료를 받는다.
// GitHub Actions 가 매주 실행한다 (.github/workflows/update-data.yml). 인증키는 저장소 비밀값 DATA_GO_KR_KEY.
//
//   DATA_GO_KR_KEY=일반인증키 npm run sports:fetch      → .sports-raw/
//
// 받는 것 (모두 '이용허락범위 제한 없음')
//   courses     스포츠강좌이용권 등록강좌 정보 (15107784): 강좌별 종목·결제금액(수강료)
//   facilities  스포츠강좌이용권 등록시설 정보 (15107783): 시설명·도로명주소·주종목 (강좌와 brno+facil_sn 으로 묶는다)
//   national    전국체육시설 정보 (15113986): 신고·등록 체육시설업과 공공체육시설 목록 (가격 없음)
//
// 개인정보가 될 수 있는 값(대표자명·대표자 전화·강사명·시설 관리자 전화·강좌 설명)은 받자마자 버리고,
// 가린 이름·전화 뒷자리가 적힌 개인 결제창 강좌는 통째로 버린다 (src/lib/privacy.ts).
// 인증키가 없으면 아무것도 하지 않고 끝낸다. 받다가 실패하면 오류로 끝나며, 교육청 자료 배포는 막지 않는다.

import { appendFileSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPersonalSlot, scrubContacts } from '../src/lib/privacy';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = join(root, '.sports-raw');
const tmpDir = join(root, '.sports-raw.tmp');

type Row = Record<string, string>;

interface Dataset {
  id: 'courses' | 'facilities' | 'national';
  name: string;
  url: string;
  /** 남길 필드 (이 밖의 값은 버린다) */
  keep: string[];
  /** 응답에 꼭 있어야 하는 필드 (없으면 API 형식이 바뀐 것으로 보고 지난 원자료를 그대로 둔다) */
  required: string[];
}

const DATASETS: Dataset[] = [
  {
    id: 'courses',
    name: '스포츠강좌이용권 등록강좌 정보',
    url: 'https://apis.data.go.kr/B551014/SRVC_OD_API_FACIL_COURSE/todz_api_facil_course_i',
    // 강좌 설명·시간·강사는 쓰지 않아 받지 않는다 (개인정보가 섞일 수 있다)
    keep: ['brno', 'facil_sn', 'item_cd', 'item_nm', 'course_nm', 'settl_amt'],
    required: ['brno', 'facil_sn', 'item_nm', 'course_nm', 'settl_amt'],
  },
  {
    id: 'facilities',
    name: '스포츠강좌이용권 등록시설 정보',
    url: 'https://apis.data.go.kr/B551014/SRVC_OD_API_FACIL_MNG/todz_api_facil_mng_i',
    keep: ['brno', 'facil_sn', 'city_cd', 'city_nm', 'local_cd', 'local_nm', 'facil_nm', 'faci_zip', 'road_addr', 'faci_daddr', 'main_event_cd', 'main_event_nm', 'facil_gbn_nm'],
    required: ['brno', 'facil_sn', 'facil_nm', 'road_addr'],
  },
  {
    id: 'national',
    name: '전국체육시설 정보',
    url: 'https://apis.data.go.kr/B551014/SRVC_API_SFMS_FACI/TODZ_API_SFMS_FACI',
    keep: [
      'faci_cd', 'faci_nm', 'faci_gb_nm', 'fcob_nm', 'ftype_nm', 'faci_stat_nm', 'faci_road_addr', 'faci_road_daddr', 'faci_addr', 'faci_daddr',
      'faci_lot', 'faci_lat', 'faci_tel_no', 'faci_homepage', 'cp_nm', 'cpb_nm', 'addr_ctpv_nm', 'addr_cpb_nm', 'addr_emd_nm', 'fmng_type_gb_nm',
      'inout_gbn_nm', 'faci_reg_ymd', 'th_ymd', 'sdwn_ymd', 'updt_dt',
    ],
    required: ['faci_cd', 'faci_nm', 'faci_stat_nm', 'fcob_nm'],
  },
];

const PAGE_SIZE = 1000; // API 한도 (한 번에 1000건까지)

/** 공공데이터포털 키는 Encoding(이미 %인코딩)·Decoding 두 모양이 있어 어느 쪽을 넣어도 되게 원래 값으로 돌린다 */
export function normalizeKey(key: string): string {
  const k = key.trim();
  if (!/%[0-9A-Fa-f]{2}/.test(k)) return k;
  try {
    return decodeURIComponent(k);
  } catch {
    return k;
  }
}

class ApiError extends Error {
  constructor(
    message: string,
    /** 다시 시도해도 소용없는 오류 (인증키·활용신청 문제 등) */
    readonly fatal = false,
  ) {
    super(message);
  }
}

const FATAL_CODES = new Set(['20', '30', '31', '32', '33', 'SERVICE_KEY_IS_NOT_REGISTERED_ERROR', 'SERVICE_ACCESS_DENIED_ERROR', 'DEADLINE_HAS_EXPIRED_ERROR', 'UNREGISTERED_IP_ERROR', 'SERVICE_KEY_IS_NULL']);

/** 응답 한 페이지 → { total, rows } . 공공데이터포털 게이트웨이 오류는 JSON 을 요청해도 XML 로 오기도 한다 */
export function parsePage(text: string): { total: number; rows: Row[] } {
  const t = text.trim();
  if (t.startsWith('<')) {
    const pick = (tag: string) => t.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1]?.trim() ?? '';
    const code = pick('returnReasonCode') || pick('resultCode');
    const msg = pick('returnAuthMsg') || pick('errMsg') || pick('resultMsg') || t.slice(0, 200);
    throw new ApiError(`API 오류 ${code}: ${msg}`, FATAL_CODES.has(code) || FATAL_CODES.has(pick('errMsg')));
  }
  let data: unknown;
  try {
    data = JSON.parse(t);
  } catch {
    throw new ApiError(`JSON 이 아닌 응답: ${t.slice(0, 200)}`);
  }
  const obj = data as Record<string, unknown>;
  const gw = (obj.OpenAPI_ServiceResponse as { cmmMsgHeader?: Record<string, string> } | undefined)?.cmmMsgHeader;
  if (gw) {
    const code = gw.returnReasonCode ?? '';
    throw new ApiError(`API 오류 ${code}: ${gw.errMsg ?? ''} ${gw.returnAuthMsg ?? ''}`.trim(), FATAL_CODES.has(code) || FATAL_CODES.has(gw.errMsg ?? ''));
  }
  const res = (obj.response ?? obj) as { header?: { resultCode?: string; resultMsg?: string }; body?: Record<string, unknown> };
  const code = String(res.header?.resultCode ?? '00');
  if (code !== '00' && code !== '0' && code !== '0000') throw new ApiError(`API 오류 ${code}: ${res.header?.resultMsg ?? ''}`, FATAL_CODES.has(code));
  const body = res.body ?? {};
  const total = Number(body.totalCount ?? 0);
  const items = body.items as { item?: unknown } | unknown[] | string | undefined;
  let list: unknown = Array.isArray(items) ? items : items && typeof items === 'object' ? (items as { item?: unknown }).item : [];
  if (list && !Array.isArray(list)) list = [list];
  const rows = ((list as unknown[]) ?? []).map((r) => {
    const out: Row = {};
    for (const [k, v] of Object.entries(r as Record<string, unknown>)) out[k] = v == null ? '' : String(v).trim();
    return out;
  });
  return { total: Number.isFinite(total) ? total : 0, rows };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(ds: Dataset, key: string, pageNo: number): Promise<{ total: number; rows: Row[] }> {
  const params = new URLSearchParams({ serviceKey: key, pageNo: String(pageNo), numOfRows: String(PAGE_SIZE), resultType: 'json' });
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const res = await fetch(`${ds.url}?${params}`, { signal: AbortSignal.timeout(90_000) });
      const text = await res.text();
      if (res.status >= 500) throw new ApiError(`HTTP ${res.status}`);
      if (res.status === 401 || res.status === 403) throw new ApiError(`HTTP ${res.status}: ${text.slice(0, 200)} (활용신청 승인과 인증키를 확인하세요)`, true);
      return parsePage(text);
    } catch (err) {
      lastErr = err;
      if (err instanceof ApiError && err.fatal) throw err;
      // 연결이 자주 끊겨서 조금씩 기다렸다가 다시 받는다
      await sleep(Math.min(30_000, 2000 * 2 ** (attempt - 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** 이름 글자에 전화번호가 적힌 경우가 있어 지운다 */
const TEXT_FIELDS = new Set(['course_nm', 'facil_nm', 'faci_nm']);

/**
 * 남길 필드만 남기고, 수강생 한 명을 위한 개인 결제창 강좌(가린 이름·전화 뒷자리)는 통째로 버린다.
 */
export function sanitize(rows: Row[], keep: string[]): Row[] {
  const allow = new Set(keep);
  return rows
    .filter((r) => !isPersonalSlot(r.course_nm ?? ''))
    .map((r) => {
      const out: Row = {};
      for (const [k, v] of Object.entries(r)) if (allow.has(k)) out[k] = TEXT_FIELDS.has(k) ? scrubContacts(v) : v;
      return out;
    });
}

export { scrubContacts };

async function fetchAll(ds: Dataset, key: string): Promise<{ total: number; rows: Row[]; keys: string[] }> {
  const first = await fetchPage(ds, key, 1);
  const keys = Array.from(new Set(first.rows.flatMap((r) => Object.keys(r)))).sort();
  const rows = [...first.rows];
  const pages = Math.ceil(first.total / PAGE_SIZE);
  for (let p = 2; p <= pages; p++) {
    const page = await fetchPage(ds, key, p);
    if (page.rows.length === 0) break;
    rows.push(...page.rows);
    if (p % 10 === 0) console.log(`  ${ds.id}: ${rows.length.toLocaleString()} / ${first.total.toLocaleString()}`);
    await sleep(150);
  }
  if (first.total > 0 && rows.length < first.total * 0.99) throw new Error(`${ds.name}: ${first.total.toLocaleString()}건 중 ${rows.length.toLocaleString()}건만 받았습니다.`);
  return { total: first.total, rows, keys };
}

// ───────────── 점검용 요약 (값이 아닌 분포만 찍는다) ─────────────

function countBy(rows: Row[], field: string, top = 40): string {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r[field] ?? '(없음)', (m.get(r[field] ?? '(없음)') ?? 0) + 1);
  return Array.from(m.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([k, n]) => `${k || '(빈값)'}:${n}`)
    .join(', ');
}

function priceSummary(rows: Row[]): string {
  const prices = rows.map((r) => Number(r.settl_amt)).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!prices.length) return '가격 없음';
  const q = (p: number) => prices[Math.min(prices.length - 1, Math.floor(p * prices.length))];
  const cap = prices.filter((n) => n === 105000).length;
  return `n=${prices.length} p10=${q(0.1)} p25=${q(0.25)} 중앙=${q(0.5)} p75=${q(0.75)} p90=${q(0.9)} 105000원=${((cap / prices.length) * 100).toFixed(1)}%`;
}

function summarize(id: Dataset['id'], rows: Row[]) {
  if (id === 'courses') {
    console.log(`  종목: ${countBy(rows, 'item_nm', 80)}`);
    console.log(`  종목코드: ${countBy(rows, 'item_cd', 80)}`);
    console.log(`  금액: ${priceSummary(rows)}`);
  } else if (id === 'facilities') {
    console.log(`  주종목: ${countBy(rows, 'main_event_nm', 60)}`);
    console.log(`  시도: ${countBy(rows, 'city_nm', 30)}`);
    for (const f of ['facil_gbn_nm']) if (rows.some((r) => f in r)) console.log(`  ${f}: ${countBy(rows, f, 20)}`);
  } else {
    console.log(`  시설구분: ${countBy(rows, 'faci_gb_nm', 20)}`);
    console.log(`  업종: ${countBy(rows, 'fcob_nm', 40)}`);
    console.log(`  시설유형: ${countBy(rows, 'ftype_nm', 80)}`);
    console.log(`  상태: ${countBy(rows, 'faci_stat_nm', 20)}`);
  }
}

// ───────────── 실행 ─────────────

async function main() {
  const key = normalizeKey(process.env.DATA_GO_KR_KEY ?? '');
  if (!key) {
    console.log('::warning::DATA_GO_KR_KEY 가 없어 체육 자료를 새로 받지 않습니다. (보관해 둔 원자료가 있으면 그것을 씁니다)');
    return;
  }
  const fetchedAt = new Date().toISOString();
  const results: { id: string; name: string; total: number; count: number; keys: string[] }[] = [];
  const data = new Map<string, Row[]>();
  const previous = previousCounts();
  for (const ds of DATASETS) {
    console.log(`${ds.name} …`);
    const r = await fetchAll(ds, key);
    checkSane(ds, r, previous.get(ds.id));
    const missing = ds.keep.filter((k) => !r.keys.includes(k));
    console.log(`  ${r.rows.length.toLocaleString()} / ${r.total.toLocaleString()}건 · 필드 ${r.keys.join(', ')}`);
    if (missing.length) console.log(`  (명세에 있지만 응답에 없는 필드: ${missing.join(', ')})`);
    summarize(ds.id, r.rows);
    data.set(ds.id, sanitize(r.rows, ds.keep));
    results.push({ id: ds.id, name: ds.name, total: r.total, count: r.rows.length, keys: r.keys });
  }
  // 임시 폴더에 다 쓴 뒤(meta.json 은 마지막) 한 번에 바꿔 끼운다 → 중간에 실패해도 지난 원자료가 남는다
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  for (const [id, rows] of data) writeFileSync(join(tmpDir, `${id}.json`), JSON.stringify(rows));
  writeFileSync(join(tmpDir, 'meta.json'), JSON.stringify({ fetchedAt, datasets: results }, null, 1));
  rmSync(rawDir, { recursive: true, force: true });
  renameSync(tmpDir, rawDir);
  markFetched();
  console.log(`완료: ${results.map((r) => `${r.name} ${r.count.toLocaleString()}건`).join(' · ')}`);
}

/** 지난번에 받은 건수 (.sports-raw/meta.json) */
function previousCounts(): Map<string, number> {
  try {
    const meta = JSON.parse(readFileSync(join(rawDir, 'meta.json'), 'utf8')) as { datasets: { id: string; count: number }[] };
    return new Map(meta.datasets.map((d) => [d.id, d.count]));
  } catch {
    return new Map();
  }
}

/**
 * 받은 자료가 멀쩡한지: 0건이거나, 꼭 있어야 할 필드가 없거나, 지난번의 절반도 안 되면 오류로 끝내서
 * 지난 원자료를 그대로 쓰게 한다.
 */
export function checkSane(ds: Pick<Dataset, 'name' | 'required'>, r: { total: number; rows: unknown[]; keys: string[] }, previous?: number): void {
  if (r.total === 0 || r.rows.length === 0) throw new Error(`${ds.name}: 0건이 왔습니다.`);
  const missing = ds.required.filter((k) => !r.keys.includes(k));
  if (missing.length) throw new Error(`${ds.name}: 꼭 있어야 할 필드가 없습니다 (${missing.join(', ')}). API 형식이 바뀌었을 수 있습니다.`);
  if (previous && r.rows.length < previous * 0.5) throw new Error(`${ds.name}: ${r.rows.length.toLocaleString()}건으로 지난번(${previous.toLocaleString()}건)의 절반도 안 됩니다.`);
}

/** GitHub Actions 에 '새로 받음'을 알린다 (보관·업로드 단계는 이때만 돈다) */
function markFetched() {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, 'fetched=true\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(`::error::체육 자료를 받지 못했습니다: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
