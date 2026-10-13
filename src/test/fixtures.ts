// 테스트용 교육청 원자료 만들기
import { toNeisAcademy, type NeisRawRow } from '../lib/neis';
import { toRealAcademy, type RealAcademy } from '../lib/realData';

let seq = 0;

export function raw(overrides: Partial<NeisRawRow> = {}): NeisRawRow {
  seq += 1;
  return {
    ATPT_OFCDC_SC_CODE: 'B10',
    ATPT_OFCDC_SC_NM: '서울특별시교육청',
    ADMST_ZONE_NM: '강남구',
    ACA_INSTI_SC_NM: '교습소',
    ACA_ASNUM: String(3000000000 + seq),
    ACA_NM: `테스트교습소${seq}`,
    ESTBL_YMD: '20200101',
    REG_STTUS_NM: '개원',
    TOFOR_SMTOT: 9,
    REALM_SC_NM: '입시.검정 및 보습',
    LE_ORD_NM: '보통교과',
    LE_CRSE_LIST_NM: null,
    LE_CRSE_NM: '보습',
    PSNBY_THCC_CNTNT: '',
    THCC_OTHBC_YN: 'Y',
    FA_RDNMA: '서울특별시 강남구 선릉로 38',
    FA_RDNDA: ', 4층 (개포동)',
    FA_TELNO: '02-555-1234',
    LOAD_DTM: '20260901',
    ...overrides,
  } as NeisRawRow;
}

export function academy(overrides: Partial<NeisRawRow> = {}, sido = '서울'): RealAcademy {
  return toRealAcademy(toNeisAcademy(raw(overrides)), sido);
}
