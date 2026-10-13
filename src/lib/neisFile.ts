// 나이스 교육정보 개방 포털이 매달 올리는 '학원교습소정보' 전국 파일(CSV)
// 인증키 없이 받을 수 있어서, 인증키가 없거나 API 가 실패할 때 매주 업데이트가 이 파일을 쓴다.
// (scripts/update-data.ts 에서만 쓰고 앱 화면에서는 쓰지 않는다)

import type { NeisRawRow } from './neis';

export const NEIS_FILE_DATASET = 'OPEN19220231012134453534385';
const PORTAL = 'https://open.neis.go.kr/portal/data/file';

export interface NeisFileEntry {
  fileSeq: number;
  name: string;
  /** 파일 이름의 기준일 YYYY-MM-DD (일이 없으면 그 달 말일) */
  baseDate: string;
}

/** '학원교습소정보_2026년09월30일기준', '학원교습소정보_2026년3월' → '2026-09-30', '2026-03-31' */
export function baseDateOf(name: string): string | null {
  const m = name.match(/(\d{4})\s*년\s*(\d{1,2})\s*월(?:\s*(\d{1,2})\s*일)?/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = m[3] ? Number(m[3]) : new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** 가장 최근 기준일의 CSV 파일 */
export function latestFile(list: { fileSeq: number; viewFileNm: string; fileExt?: string }[]): NeisFileEntry | null {
  const files = list
    .filter((f) => (f.fileExt ?? 'csv').toLowerCase() === 'csv')
    .map((f) => ({ fileSeq: f.fileSeq, name: f.viewFileNm, baseDate: baseDateOf(f.viewFileNm) }))
    .filter((f): f is NeisFileEntry => f.baseDate !== null)
    .sort((a, b) => a.baseDate.localeCompare(b.baseDate) || a.fileSeq - b.fileSeq);
  return files[files.length - 1] ?? null;
}

export async function findLatestNeisFile(fetchImpl: typeof fetch = fetch): Promise<NeisFileEntry> {
  const res = await fetchImpl(`${PORTAL}/searchFileData.do`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `infId=${NEIS_FILE_DATASET}&infSeq=3`,
  });
  if (!res.ok) throw new Error(`교육청 파일 목록을 받지 못했습니다 (${res.status})`);
  const json = (await res.json()) as { data?: { fileSeq: number; viewFileNm: string; fileExt?: string }[] };
  const latest = latestFile(json.data ?? []);
  if (!latest) throw new Error('교육청 파일 목록에 학원교습소정보 CSV 가 없습니다.');
  return latest;
}

export async function downloadNeisFile(fileSeq: number, fetchImpl: typeof fetch = fetch): Promise<string> {
  const res = await fetchImpl(`${PORTAL}/downloadBlobFileData.do`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `infId=${NEIS_FILE_DATASET}&infSeq=3&fileSeq=${fileSeq}`,
  });
  if (!res.ok) throw new Error(`교육청 파일을 받지 못했습니다 (${res.status})`);
  return decodeKorean(new Uint8Array(await res.arrayBuffer()));
}

/** UTF-8 이면 그대로, 아니면 CP949(EUC-KR) 로 읽는다 */
export function decodeKorean(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('euc-kr').decode(bytes);
  }
}

/** RFC 4180 CSV (따옴표 안의 쉼표·줄바꿈·"" 처리) */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** CSV 머리글 → API 필드 이름 */
const COLUMNS: Record<string, keyof NeisRawRow | 'REG_YMD' | 'CAA_BEGIN_YMD' | 'CAA_END_YMD' | 'BRHS_ACA_YN' | 'FA_RDNZC'> = {
  시도교육청코드: 'ATPT_OFCDC_SC_CODE',
  시도교육청명: 'ATPT_OFCDC_SC_NM',
  행정구역명: 'ADMST_ZONE_NM',
  학원교습소명: 'ACA_INSTI_SC_NM',
  학원지정번호: 'ACA_ASNUM',
  학원명: 'ACA_NM',
  개설일자: 'ESTBL_YMD',
  등록일자: 'REG_YMD',
  등록상태명: 'REG_STTUS_NM',
  휴원시작일자: 'CAA_BEGIN_YMD',
  휴원종료일자: 'CAA_END_YMD',
  정원합계: 'TOFOR_SMTOT',
  일시수용능력인원합계: 'DTM_RCPTN_ABLTY_NMPR_SMTOT',
  분야명: 'REALM_SC_NM',
  교습계열명: 'LE_ORD_NM',
  교습과정목록명: 'LE_CRSE_LIST_NM',
  교습과정명: 'LE_CRSE_NM',
  인당수강료: 'PSNBY_THCC_CNTNT',
  수강료공개여부: 'THCC_OTHBC_YN',
  기숙사학원여부: 'BRHS_ACA_YN',
  도로명주소: 'FA_RDNMA',
  도로명상세주소: 'FA_RDNDA',
  도로명우편번호: 'FA_RDNZC',
  전화번호: 'FA_TELNO',
  수정일자: 'LOAD_DTM',
};
const NUMERIC = new Set(['TOFOR_SMTOT', 'DTM_RCPTN_ABLTY_NMPR_SMTOT']);

/** 전국 CSV → API 와 같은 모양의 원자료 */
export function csvToRawRows(text: string): NeisRawRow[] {
  const [header, ...body] = parseCsv(text);
  if (!header) return [];
  const keys = header.map((h) => COLUMNS[h.trim()]);
  for (const required of ['ATPT_OFCDC_SC_CODE', 'ACA_ASNUM', 'ACA_NM', 'PSNBY_THCC_CNTNT'] as const) {
    if (!keys.includes(required)) throw new Error(`교육청 파일 형식이 바뀌었습니다: '${required}' 열이 없습니다.`);
  }
  return body.map((cells) => {
    const row: Record<string, string | number | null> = {};
    keys.forEach((k, i) => {
      if (!k) return;
      const v = cells[i] ?? '';
      row[k] = NUMERIC.has(k) ? (v.trim() === '' ? null : Number(v)) : v;
    });
    return row as unknown as NeisRawRow;
  });
}
