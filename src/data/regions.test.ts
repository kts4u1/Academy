import { describe, expect, it } from 'vitest';
import { bucketsFor, districtFromAddress, DISTRICTS, districtsOf, EDU_OFFICES, filterNeisForDistrict, findDistrict, neisZoneNames, resolveNeisDistrict, SIDOS } from './regions';

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

  it('좌표는 대한민국 범위 안, 동 이름이 있다', () => {
    for (const d of DISTRICTS) {
      expect(d.lat, d.sigungu).toBeGreaterThan(33);
      expect(d.lat, d.sigungu).toBeLessThan(38.7);
      expect(d.lng, d.sigungu).toBeGreaterThan(124.5);
      expect(d.lng, d.sigungu).toBeLessThan(131);
      expect(d.dongs.length, d.sigungu).toBeGreaterThanOrEqual(1);
    }
  });

  it('교육청 조회용 행정구역명', () => {
    // 교육청 자료는 대부분 시 단위, 청주만 구 단위라 둘 다 조회한다
    expect(neisZoneNames({ sido: '경기', sigungu: '성남시 분당구' })).toEqual(['성남시', '분당구']);
    expect(neisZoneNames({ sido: '충북', sigungu: '청주시 흥덕구' })).toEqual(['청주시', '흥덕구']);
    expect(neisZoneNames({ sido: '세종', sigungu: '세종시' })).toEqual(['세종특별자치시']);
    expect(neisZoneNames({ sido: '인천', sigungu: '서해구' })).toEqual(['서해구', '서구']);
    expect(neisZoneNames({ sido: '광주', sigungu: '광산구' })).toEqual(['광산구']);
  });
});

const row = (sigungu: string, address: string, roadAddress = address.replace(/,.*$/, '')) => ({ sigungu, address, roadAddress });

describe('교육청 자료 → 앱 시·군·구 배정', () => {
  it('자치구·시·군은 이름 그대로', () => {
    expect(resolveNeisDistrict('서울', row('강남구', '서울특별시 강남구 선릉로 38, 4층 (개포동)'))).toEqual({ sigungu: '강남구' });
    expect(resolveNeisDistrict('광주', row('광산구', '광주광역시 광산구 수완로 1 (수완동)'))).toEqual({ sigungu: '광산구' });
    expect(resolveNeisDistrict('세종', row('세종특별자치시', '세종특별자치시 한누리대로 1 (나성동)'))).toEqual({ sigungu: '세종시' });
  });

  it('일반구가 있는 시는 도로명의 구 → 동 이름으로 구를 찾고, 못 찾으면 시 이름 버킷', () => {
    expect(resolveNeisDistrict('경기', row('성남시', '경기도 성남시 분당구 황새울로 1, 2층 (서현동)'))).toEqual({ sigungu: '성남시 분당구' });
    expect(resolveNeisDistrict('경기', row('성남시', '경기도 성남시 황새울로 1, 2층 (서현동)'))).toEqual({ sigungu: '성남시 분당구' });
    expect(resolveNeisDistrict('경기', row('성남시', '경기도 성남시 어딘가로 1'))).toEqual({ bucket: '성남시' });
  });

  it('화성시 동탄구는 도로명·법정동 단서로 찾는다', () => {
    expect(resolveNeisDistrict('경기', row('화성시', '경기도 화성시 동탄대로 1, 3층'))).toEqual({ sigungu: '화성시 동탄구' });
    expect(resolveNeisDistrict('경기', row('화성시', '경기도 화성시 노작로 1, 2층 (반송동)'))).toEqual({ sigungu: '화성시 동탄구' });
    // 도로명 주소 본문의 읍·면으로도 구를 찾는다
    expect(resolveNeisDistrict('경기', row('화성시', '경기도 화성시 봉담읍 어딘가로 1'))).toEqual({ sigungu: '화성시 효행구' });
    expect(resolveNeisDistrict('경기', row('화성시', '경기도 화성시 향남읍 행정중앙1로 14'))).toEqual({ sigungu: '화성시 만세구' });
  });

  it('청주는 교육청 자료가 구 단위', () => {
    expect(resolveNeisDistrict('충북', row('흥덕구', '충청북도 청주시 흥덕구 대농로 1 (복대동)'))).toEqual({ sigungu: '청주시 흥덕구' });
  });

  it('인천 옛 중구·서구는 주소로 새 구에 나눈다', () => {
    expect(resolveNeisDistrict('인천', row('중구', '인천광역시 중구 하늘중앙로 1 (운서동)'))).toEqual({ sigungu: '영종구' });
    expect(resolveNeisDistrict('인천', row('중구', '인천광역시 중구 신포로 1 (신포동)'))).toEqual({ sigungu: '제물포구' });
    expect(resolveNeisDistrict('인천', row('서구', '인천광역시 서구 완정로 1 (마전동)'))).toEqual({ sigungu: '검단구' });
    expect(resolveNeisDistrict('인천', row('서구', '인천광역시 서구 서곶로 1 (심곡동)'))).toEqual({ sigungu: '서해구' });
    expect(resolveNeisDistrict('인천', row('서구', '인천광역시 서구 서곶로 1'))).toEqual({ bucket: '인천 옛 서구' });
  });

  it('행정구역명이 비었거나 옛 이름이면 도로명 주소로 찾는다', () => {
    expect(resolveNeisDistrict('서울', row('', '서울특별시 서대문구 통일로 197'))).toEqual({ sigungu: '서대문구' });
    expect(resolveNeisDistrict('경남', row('창원시(폐지)', '경상남도 창원시 마산회원구 3·15대로 1'))).toEqual({ sigungu: '창원시 마산회원구' });
    expect(districtFromAddress('전남광주통합특별시 광산구 수완로 1')?.sido).toBe('광주');
    expect(districtFromAddress('어딘가 이상한 주소')).toBeUndefined();
  });

  it('없어진 연기군은 세종시로, 행정구역명 없는 화성시 주소는 동으로 구를 찾거나 화성시 구 미상으로', () => {
    expect(resolveNeisDistrict('충남', row('연기군', '충청남도 연기군 조치원읍 충현로 77'))).toEqual({ sigungu: '세종시', sido: '세종' });
    expect(resolveNeisDistrict('경기', row('', '경기도 화성시 큰나래2길 61 305호(새솔동)'))).toEqual({ sigungu: '화성시 만세구' });
    expect(resolveNeisDistrict('경기', row('', '경기도 화성시 어딘가로 1'))).toEqual({ bucket: '화성시' });
    expect(districtFromAddress('세종특별자치시 한누리대로 1')?.sigungu).toBe('세종시');
  });

  it('다른 시·도로 옮겨 간 군위군은 대구로', () => {
    expect(resolveNeisDistrict('경북', row('군위군', '경상북도 군위군 군위읍 중앙길 1'))).toEqual({ sigungu: '군위군', sido: '대구' });
  });

  it('구 미상 버킷은 같은 시의 각 구에서 함께 보인다', () => {
    expect(bucketsFor({ sido: '경기', sigungu: '성남시 수정구' })).toEqual(['성남시']);
    expect(bucketsFor({ sido: '인천', sigungu: '검단구' })).toEqual(['인천 옛 서구']);
    expect(bucketsFor({ sido: '서울', sigungu: '강남구' })).toEqual([]);
  });

  it('한 지역만 받을 때도 정적 데이터와 같은 규칙으로 거른다', () => {
    const rows = [
      row('성남시', '경기도 성남시 분당구 황새울로 1 (서현동)'),
      row('성남시', '경기도 성남시 수정구 수정로 1 (태평동)'),
      row('성남시', '경기도 성남시 어딘가로 1'),
    ];
    const r = filterNeisForDistrict(rows, { sido: '경기', sigungu: '성남시 분당구' });
    expect(r.rows).toEqual([rows[0], rows[2]]);
    expect(r.unassigned).toBe(1);
    expect(r.cityWide).toBe(false);
    const mostlyUnknown = filterNeisForDistrict([rows[0], rows[2], rows[2]], { sido: '경기', sigungu: '성남시 분당구' });
    expect(mostlyUnknown.cityWide).toBe(true);
  });
});
