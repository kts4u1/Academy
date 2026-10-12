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
  tuitions: TuitionItem[];
  tuitionPublic: boolean;
  capacity: number | null;
  address: string;
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
  const items: TuitionItem[] = [];
  // 과정명에 쉼표가 거의 없고, 금액은 콜론 뒤 숫자이므로 "이름:숫자" 쌍을 순서대로 찾는다.
  const re = /\s*([^:,]+?)\s*:\s*([\d,]+)\s*(?:원)?\s*(?=,|$)/g;
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

export function toNeisAcademy(row: NeisRawRow): NeisAcademy {
  return {
    id: `${row.ATPT_OFCDC_SC_CODE}-${row.ACA_ASNUM}`,
    name: row.ACA_NM?.trim() ?? '',
    kind: row.ACA_INSTI_SC_NM?.trim() ?? '',
    office: row.ATPT_OFCDC_SC_NM?.trim() ?? '',
    sigungu: row.ADMST_ZONE_NM?.trim() ?? '',
    realm: row.REALM_SC_NM?.trim() ?? '',
    courseGroup: row.LE_ORD_NM?.trim() ?? '',
    course: [row.LE_CRSE_NM, row.LE_CRSE_LIST_NM].filter(Boolean).join(' · '),
    tuitions: parseTuition(row.PSNBY_THCC_CNTNT),
    tuitionPublic: (row.THCC_OTHBC_YN ?? '').trim() === 'Y',
    capacity: row.TOFOR_SMTOT ?? row.DTM_RCPTN_ABLTY_NMPR_SMTOT ?? null,
    address: [row.FA_RDNMA, row.FA_RDNDA].map((s) => (s ?? '').trim()).filter(Boolean).join(' ').replace(/\s+,/g, ',').replace(/^,\s*/, ''),
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
    if (data.RESULT.CODE === 'INFO-200') return { total: 0, rows: [], sampleMode };
    throw new NeisError(data.RESULT.CODE, data.RESULT.MESSAGE);
  }
  if (!data.acaInsTiInfo) throw new NeisError('PARSE', '응답 형식을 알 수 없습니다.');
  const [headPart, rowPart] = data.acaInsTiInfo;
  const total = headPart.head[0]?.list_total_count ?? 0;
  const rows = (rowPart?.row ?? []).map(toNeisAcademy);
  return { total, rows, sampleMode };
}

export async function fetchNeisAcademies(q: NeisQuery, fetchImpl: typeof fetch = fetch): Promise<NeisResult> {
  const sampleMode = !q.key?.trim();
  let res: Response;
  try {
    res = await fetchImpl(buildNeisUrl(sampleMode ? { ...q, pageSize: 5 } : q));
  } catch {
    throw new NeisError('NETWORK', '교육청 서버에 연결하지 못했습니다. 인터넷 연결을 확인하거나 잠시 후 다시 시도하세요.');
  }
  if (!res.ok) throw new NeisError(`HTTP-${res.status}`, `교육청 서버 응답 오류 (${res.status})`);
  return parseNeisResponse(await res.json(), sampleMode);
}

export function neisErrorMessage(err: unknown): string {
  if (err instanceof NeisError) {
    if (err.code === 'ERROR-290') return '인증키가 올바르지 않습니다. 설정에서 인증키를 다시 확인하세요.';
    if (err.code === 'ERROR-337') return '오늘 조회 한도를 넘었습니다. 내일 다시 시도하세요.';
    return err.message;
  }
  return '알 수 없는 오류가 발생했습니다.';
}
