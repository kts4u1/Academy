import { describe, expect, it } from 'vitest';
import type { DistrictData } from '../data/source';
import { academy } from '../test/fixtures';
import { buildMarket, courseKey, findCourse, type Course, type RealAcademy } from './realData';
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

  it("'시 구' 처럼 지역 낱말이 여럿이면 차례로 좁힌다", () => {
    expect(parseQuery('성남시 중원구 수학')).toMatchObject({ sido: '경기', sigungu: '성남시 중원구', subject: 'math', text: '' });
    expect(parseQuery('고양시 일산서구 영어')).toMatchObject({ sigungu: '고양시 일산서구', text: '' });
    expect(parseQuery('포항 북구 수학')).toMatchObject({ sido: '경북', sigungu: '포항시 북구' });
    expect(parseQuery('분당 정자동 피아노')).toMatchObject({ sigungu: '성남시 분당구', subject: 'piano', text: '' });
  });

  it("'서울시'·'부산시' 같은 줄임말과 '광주시 광산구'", () => {
    expect(parseQuery('서울시 강남구 영어')).toMatchObject({ sido: '서울', sigungu: '강남구', text: '' });
    expect(parseQuery('부산시 강서구 수학', { sido: '서울', sigungu: '마포구' })).toMatchObject({ sido: '부산', sigungu: '강서구' });
    expect(parseQuery('광주시 광산구 피아노')).toMatchObject({ sido: '광주', sigungu: '광산구', subject: 'piano' });
    expect(parseQuery('광주시 영어')).toMatchObject({ sido: '경기', sigungu: '광주시' });
  });

  it('대상 낱말과 과목을 동 이름보다 먼저 알아듣는다', () => {
    expect(parseQuery('고등 수학', { sido: '서울', sigungu: '강남구' })).toMatchObject({ age: 'high', subject: 'math', text: '' });
    expect(parseQuery('고등 수학').sigungu).toBeUndefined();
    expect(parseQuery('일산 영어', { sido: '울산', sigungu: '남구' })).toMatchObject({ sido: '경기', sigungu: '고양시 일산동구' });
    expect(parseQuery('마산 피아노')).toMatchObject({ sido: '경남', sigungu: '창원시 마산합포구' });
  });

  it("'학원'·'레슨' 같은 말은 버리고 '피아노학원'은 과목으로", () => {
    expect(parseQuery('분당 피아노 학원')).toMatchObject({ subject: 'piano', text: '' });
    expect(parseQuery('목동 영어학원')).toMatchObject({ sigungu: '양천구', subject: 'english', text: '' });
    expect(parseQuery('강남구 피아노 레슨')).toMatchObject({ subject: 'piano', text: '' });
  });

  it('여러 과목에 걸치는 말은 과목으로 정하지 않는다', () => {
    expect(parseQuery('강남 보습').subject).toBeUndefined();
    expect(parseQuery('강남 실용음악').subject).toBeUndefined();
    expect(parseQuery('대치동 내신')).toMatchObject({ sigungu: '강남구', text: '내신' });
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
    expect(hits[0].rep?.price).toBe(200000);
    expect(hits[3].rep).toBeNull();
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

  it('더 저렴한 곳은 대상이 겹치는 과정만 본다', () => {
    const highAdult = academy({ ACA_NM: '사미술', REALM_SC_NM: '예능(대)', LE_CRSE_NM: '미술', PSNBY_THCC_CNTNT: '고등성인:200000' });
    const kids = academy({ ACA_NM: '아미술', REALM_SC_NM: '예능(대)', LE_CRSE_NM: '미술', PSNBY_THCC_CNTNT: '미술(유.초등):70000' });
    const high = academy({ ACA_NM: '자미술', REALM_SC_NM: '예능(대)', LE_CRSE_NM: '미술', PSNBY_THCC_CNTNT: '고등입시:150000' });
    const d2 = district([highAdult, kids, high]);
    expect(highAdult.courses[0].ages).toEqual(expect.arrayContaining(['high']));
    expect(cheaperAlternatives(d2, highAdult, highAdult.courses[0]).map((x) => x.academy.name)).toEqual(['자미술']);
  });

  it('대표 과정은 맞는 과정 가운데 금액이 가운데인 것', () => {
    const many = academy({ ACA_NM: '차영어', PSNBY_THCC_CNTNT: '초등영어A:50000, 초등영어B:240000, 초등영어C:260000, 초등영어D:900000' });
    const hits = searchAcademies(district([a, b, c, many]), { ...EMPTY_FILTERS, subject: 'english', age: 'elementary' }, buildMarket([a, b, c, many]), 'price');
    const hit = hits.find((h) => h.academy.name === '차영어')!;
    expect(hit.rep?.price).toBe(240000);
    expect(hit.level).not.toBe('very_low');
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
    expect(marketScopeName(m!.row, 'live')).toBe('받은 지역 전체');
  });
});

describe('체육시설 (검토에서 나온 문제)', () => {
  const sport = (name: string, price: number, extra: Partial<Course> = {}): RealAcademy => ({
    ...academy({ ACA_NM: name }),
    id: `kv-${name}`,
    kind: '체육시설',
    source: 'voucher',
    courses: [{ name: '검도', price, subjectId: 'kendo', ages: ['elementary'], ...extra }],
    subjects: ['kendo'],
  });

  it('더 저렴한 곳에 바우처 한도 금액을 넣지 않고, 한도 금액을 기준으로도 찾지 않는다', () => {
    const me = sport('나검도', 190000);
    const capped = sport('한도검도', 105000, { voucherCap: true });
    const cheaper = sport('싼검도', 150000);
    const data = { academies: [me, capped, cheaper], unknownDistrict: [] } as unknown as DistrictData;
    expect(cheaperAlternatives(data, me, me.courses[0]).map((x) => x.academy.name)).toEqual(['싼검도']);
    expect(cheaperAlternatives(data, capped, capped.courses[0])).toEqual([]);
  });

  it('학원·교습소 종류 필터가 체육시설을 숨기지 않는다', () => {
    const data = { academies: [sport('나검도', 150000)], unknownDistrict: [], sido: '서울', sigungu: '강남구' } as unknown as DistrictData;
    const hits = searchAcademies(data, { ...EMPTY_FILTERS, subject: 'kendo', kind: '교습소' }, [], 'price');
    expect(hits).toHaveLength(1);
  });

  it('체육 강좌 키에는 종목이 붙어 같은 이름·금액의 다른 종목을 고를 수 있다', () => {
    const courses: Course[] = [
      { name: '요가·필라테스', price: 100000, subjectId: 'pilates', ages: [] },
      { name: '요가·필라테스', price: 100000, subjectId: 'taekwondo', ages: [] },
    ];
    expect(courseKey(courses[1])).toBe('요가·필라테스|100000|taekwondo');
    expect(findCourse(courses, courseKey(courses[1]))).toBe(courses[1]);
    // 예전 이름|금액 링크도 찾는다
    expect(findCourse(courses, '요가·필라테스|100000')).toBe(courses[0]);
    // 교육청 과정 키는 그대로
    expect(courseKey({ name: '중등수학', price: 300000, subjectId: 'math' })).toBe('중등수학|300000');
  });
});

