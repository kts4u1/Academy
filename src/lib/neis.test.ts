import { describe, expect, it, vi } from 'vitest';
import { buildNeisUrl, fetchNeisAcademies, NeisError, parseNeisResponse, parseTuition, toNeisAcademy } from './neis';

describe('parseTuition', () => {
  it('과정명:금액 목록', () => {
    expect(parseTuition('문법 영어:268000, 리딩:268000, 리스닝:192000')).toEqual([
      { course: '문법 영어', price: 268000 },
      { course: '리딩', price: 268000 },
      { course: '리스닝', price: 192000 },
    ]);
  });

  it('괄호가 있는 과정명', () => {
    expect(parseTuition('피아노(초급):140000, 피아노(체르니100):150000')).toEqual([
      { course: '피아노(초급)', price: 140000 },
      { course: '피아노(체르니100)', price: 150000 },
    ]);
  });

  it('천 단위 쉼표와 원 표기', () => {
    expect(parseTuition('고등수학:1,200,000원, 중등수학:350,000')).toEqual([
      { course: '고등수학', price: 1200000 },
      { course: '중등수학', price: 350000 },
    ]);
  });

  it('괄호 안 쉼표가 있는 과정명', () => {
    expect(parseTuition('HSK(3, 4):170000, HSK(5, 6):180000')).toEqual([
      { course: 'HSK(3, 4)', price: 170000 },
      { course: 'HSK(5, 6)', price: 180000 },
    ]);
    expect(parseTuition('독서논술(초,중등)1:150000')).toEqual([{ course: '독서논술(초,중등)1', price: 150000 }]);
  });

  it('빈 값', () => {
    expect(parseTuition(' ')).toEqual([]);
    expect(parseTuition(null)).toEqual([]);
  });
});

const sampleRow = {
  ATPT_OFCDC_SC_CODE: 'B10',
  ATPT_OFCDC_SC_NM: '서울특별시교육청',
  ADMST_ZONE_NM: '강남구',
  ACA_INSTI_SC_NM: '교습소',
  ACA_ASNUM: '3000040501',
  ACA_NM: '예시영어교습소',
  ESTBL_YMD: '20211228',
  REG_STTUS_NM: '개원',
  TOFOR_SMTOT: 24,
  REALM_SC_NM: '입시.검정 및 보습',
  LE_ORD_NM: '보통교과',
  LE_CRSE_LIST_NM: '문법 영어',
  LE_CRSE_NM: '보습',
  PSNBY_THCC_CNTNT: '문법 영어:268000, 리딩:268000',
  THCC_OTHBC_YN: 'Y',
  FA_RDNMA: '서울특별시 강남구 예시로 7',
  FA_RDNDA: ', 3층',
  FA_TELNO: '02-0000-0000',
  LOAD_DTM: '20231018',
};

describe('NEIS 응답 처리', () => {
  it('행 변환', () => {
    const a = toNeisAcademy(sampleRow);
    expect(a.name).toBe('예시영어교습소');
    expect(a.tuitions).toHaveLength(2);
    expect(a.tuitionPublic).toBe(true);
    expect(a.establishedAt).toBe('2021-12-28');
    expect(a.address).toBe('서울특별시 강남구 예시로 7, 3층');
  });

  it('정상 응답', () => {
    const json = {
      acaInsTiInfo: [
        { head: [{ list_total_count: 25507 }, { RESULT: { CODE: 'INFO-000', MESSAGE: '정상' } }] },
        { row: [sampleRow] },
      ],
    };
    const r = parseNeisResponse(json, false);
    expect(r.total).toBe(25507);
    expect(r.rows[0].id).toBe('B10-3000040501');
  });

  it('데이터 없음은 빈 결과', () => {
    expect(parseNeisResponse({ RESULT: { CODE: 'INFO-200', MESSAGE: '없음' } }, true).rows).toEqual([]);
  });

  it('오류 코드는 예외', () => {
    expect(() => parseNeisResponse({ RESULT: { CODE: 'ERROR-290', MESSAGE: '인증키' } }, false)).toThrow(NeisError);
  });

  it('URL 구성 – 인증키가 없으면 5건 샘플 모드', async () => {
    expect(buildNeisUrl({ officeCode: 'B10', sigungu: '마포구', name: '수학' })).toContain('ADMST_ZONE_NM=%EB%A7%88%ED%8F%AC%EA%B5%AC');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ RESULT: { CODE: 'INFO-200', MESSAGE: '' } })));
    const r = await fetchNeisAcademies({ officeCode: 'B10' }, fetchMock as unknown as typeof fetch);
    expect(r.sampleMode).toBe(true);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain('pSize=5');
  });
});
