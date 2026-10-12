import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS, searchAcademies } from '../lib/search';
import { getAcademies } from './index';
import { academyCount } from './generator';
import { DISTRICTS, districtsOf, EDU_OFFICES, findDistrict, neisZoneNames, SIDOS } from './regions';

describe('전국 지역 목록', () => {
  it('17개 시·도와 256개 시·군·구(일반구 포함)', () => {
    expect(SIDOS).toEqual(['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주']);
    expect(DISTRICTS).toHaveLength(256);
    expect(new Set(DISTRICTS.map((d) => `${d.sido} ${d.sigungu}`)).size).toBe(256);
    for (const sido of SIDOS) expect(EDU_OFFICES.some((o) => o.sido === sido), sido).toBe(true);
  });

  it('광주는 5개 자치구가 모두 있다', () => {
    expect(districtsOf('광주').map((d) => d.sigungu).sort()).toEqual(['광산구', '남구', '동구', '북구', '서구'].sort());
  });

  it('구 수가 공식 현황과 맞다', () => {
    expect(districtsOf('서울')).toHaveLength(25);
    expect(districtsOf('부산')).toHaveLength(16);
    expect(districtsOf('대구')).toHaveLength(9);
    expect(districtsOf('대전')).toHaveLength(5);
    expect(districtsOf('울산')).toHaveLength(5);
    expect(districtsOf('전남')).toHaveLength(22);
    expect(findDistrict('대구', '군위군')).toBeDefined();
    expect(findDistrict('인천', '검단구')).toBeDefined();
    expect(findDistrict('경기', '화성시 동탄구')).toBeDefined();
  });

  it('좌표는 대한민국 범위 안, 동 이름은 2개 이상', () => {
    for (const d of DISTRICTS) {
      expect(d.lat, d.sigungu).toBeGreaterThan(33);
      expect(d.lat, d.sigungu).toBeLessThan(38.7);
      expect(d.lng, d.sigungu).toBeGreaterThan(124.5);
      expect(d.lng, d.sigungu).toBeLessThan(131);
      expect(d.dongs.length, d.sigungu).toBeGreaterThanOrEqual(2);
    }
  });

  it('교육청 조회용 행정구역명', () => {
    expect(neisZoneNames({ sido: '경기', sigungu: '성남시 분당구' })).toEqual(['성남시']);
    expect(neisZoneNames({ sido: '세종', sigungu: '세종시' })).toEqual(['세종특별자치시']);
    expect(neisZoneNames({ sido: '인천', sigungu: '서해구' })).toEqual(['서해구', '서구']);
    expect(neisZoneNames({ sido: '광주', sigungu: '광산구' })).toEqual(['광산구']);
  });
});

describe('지역별 예시 데이터', () => {
  const academies = getAcademies();

  it('모든 시·군·구에 학원이 있다', () => {
    const counts = new Map<string, number>();
    for (const a of academies) counts.set(`${a.region.sido} ${a.region.sigungu}`, (counts.get(`${a.region.sido} ${a.region.sigungu}`) ?? 0) + 1);
    for (const d of DISTRICTS) expect(counts.get(`${d.sido} ${d.sigungu}`), d.sigungu).toBe(academyCount(d));
  });

  it('광주 광산구·서구 검색', () => {
    for (const sigungu of ['광산구', '서구']) {
      const results = searchAcademies(academies, { ...EMPTY_FILTERS, sido: '광주', sigungu }, 'price_asc', 'monthlyTuition', { withPeers: false });
      expect(results.length, sigungu).toBeGreaterThan(0);
      expect(results.every((r) => r.academy.region.sigungu === sigungu)).toBe(true);
    }
  });
});
