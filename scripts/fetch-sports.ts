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
// 개인정보가 될 수 있는 값(대표자명·대표자 전화·강사명·시설 관리자 전화)은 받자마자 버린다.
// 인증키가 없으면 아무것도 하지 않고 끝낸다. 받다가 실패하면 오류로 끝나며, 교육청 자료 배포는 막지 않는다.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = join(root, '.sports-raw');

type Row = Record<string, string>;

interface Dataset {
  id: 'courses' | 'facilities' | 'national';
  name: string;
  url: string;
  /** 남길 필드 (이 밖의 값은 버린다) */
  keep: string[];
}

const DATASETS: Dataset[] = [
  {
    id: 'courses',
    name: '스포츠강좌이용권 등록강좌 정보',
    url: 'https://apis.data.go.kr/B551014/SRVC_OD_API_FACIL_COURSE/todz_api_facil_course_i',
    keep: ['brno', 'facil_sn', 'course_no', 'item_cd', 'item_nm', 'course_nm', 'start_tm', 'equip_tm', 'lectr_weekday_val', 'course_seta_desc_cn', 'settl_amt'],
  },
  {
    id: 'facilities',
    name: '스포츠강좌이용권 등록시설 정보',
    url: 'https://apis.data.go.kr/B551014/SRVC_OD_API_FACIL_MNG/todz_api_facil_mng_i',
    keep: ['brno', 'facil_sn', 'city_cd', 'city_nm', 'local_cd', 'local_nm', 'facil_nm', 'faci_zip', 'road_addr', 'faci_daddr', 'main_event_cd', 'main_event_nm', 'facil_gbn_nm'],
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

export function sanitize(rows: Row[], keep: string[]): Row[] {
  const allow = new Set(keep);
  return rows.map((r) => {
    const out: Row = {};
    for (const [k, v] of Object.entries(r)) if (allow.has(k)) out[k] = k === 'course_seta_desc_cn' ? scrubContacts(v) : v;
    return out;
  });
}

/** 강좌 설명에 적힌 전화번호·이메일은 지운다 */
export function scrubContacts(text: string): string {
  return text
    .replace(/0\d{1,2}[-.\s)]?\d{3,4}[-.\s]?\d{4}/g, '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

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
    console.log('DATA_GO_KR_KEY 가 없어 체육 자료를 받지 않습니다.');
    return;
  }
  const fetchedAt = new Date().toISOString();
  const results: { id: string; name: string; total: number; count: number; keys: string[] }[] = [];
  const data = new Map<string, Row[]>();
  for (const ds of DATASETS) {
    console.log(`${ds.name} …`);
    const r = await fetchAll(ds, key);
    const missing = ds.keep.filter((k) => !r.keys.includes(k));
    console.log(`  ${r.rows.length.toLocaleString()} / ${r.total.toLocaleString()}건 · 필드 ${r.keys.join(', ')}`);
    if (missing.length) console.log(`  (명세에 있지만 응답에 없는 필드: ${missing.join(', ')})`);
    summarize(ds.id, r.rows);
    data.set(ds.id, sanitize(r.rows, ds.keep));
    results.push({ id: ds.id, name: ds.name, total: r.total, count: r.rows.length, keys: r.keys });
  }
  rmSync(rawDir, { recursive: true, force: true });
  mkdirSync(rawDir, { recursive: true });
  writeFileSync(join(rawDir, 'meta.json'), JSON.stringify({ fetchedAt, datasets: results }, null, 1));
  for (const [id, rows] of data) writeFileSync(join(rawDir, `${id}.json`), JSON.stringify(rows));
  console.log(`완료: ${results.map((r) => `${r.name} ${r.count.toLocaleString()}건`).join(' · ')}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(`::error::체육 자료를 받지 못했습니다: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
