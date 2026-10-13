import { describe, expect, it } from 'vitest';
import { academy } from '../test/fixtures';
import { academyPrices, approxPercentile, buildMarket, findMarket, isComparableCourse, marketFor, MIN_MARKET_N, positionOf, pricePerSession, priceLevel } from './realData';

describe('toRealAcademy', () => {
  it('교습비를 과정별로 나누고 과목·대상을 붙인다', () => {
    const a = academy({ ACA_NM: '개포수학교습소', PSNBY_THCC_CNTNT: '중등수학 주3회:320000, 고등수학:450000' });
    expect(a.sigungu).toBe('강남구');
    expect(a.dong).toBe('개포동');
    expect(a.kind).toBe('교습소');
    expect(a.courses).toHaveLength(2);
    expect(a.courses[0]).toMatchObject({ name: '중등수학 주3회', price: 320000, subjectId: 'math', ages: ['middle'], sessionsPerWeek: 3 });
    expect(a.courses[1]).toMatchObject({ subjectId: 'math', ages: ['high'] });
    expect(a.subjects).toEqual(['math']);
    expect(a.unassigned).toBeUndefined();
  });

  it('같은 과정·금액이 두 번 적혀 있으면 한 번만 쓴다', () => {
    const a = academy({ PSNBY_THCC_CNTNT: '영어:250000, 영어:250000, 영어:280000' });
    expect(a.courses.map((c) => c.price)).toEqual([250000, 280000]);
  });

  it('1:1 과정과 특강은 비교에서 뺀다', () => {
    const a = academy({ ACA_NM: '수학교습소', PSNBY_THCC_CNTNT: '1:1 고등수학:600000, 겨울방학 특강:200000, 중등수학:300000' });
    const byName = Object.fromEntries(a.courses.map((c) => [c.name, c]));
    expect(byName['1대1 고등수학'].private).toBe(true);
    expect(isComparableCourse(byName['1대1 고등수학'])).toBe(false);
    expect(byName['겨울방학 특강'].excluded).toBeTruthy();
    expect(isComparableCourse(byName['중등수학'])).toBe(true);
  });

  it('교습비가 비어 있어도 학원 이름으로 과목을 짐작한다', () => {
    const a = academy({ ACA_INSTI_SC_NM: '학원', ACA_NM: '대치영어학원', PSNBY_THCC_CNTNT: ' ' });
    expect(a.courses).toEqual([]);
    expect(a.subjects).toEqual(['english']);
  });

  it('구를 정하지 못하면 unassigned 로 표시하고 시 이름으로 모은다', () => {
    const a = academy({ ATPT_OFCDC_SC_CODE: 'J10', ADMST_ZONE_NM: '성남시', FA_RDNMA: '경기도 성남시 어딘가로 1', FA_RDNDA: '' }, '경기');
    expect(a.unassigned).toBe(true);
    expect(a.sigungu).toBe('성남시');
  });

  it('주당 횟수를 알면 회당 금액', () => {
    const a = academy({ PSNBY_THCC_CNTNT: '초등영어 주2회:200000' });
    expect(pricePerSession(a.courses[0])).toBe(25000);
  });
});

describe('buildMarket', () => {
  const list = [
    academy({ ACA_NM: '가수학', PSNBY_THCC_CNTNT: '중등수학:200000' }),
    academy({ ACA_NM: '나수학', PSNBY_THCC_CNTNT: '중등수학:300000' }),
    academy({ ACA_NM: '다수학', PSNBY_THCC_CNTNT: '중등수학:400000, 고등수학:500000' }),
    academy({ ACA_NM: '라수학', ADMST_ZONE_NM: '서초구', FA_RDNMA: '서울특별시 서초구 반포대로 1', FA_RDNDA: ' (반포동)', PSNBY_THCC_CNTNT: '중등수학:600000' }),
  ];
  const rows = buildMarket(list);

  it(`과정이 ${MIN_MARKET_N}개 이상일 때만 시세를 만든다`, () => {
    const gangnam = findMarket(rows, '서울', '강남구', 'math', 'middle');
    expect(gangnam).toMatchObject({ n: 3, academies: 3, min: 200000, median: 300000, max: 400000 });
    expect(findMarket(rows, '서울', '서초구', 'math', 'middle')).toBeUndefined();
    expect(findMarket(rows, '서울', '강남구', 'math', 'high')).toBeUndefined();
  });

  it('시·도 전체와 대상 전체 시세도 만든다', () => {
    expect(findMarket(rows, '서울', '', 'math', 'middle')).toMatchObject({ n: 4, median: 350000 });
    expect(findMarket(rows, '서울', '강남구', 'math', null)).toMatchObject({ n: 4, academies: 3 });
  });

  it('구 시세가 없으면 시·도 전체로 넓힌다', () => {
    expect(marketFor(rows, '서울', '서초구', 'math', 'middle')?.sigungu).toBe('');
  });

  it('구를 정하지 못한 학원은 시·도 전체에만 넣는다', () => {
    const unknown = Array.from({ length: 3 }, (_, i) =>
      academy({ ATPT_OFCDC_SC_CODE: 'J10', ADMST_ZONE_NM: '성남시', FA_RDNMA: '경기도 성남시 어딘가로 1', FA_RDNDA: '', PSNBY_THCC_CNTNT: `초등영어:${200000 + i * 10000}` }, '경기'),
    );
    const r = buildMarket(unknown);
    expect(r.every((row) => row.sigungu === '')).toBe(true);
    expect(findMarket(r, '경기', '', 'english', 'elementary')?.n).toBe(3);
  });

  it('과정을 많이 신고한 곳도 한 표만 센다', () => {
    const many = academy({ ACA_NM: '마수학', PSNBY_THCC_CNTNT: 'A반 중등수학:900000, B반 중등수학:900000, C반 중등수학:900000, D반 중등수학:900000' });
    const r = findMarket(buildMarket([...list, many]), '서울', '강남구', 'math', 'middle');
    expect(r).toMatchObject({ n: 7, academies: 4, median: 350000, max: 900000 });
  });

  it('학원별 대표 금액 (히스토그램용)', () => {
    expect(academyPrices(list, 'math', 'middle').sort()).toEqual([200000, 300000, 400000, 600000]);
    expect(academyPrices(list, 'math', null).sort()).toEqual([200000, 300000, 450000, 600000]);
  });
});

describe('시세 위치', () => {
  const row = { sido: '서울', sigungu: '강남구', subjectId: 'math', age: null, n: 10, academies: 10, min: 100000, p10: 150000, p25: 200000, median: 300000, p75: 400000, p90: 500000, max: 900000 };

  it('분위수 사이를 직선으로 이어 위치를 낸다', () => {
    expect(approxPercentile(row, 50000)).toBe(0);
    expect(approxPercentile(row, 300000)).toBe(50);
    expect(approxPercentile(row, 250000)).toBeCloseTo(37.5);
    expect(approxPercentile(row, 1000000)).toBe(100);
  });

  it('가격 수준과 중앙값 대비 차이', () => {
    expect(priceLevel(10)).toBe('very_low');
    expect(priceLevel(50)).toBe('avg');
    expect(priceLevel(90)).toBe('very_high');
    const pos = positionOf(240000, row);
    expect(pos.level).toBe('low');
    expect(pos.diffFromMedian).toBeCloseTo(-0.2);
  });

  it('원자료가 있으면 실제 순위를 쓴다', () => {
    expect(positionOf(300000, row, [100000, 200000, 300000, 400000]).percentile).toBe(62.5);
  });
});
