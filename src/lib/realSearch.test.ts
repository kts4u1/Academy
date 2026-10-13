import { describe, expect, it } from 'vitest';
import type { DistrictData } from '../data/source';
import { academy } from '../test/fixtures';
import { buildMarket } from './realData';
import { cheaperAlternatives, EMPTY_FILTERS, marketForCourse, marketScopeName, parseQuery, searchAcademies } from './realSearch';

describe('parseQuery', () => {
  it('동 이름 + 과목', () => {
    expect(parseQuery('목동 영어')).toMatchObject({ sido: '서울', sigungu: '양천구', subject: 'english', text: '' });
    expect(parseQuery('대치동 국어 내신')).toMatchObject({ sido: '서울', sigungu: '강남구', subject: 'korean', text: '내신' });
  });

  it('구 이름 줄임말과 일반구', () => {
    expect(parseQuery('분당 수학')).toMatchObject({ sido: '경기', sigungu: '성남시 분당구', subject: 'math' });
    expect(parseQuery('광산구 피아노')).toMatchObject({ sido: '광주', sigungu: '광산구', subject: 'piano' });
  });

  it('같은 이름의 구는 시·도를 앞에 쓰거나 내 동네 시·도를 먼저 고른다', () => {
    expect(parseQuery('대구 중구')).toMatchObject({ sido: '대구', sigungu: '중구' });
    expect(parseQuery('서구', { sido: '광주', sigungu: '광산구' })).toMatchObject({ sido: '광주', sigungu: '서구' });
  });

  it('시·도만 쓰면 내 동네(그 시·도일 때) 또는 첫 시·군·구', () => {
    expect(parseQuery('세종 논술')).toMatchObject({ sido: '세종', sigungu: '세종시', subject: 'essay' });
    expect(parseQuery('광주특별시', { sido: '광주', sigungu: '서구' })).toMatchObject({ sido: '광주', sigungu: '서구' });
  });

  it('지역·과목이 아니면 학원 이름 검색어로 남긴다', () => {
    expect(parseQuery('해법 수학')).toMatchObject({ subject: 'math', text: '해법' });
    expect(parseQuery('')).toEqual({ text: '' });
  });
});

function district(list: ReturnType<typeof academy>[], unknown: ReturnType<typeof academy>[] = []): DistrictData {
  return { mode: 'static', sido: '서울', sigungu: '강남구', academies: list, unknownDistrict: unknown, cityWide: false, updatedAt: '2026-10-12T18:00:00Z', sampleMode: false };
}

describe('searchAcademies', () => {
  const a = academy({ ACA_NM: '가영어', PSNBY_THCC_CNTNT: '초등영어:200000, 중등영어:300000' });
  const b = academy({ ACA_NM: '나영어', PSNBY_THCC_CNTNT: '초등영어:250000' });
  const c = academy({ ACA_NM: '다영어', PSNBY_THCC_CNTNT: '초등영어:350000' });
  const d = academy({ ACA_INSTI_SC_NM: '학원', ACA_NM: '라영어학원', PSNBY_THCC_CNTNT: '' });
  const e = academy({ ACA_NM: '마피아노', REALM_SC_NM: '예능(대)', LE_CRSE_NM: '음악', PSNBY_THCC_CNTNT: '피아노:150000' });
  const data = district([a, b, c, d, e]);
  const rows = buildMarket([a, b, c, d, e]);

  it('과목·대상으로 찾고 교습비를 모르는 곳은 가격순에서 뒤로', () => {
    const hits = searchAcademies(data, { ...EMPTY_FILTERS, subject: 'english', age: 'elementary' }, rows, 'price');
    expect(hits.map((h) => h.academy.name)).toEqual(['가영어', '나영어', '다영어', '라영어학원']);
    expect(hits[0].best?.price).toBe(200000);
    expect(hits[3].best).toBeNull();
  });

  it('교습비 공개된 곳만', () => {
    const hits = searchAcademies(data, { ...EMPTY_FILTERS, subject: 'english', pricedOnly: true }, rows, 'price');
    expect(hits.map((h) => h.academy.name)).toEqual(['가영어', '나영어', '다영어']);
  });

  it('시세 대비 위치를 붙이고 저렴한 순으로 정렬', () => {
    const hits = searchAcademies(data, { ...EMPTY_FILTERS, subject: 'english', age: 'elementary', pricedOnly: true }, rows, 'value');
    expect(hits[0].academy.name).toBe('가영어');
    expect(hits[0].market?.row).toMatchObject({ subjectId: 'english', age: 'elementary', median: 250000 });
    expect(hits[0].level).toBe('very_low');
    expect(hits[2].diffFromMedian).toBeCloseTo(0.4);
  });

  it('검색어는 이름·동·과정 이름에서 찾는다', () => {
    expect(searchAcademies(data, { ...EMPTY_FILTERS, text: '피아노' }, rows, 'name').map((h) => h.academy.name)).toEqual(['마피아노']);
    expect(searchAcademies(data, { ...EMPTY_FILTERS, text: '개포' }, rows, 'name')).toHaveLength(5);
    expect(searchAcademies(data, { ...EMPTY_FILTERS, kind: '학원' }, rows, 'name').map((h) => h.academy.name)).toEqual(['라영어학원']);
  });

  it('구 미상 학원은 끄면 빠진다', () => {
    const u = academy({ ATPT_OFCDC_SC_CODE: 'J10', ADMST_ZONE_NM: '성남시', FA_RDNMA: '경기도 성남시 어딘가로 1', FA_RDNDA: '', PSNBY_THCC_CNTNT: '초등영어:100000' }, '경기');
    const withUnknown = district([a], [u]);
    expect(searchAcademies(withUnknown, EMPTY_FILTERS, rows, 'price')).toHaveLength(2);
    expect(searchAcademies(withUnknown, { ...EMPTY_FILTERS, includeUnknown: false }, rows, 'price')).toHaveLength(1);
  });

  it('같은 동네에서 더 저렴한 곳', () => {
    const alt = cheaperAlternatives(data, c, c.courses[0]);
    expect(alt.map((x) => x.academy.name)).toEqual(['가영어', '나영어']);
  });

  it('대상이 정해진 과정은 같은 대상 시세와만 비교한다', () => {
    const high = academy({ ACA_NM: '바영어', PSNBY_THCC_CNTNT: '고등영어:500000' });
    expect(marketForCourse(rows, high, high.courses[0])).toBeNull();
    expect(marketForCourse(rows, a, a.courses[0])?.row.age).toBe('elementary');
  });

  it('구 시세가 없으면 범위를 넓혔다고 알려 준다', () => {
    const m = marketForCourse(rows, { sido: '서울', sigungu: '서초구' }, a.courses[0]);
    expect(m?.widened).toBe(true);
    expect(marketScopeName(m!.row, 'static')).toBe('서울 전체');
    expect(marketScopeName(m!.row, 'live', { sigungu: '서초구' })).toBe('서초구 일대');
  });
});
