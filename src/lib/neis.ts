// 나이스 교육정보 개방 포털 – 학원교습소정보 API 연동
// https://open.neis.go.kr  (서비스: acaInsTiInfo)
//
// 교육청에 등록된 학원·교습소의 "인당 수강료(교습비)"를 실제로 조회할 수 있다.
// 인증키 없이 호출하면 샘플로 최대 5건만 내려오므로, 전체 조회는 무료 인증키가 필요하다.
// CORS 가 허용되어 있어 브라우저에서 바로 호출할 수 있다.
//
// 참고: 수영장·태권도장·복싱장 같은 체육시설은 학원법이 아니라 체육시설법 대상이라
// 이 API 에는 나오지 않는다. (예능 분야의 음악·미술·무용 학원은 포함)

export const NEIS_ENDPOINT = 'https://open.neis.go.kr/hub/acaInsTiInfo';

/** 교육청 분류상 분야(REALM_SC_NM) 값 */
export const NEIS_REALMS = [
  { value: '입시.검정 및 보습', label: '입시·보습 (국영수·과학 등)' },
  { value: '국제화', label: '국제화 (외국어)' },
  { value: '예능(대)', label: '예능 (음악·미술·무용)' },
  { value: '정보', label: '정보 (코딩·컴퓨터)' },
  { value: '기예(대)', label: '기예' },
  { value: '종합(대)', label: '종합' },
  { value: '인문사회(대)', label: '인문사회' },
  { value: '직업기술', label: '직업기술' },
  { value: '독서실', label: '독서실' },
  { value: '기타(대)', label: '기타' },
];

export interface NeisRawRow {
  ATPT_OFCDC_SC_CODE: string;
  ATPT_OFCDC_SC_NM: string;
  ADMST_ZONE_NM: string;
  ACA_INSTI_SC_NM: string;
  ACA_ASNUM: string;
  ACA_NM: string;
  ESTBL_YMD?: string | null;
  REG_STTUS_NM?: string | null;
  TOFOR_SMTOT?: number | null;
  DTM_RCPTN_ABLTY_NMPR_SMTOT?: number | null;
  REALM_SC_NM?: string | null;
  LE_ORD_NM?: string | null;
  LE_CRSE_LIST_NM?: string | null;
  LE_CRSE_NM?: string | null;
  PSNBY_THCC_CNTNT?: string | null;
  THCC_OTHBC_YN?: string | null;
  FA_RDNMA?: string | null;
  FA_RDNDA?: string | null;
  FA_TELNO?: string | null;
  LOAD_DTM?: string | null;
}

export interface TuitionItem {
  course: string;
  price: number;
}

export interface NeisAcademy {
  id: string;
  name: string;
  kind: string;
  office: string;
  sigungu: string;
  realm: string;
  courseGroup: string;
  course: string;
  /** LE_CRSE_NM: 보습, 음악, 미술, 무용, 실용외국어 등 */
  courseCategory: string;
  /** LE_CRSE_LIST_NM: 대표 교습과정 */
  courseList: string;
  tuitions: TuitionItem[];
  tuitionPublic: boolean;
  capacity: number | null;
  address: string;
  /** 도로명 주소 앞부분 (구·동 판별용) */
  roadAddress: string;
  phone: string;
  establishedAt: string;
  status: string;
  loadedAt: string;
}

/**
 * 인당수강료내용 파싱.
 * 예: "문법 영어:268000, 리딩:268000, 수능독해:268000"
 *     "피아노(초급):140000, 피아노(체르니100):150000"
 */
export function parseTuition(text: string | null | undefined): TuitionItem[] {
  if (!text || !text.trim()) return [];
  // '1:1 고등수학:600000'의 '1:1'(수업 인원)이 금액 구분자로 잘리지 않게 '1대1'로 바꿔 둔다
  text = text.replace(/(?<![\d:])(\d{1,2})\s*:\s*(\d{1,2})(?![\d,])(?=\s*(?:[^\d\s,]|:|\s))/g, '$1대$2');
  const items: TuitionItem[] = [];
  // 과정명에 쉼표가 거의 없고, 금액은 콜론 뒤 숫자이므로 "이름:숫자" 쌍을 순서대로 찾는다.
  // 과정명 안의 괄호 속 쉼표는 허용한다: 'HSK(3, 4):170000'
  const re = /\s*((?:[^:,(]|\([^)]*\))+?)\s*:\s*([\d,]+)\s*(?:원)?\s*(?=,|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const price = Number(m[2].replace(/,/g, ''));
    if (Number.isFinite(price) && price > 0) items.push({ course: m[1].trim(), price });
  }
  return items;
}

function ymd(raw: string | null | undefined): string {
  const v = (raw ?? '').trim();
  return /^\d{8}$/.test(v) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : '';
}

/**
 * 2026-07-01 광주광역시·전라남도가 전남광주통합특별시로 통합됐지만 학원 자료에는 옛 주소가 남아 있다.
 * 화면에는 새 이름으로 보여준다. (시·군·구 이름은 그대로)
 */
export function normalizeLegacyAddress(address: string): string {
  return address.replace(/^(광주광역시|전라남도)\s/, '전남광주통합특별시 ');
}

/** 원자료에 섞여 오는 깨진 글자(U+FFFD) 지우기 */
const clean = (v: string | null | undefined) => (v ?? '').replace(/\uFFFD/g, '').trim();

export function toNeisAcademy(row: NeisRawRow): NeisAcademy {
  return {
    id: `${row.ATPT_OFCDC_SC_CODE}-${row.ACA_ASNUM}`,
    name: clean(row.ACA_NM),
    kind: row.ACA_INSTI_SC_NM?.trim() ?? '',
    office: row.ATPT_OFCDC_SC_NM?.trim() ?? '',
    sigungu: row.ADMST_ZONE_NM?.trim() ?? '',
    realm: row.REALM_SC_NM?.trim() ?? '',
    courseGroup: row.LE_ORD_NM?.trim() ?? '',
    course: [row.LE_CRSE_NM, row.LE_CRSE_LIST_NM].filter(Boolean).join(' · '),
    courseCategory: row.LE_CRSE_NM?.trim() ?? '',
    courseList: row.LE_CRSE_LIST_NM?.trim() ?? '',
    tuitions: parseTuition(clean(row.PSNBY_THCC_CNTNT)),
    tuitionPublic: (row.THCC_OTHBC_YN ?? '').trim() === 'Y',
    capacity: row.TOFOR_SMTOT ?? row.DTM_RCPTN_ABLTY_NMPR_SMTOT ?? null,
    address: normalizeLegacyAddress(
      [row.FA_RDNMA, row.FA_RDNDA].map(clean).filter(Boolean).join(' ').replace(/\s+,/g, ',').replace(/^,\s*/, ''),
    ),
    roadAddress: clean(row.FA_RDNMA),
    phone: (row.FA_TELNO ?? '').trim(),
    establishedAt: ymd(row.ESTBL_YMD),
    status: (row.REG_STTUS_NM ?? '').trim(),
    loadedAt: ymd(row.LOAD_DTM),
  };
}

export interface NeisQuery {
  key?: string;
  officeCode: string;
  sigungu?: string;
  realm?: string;
  name?: string;
  page?: number;
  pageSize?: number;
}

export interface NeisResult {
  total: number;
  rows: NeisAcademy[];
  /** 교육청 원자료 그대로 (매주 업데이트에서 보관했다가 다시 가공할 때 쓴다) */
  raw: NeisRawRow[];
  sampleMode: boolean;
}

export class NeisError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export function buildNeisUrl(q: NeisQuery): string {
  const params = new URLSearchParams({
    Type: 'json',
    pIndex: String(q.page ?? 1),
    pSize: String(q.pageSize ?? 100),
    ATPT_OFCDC_SC_CODE: q.officeCode,
  });
  if (q.key) params.set('KEY', q.key.trim());
  if (q.sigungu) params.set('ADMST_ZONE_NM', q.sigungu);
  if (q.realm) params.set('REALM_SC_NM', q.realm);
  if (q.name) params.set('ACA_NM', q.name.trim());
  return `${NEIS_ENDPOINT}?${params.toString()}`;
}

/** 응답 JSON 해석 (fetch 와 분리해 테스트 가능하게) */
export function parseNeisResponse(json: unknown, sampleMode: boolean): NeisResult {
  const data = json as {
    RESULT?: { CODE: string; MESSAGE: string };
    acaInsTiInfo?: [{ head: [{ list_total_count: number }, { RESULT: { CODE: string; MESSAGE: string } }] }, { row: NeisRawRow[] }];
  };
  if (data.RESULT) {
    if (data.RESULT.CODE === 'INFO-200') return { total: 0, rows: [], raw: [], sampleMode };
    throw new NeisError(data.RESULT.CODE, data.RESULT.MESSAGE);
  }
  if (!data.acaInsTiInfo) throw new NeisError('PARSE', '응답 형식을 알 수 없습니다.');
  const [headPart, rowPart] = data.acaInsTiInfo;
  const total = headPart.head[0]?.list_total_count ?? 0;
  const raw = rowPart?.row ?? [];
  return { total, rows: raw.map(toNeisAcademy), raw, sampleMode };
}

const RETRY_DELAYS_MS = [800, 2000];

/** 교육청 서버 쪽 일시 오류 (HTTP 200 으로 오기도 한다) */
const TRANSIENT_CODES = new Set(['ERROR-500', 'ERROR-600', 'ERROR-601']);

export async function fetchNeisAcademies(q: NeisQuery, fetchImpl: typeof fetch = fetch, retryDelays: number[] = RETRY_DELAYS_MS): Promise<NeisResult> {
  const sampleMode = !q.key?.trim();
  const url = buildNeisUrl(sampleMode ? { ...q, pageSize: 5 } : q);
  // 교육청 서버가 잠깐 503·ERROR-500 을 주는 경우가 있어 연결 오류·서버 오류는 두 번까지 다시 시도한다
  for (let attempt = 0; ; attempt++) {
    let res: Response | null = null;
    try {
      res = await fetchImpl(url);
    } catch {
      res = null;
    }
    let error: NeisError;
    if (res && res.ok) {
      try {
        return parseNeisResponse(await res.json(), sampleMode);
      } catch (err) {
        if (!(err instanceof NeisError) || !TRANSIENT_CODES.has(err.code)) throw err;
        error = err;
      }
    } else if (!res) {
      error = new NeisError('NETWORK', '교육청 서버에 연결하지 못했습니다. 인터넷 연결을 확인하거나 잠시 후 다시 시도하세요.');
    } else {
      error = new NeisError(`HTTP-${res.status}`, `교육청 서버 응답 오류 (${res.status}). 잠시 후 다시 시도하세요.`);
      if (res.status < 500) throw error;
    }
    if (attempt >= retryDelays.length) throw error;
    await new Promise((r) => setTimeout(r, retryDelays[attempt]));
  }
}

/** 인증키가 있을 때 한 번에 받을 수 있는 최대 건수 (API 제한) */
export const NEIS_MAX_PAGE_SIZE = 1000;

/**
 * 조건에 맞는 학원을 여러 페이지에 걸쳐 모두 받는다. 인증키가 없으면 샘플 5건만 온다.
 * maxRows 로 상한을 둬서 한 지역에 수천 건이 있어도 요청 수가 폭증하지 않게 한다.
 */
export async function fetchAllNeisAcademies(
  q: Omit<NeisQuery, 'page' | 'pageSize'>,
  options: { maxRows?: number; onProgress?: (loaded: number, total: number) => void; fetchImpl?: typeof fetch; retryDelays?: number[]; pageDelayMs?: number } = {},
): Promise<NeisResult & { truncated: boolean }> {
  const { maxRows = 6000, onProgress, fetchImpl = fetch, retryDelays, pageDelayMs = 0 } = options;
  const first = await fetchNeisAcademies({ ...q, page: 1, pageSize: NEIS_MAX_PAGE_SIZE }, fetchImpl, retryDelays);
  const rows = [...first.rows];
  const raw = [...first.raw];
  onProgress?.(rows.length, first.total);
  if (first.sampleMode) return { ...first, truncated: first.total > rows.length };
  const limit = Math.min(first.total, maxRows);
  for (let page = 2; rows.length < limit; page++) {
    if (pageDelayMs) await new Promise((r) => setTimeout(r, pageDelayMs));
    const next = await fetchNeisAcademies({ ...q, page, pageSize: NEIS_MAX_PAGE_SIZE }, fetchImpl, retryDelays);
    if (next.rows.length === 0) break;
    rows.push(...next.rows);
    raw.push(...next.raw);
    onProgress?.(rows.length, first.total);
  }
  return { total: first.total, rows, raw, sampleMode: false, truncated: first.total > rows.length };
}

export function neisErrorMessage(err: unknown): string {
  if (err instanceof NeisError) {
    if (err.code === 'ERROR-290') return '인증키가 올바르지 않습니다. 설정에서 인증키를 다시 확인하세요.';
    if (err.code === 'ERROR-337') return '오늘 조회 한도를 넘었습니다. 내일 다시 시도하세요.';
    if (err.code === 'ERROR-336') return '한 번에 요청할 수 있는 건수(1,000건)를 넘었습니다.';
    return err.message;
  }
  if (err instanceof Error && /[가-힣]/.test(err.message)) return err.message;
  return '알 수 없는 오류가 발생했습니다.';
}
