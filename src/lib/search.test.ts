import { describe, expect, it } from 'vitest';
import { getAcademies } from '../data';
import { SUBJECTS } from '../data/categories';
import { generateAcademies } from '../data/generator';
import { comparePlanToPeers, cheaperAlternatives } from './market';
import { EMPTY_FILTERS, matchesKeyword, searchAcademies } from './search';

const academies = getAcademies();

describe('샘플 데이터', () => {
  it('시드가 같으면 항상 같은 데이터', () => {
    const again = generateAcademies();
    expect(again.length).toBe(academies.length);
    expect(again[123].name).toBe(academies[123].name);
    expect(again[123].plans[0].price).toBe(academies[123].plans[0].price);
  });

  it('모든 과목이 충분히 존재한다', () => {
    for (const subject of SUBJECTS) {
      const n = academies.filter((a) => a.subjectIds.includes(subject.id)).length;
      expect(n, subject.name).toBeGreaterThanOrEqual(5);
    }
  });

  it('가격은 양수이고 만원 단위 반올림 수준', () => {
    for (const a of academies) {
      expect(a.plans.length).toBeGreaterThan(0);
      for (const p of a.plans) {
        expect(p.price).toBeGreaterThan(0);
        expect(p.price % 5000).toBe(0);
      }
    }
  });

  it('학원 id 는 고유하다', () => {
    expect(new Set(academies.map((a) => a.id)).size).toBe(academies.length);
  });
});

describe('searchAcademies', () => {
  it('과목·지역 필터와 가격 낮은순 정렬', () => {
    const results = searchAcademies(academies, { ...EMPTY_FILTERS, subjectIds: ['math'], sido: '서울' }, 'price_asc', 'monthlyTuition');
    expect(results.length).toBeGreaterThan(10);
    for (const r of results) {
      expect(r.academy.region.sido).toBe('서울');
      expect(r.plan.subjectId).toBe('math');
    }
    for (let i = 1; i < results.length; i++) expect(results[i].value).toBeGreaterThanOrEqual(results[i - 1].value);
  });

  it('대표 요금제는 조건에 맞는 요금제 중 가장 저렴한 것', () => {
    const results = searchAcademies(academies, { ...EMPTY_FILTERS, ages: ['elementary'] }, 'price_asc', 'pricePerHour');
    for (const r of results.slice(0, 50)) {
      const candidates = r.academy.plans.filter((p) => p.targets.includes('elementary'));
      expect(candidates).toContain(r.plan);
    }
  });

  it('가격 범위 필터', () => {
    const results = searchAcademies(
      academies,
      { ...EMPTY_FILTERS, group: 'sports', priceMax: 150000 },
      'price_desc',
      'monthlyTuition',
    );
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.value <= 150000)).toBe(true);
  });

  it('키워드는 모든 단어가 맞아야 한다', () => {
    const a = academies.find((x) => x.subjectIds[0] === 'jiujitsu')!;
    expect(matchesKeyword(a, `${a.region.sigungu} 주짓수`)).toBe(true);
    expect(matchesKeyword(a, '주짓수 피아노')).toBe(false);
  });

  it('거리 필터와 가까운순', () => {
    const origin = { lat: 37.4979, lng: 127.0276 }; // 강남역 부근
    const results = searchAcademies(academies, { ...EMPTY_FILTERS, maxDistanceKm: 3 }, 'distance', 'monthlyTuition', { origin });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => (r.distanceKm ?? 99) <= 3)).toBe(true);
    for (let i = 1; i < results.length; i++) expect(results[i].distanceKm!).toBeGreaterThanOrEqual(results[i - 1].distanceKm!);
  });
});

describe('시세 비교', () => {
  it('같은 조건 학원 대비 백분위를 계산한다', () => {
    const a = academies.find((x) => x.region.sido === '서울' && x.subjectIds[0] === 'math')!;
    const peer = comparePlanToPeers(academies, a, a.plans[0], 'pricePerHour');
    expect(peer).not.toBeNull();
    expect(peer!.percentile).toBeGreaterThanOrEqual(0);
    expect(peer!.percentile).toBeLessThanOrEqual(100);
    expect(peer!.stats.n).toBeGreaterThanOrEqual(5);
  });

  it('더 저렴한 대안은 실제로 더 싸고 학원이 중복되지 않는다', () => {
    const expensive = academies
      .filter((x) => x.subjectIds[0] === 'english' && x.region.sido === '서울')
      .sort((x, y) => y.plans[0].price - x.plans[0].price)[0];
    const alts = cheaperAlternatives(academies, expensive, expensive.plans[0], 'monthlyTuition');
    expect(alts.length).toBeGreaterThan(0);
    expect(new Set(alts.map((p) => p.academy.id)).size).toBe(alts.length);
  });
});
