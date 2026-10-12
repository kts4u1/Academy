// 지역 정보: 샘플 데이터 생성, 거리 계산, 교육청(NEIS) 조회에 함께 쓴다.
// 시·군·구 목록과 좌표는 행정동 경계 데이터에서 만든 districts.ts(전국 256곳)를 쓰고,
// 여기서는 지역 물가 지수, 대표 학원가 동 이름, 교육청 조회용 행정구역명을 덧붙인다.

import { DISTRICT_SEEDS, type DistrictSeed } from './districts';

export interface District {
  sido: string;
  /** 공식 시·도 명칭 */
  sidoFull: string;
  sigungu: string;
  /** 행정구역코드 앞 5자리 (시·군·구) */
  code: string;
  dongs: string[];
  lat: number;
  lng: number;
  /** 교과 학원비 지역 지수 (1.0 = 평균) */
  priceIndex: number;
  /** 자치구·시·일반구가 아닌 군 지역 */
  isGun: boolean;
  /** 일반구·인천 새 구의 전체 동 이름 */
  dongIndex?: string[];
}

/** 시·도 이름 → NEIS 시도교육청 코드 */
export const EDU_OFFICES: { sido: string; code: string; office: string }[] = [
  { sido: '서울', code: 'B10', office: '서울특별시교육청' },
  { sido: '부산', code: 'C10', office: '부산광역시교육청' },
  { sido: '대구', code: 'D10', office: '대구광역시교육청' },
  { sido: '인천', code: 'E10', office: '인천광역시교육청' },
  // 2026-07-01 전남광주통합특별시교육청으로 통합됐지만 NEIS 는 옛 코드 F10·Q10 을 그대로 쓴다
  { sido: '광주', code: 'F10', office: '전남광주통합특별시교육청(광주)' },
  { sido: '대전', code: 'G10', office: '대전광역시교육청' },
  { sido: '울산', code: 'H10', office: '울산광역시교육청' },
  { sido: '세종', code: 'I10', office: '세종특별자치시교육청' },
  { sido: '경기', code: 'J10', office: '경기도교육청' },
  { sido: '강원', code: 'K10', office: '강원특별자치도교육청' },
  { sido: '충북', code: 'M10', office: '충청북도교육청' },
  { sido: '충남', code: 'N10', office: '충청남도교육청' },
  { sido: '전북', code: 'P10', office: '전북특별자치도교육청' },
  { sido: '전남', code: 'Q10', office: '전남광주통합특별시교육청(전남)' },
  { sido: '경북', code: 'R10', office: '경상북도교육청' },
  { sido: '경남', code: 'S10', office: '경상남도교육청' },
  { sido: '제주', code: 'T10', office: '제주특별자치도교육청' },
];

/**
 * 교과 학원비 지역 지수. 대표 학원가(대치·목동·중계·분당·평촌·수성구 등)는 높고,
 * 군 지역은 낮다. 목록에 없는 곳은 지역 유형별 기본값을 쓴다.
 */
const PRICE_INDEX: Record<string, Record<string, number>> = {
  서울: {
    강남구: 1.35, 서초구: 1.3, 송파구: 1.15, 강동구: 1.0, 양천구: 1.2, 노원구: 1.1, 용산구: 1.1, 마포구: 1.05,
    성동구: 1.05, 광진구: 1.0, 동작구: 1.0, 영등포구: 1.0, 종로구: 1.0, 중구: 0.98, 서대문구: 0.98, 성북구: 0.97,
    동대문구: 0.95, 은평구: 0.95, 강서구: 0.97, 구로구: 0.93, 관악구: 0.93, 금천구: 0.9, 중랑구: 0.9, 강북구: 0.9,
    도봉구: 0.92,
  },
  부산: { 해운대구: 1.0, 동래구: 0.96, 수영구: 0.95, 연제구: 0.93, 남구: 0.93, 부산진구: 0.92, 금정구: 0.92, 기장군: 0.88 },
  대구: { 수성구: 1.1, 중구: 0.92, 달서구: 0.9, 북구: 0.9 },
  인천: { 연수구: 1.02, 남동구: 0.92, 부평구: 0.92, 서해구: 0.93, 검단구: 0.93, 계양구: 0.9, 미추홀구: 0.9, 제물포구: 0.88, 영종구: 0.9 },
  광주: { 남구: 0.95, 서구: 0.92, 광산구: 0.92, 북구: 0.9, 동구: 0.88 },
  대전: { 서구: 0.95, 유성구: 0.97, 중구: 0.9, 동구: 0.87, 대덕구: 0.87 },
  울산: { 남구: 0.95, 중구: 0.9, 북구: 0.9, 동구: 0.88 },
  세종: { 세종시: 0.97 },
  경기: {
    '성남시 분당구': 1.15, '성남시 수정구': 0.92, '성남시 중원구': 0.92, '용인시 수지구': 1.05, '용인시 기흥구': 0.98,
    '용인시 처인구': 0.88, '수원시 영통구': 1.0, '수원시 장안구': 0.93, '수원시 권선구': 0.93, '수원시 팔달구': 0.93,
    '안양시 동안구': 1.08, '안양시 만안구': 0.92, '고양시 일산동구': 1.0, '고양시 일산서구': 0.98, '고양시 덕양구': 0.93,
    과천시: 1.1, 하남시: 1.0, '화성시 동탄구': 1.02, 광명시: 0.97, 김포시: 0.95, 군포시: 0.95, 의왕시: 0.95,
    남양주시: 0.93, 구리시: 0.93, 파주시: 0.93, '부천시 원미구': 0.94, 의정부시: 0.92, 시흥시: 0.92, 평택시: 0.92,
    '안산시 상록구': 0.9, '안산시 단원구': 0.9, 오산시: 0.9, 이천시: 0.88, 양주시: 0.88, 광주시: 0.9, 안성시: 0.85,
    포천시: 0.82, 여주시: 0.82, 동두천시: 0.82,
  },
  충북: { '청주시 흥덕구': 0.93, '청주시 서원구': 0.93, '청주시 청원구': 0.91, '청주시 상당구': 0.91 },
  충남: { '천안시 서북구': 0.94, '천안시 동남구': 0.92, 아산시: 0.9 },
  전북: { '전주시 완산구': 0.92, '전주시 덕진구': 0.92 },
  전남: { 순천시: 0.9, 목포시: 0.87, 여수시: 0.87, 광양시: 0.87 },
  경북: { '포항시 남구': 0.9, '포항시 북구': 0.9, 구미시: 0.9, 경산시: 0.88 },
  경남: { '창원시 성산구': 0.94, '창원시 의창구': 0.92, 김해시: 0.9, 양산시: 0.9, 진주시: 0.9 },
  제주: { 제주시: 0.95, 서귀포시: 0.88 },
};

const METRO = new Set(['서울', '부산', '대구', '인천', '광주', '대전', '울산']);

/** 잘 알려진 학원가·동네 이름을 앞에 두어 검색 예시("대치동 수학")가 실제로 동작하게 한다. */
const FEATURED_DONGS: Record<string, string[]> = {
  '서울 강남구': ['대치동', '역삼동', '도곡동', '개포동', '삼성동'],
  '서울 서초구': ['반포동', '서초동', '방배동', '잠원동'],
  '서울 송파구': ['잠실동', '문정동', '가락동', '방이동'],
  '서울 양천구': ['목동', '신정동', '신월동'],
  '서울 노원구': ['중계동', '상계동', '하계동', '공릉동'],
  '서울 강동구': ['명일동', '고덕동', '천호동', '암사동'],
  '서울 마포구': ['공덕동', '상암동', '망원동', '합정동'],
  '서울 광진구': ['광장동', '자양동', '구의동', '화양동'],
  '경기 성남시 분당구': ['정자동', '서현동', '수내동', '야탑동'],
  '경기 안양시 동안구': ['평촌동', '비산동', '호계동', '관양동'],
  '경기 고양시 일산동구': ['백석동', '마두동', '장항동', '풍산동'],
  '경기 용인시 수지구': ['풍덕천동', '죽전동', '상현동', '성복동'],
  '경기 화성시 동탄구': ['동탄1동', '동탄4동', '동탄6동', '동탄8동'],
  '부산 해운대구': ['좌동', '우동', '중동', '재송동'],
  '대구 수성구': ['범어동', '만촌동', '황금동', '지산동'],
  '인천 연수구': ['송도동', '연수동', '동춘동', '옥련동'],
  '광주 남구': ['봉선동', '주월동', '진월동', '월산동'],
  '광주 광산구': ['수완동', '첨단동', '신가동', '운남동'],
  '대전 서구': ['둔산동', '탄방동', '관저동', '월평동'],
  '울산 남구': ['옥동', '신정동', '무거동', '삼산동'],
};

function defaultIndex(seed: DistrictSeed, isGun: boolean): number {
  if (seed.sido === '서울') return 1.0;
  if (isGun) return METRO.has(seed.sido) ? 0.85 : 0.8;
  if (METRO.has(seed.sido)) return 0.92;
  if (seed.sido === '경기') return 0.92;
  return 0.87;
}

export const DISTRICTS: District[] = DISTRICT_SEEDS.map((seed) => {
  const isGun = seed.sigungu.endsWith('군');
  const featured = FEATURED_DONGS[`${seed.sido} ${seed.sigungu}`];
  return {
    ...seed,
    dongs: featured ?? seed.dongs,
    priceIndex: PRICE_INDEX[seed.sido]?.[seed.sigungu] ?? defaultIndex(seed, isGun),
    isGun,
  };
});

export const SIDOS: string[] = Array.from(new Set(DISTRICTS.map((x) => x.sido)));

export function districtsOf(sido: string): District[] {
  return DISTRICTS.filter((x) => x.sido === sido);
}

export function findDistrict(sido: string, sigungu: string): District | undefined {
  return DISTRICTS.find((x) => x.sido === sido && x.sigungu === sigungu);
}

export function officeCodeOf(sido: string): string | undefined {
  return EDU_OFFICES.find((o) => o.sido === sido)?.code;
}

/** 시·도 검색 별칭: '광주광역시', '광주특별시'(법정 약칭) 등으로 검색해도 찾게 한다 */
export const SIDO_ALIASES: Record<string, string[]> = {
  서울: ['서울특별시'],
  부산: ['부산광역시'],
  대구: ['대구광역시'],
  인천: ['인천광역시'],
  광주: ['광주광역시', '광주특별시'],
  대전: ['대전광역시'],
  울산: ['울산광역시'],
  세종: ['세종특별자치시'],
  경기: ['경기도'],
  강원: ['강원도', '강원특별자치도'],
  충북: ['충청북도'],
  충남: ['충청남도'],
  전북: ['전라북도', '전북특별자치도'],
  전남: ['전라남도'],
  경북: ['경상북도'],
  경남: ['경상남도'],
  제주: ['제주도', '제주특별자치도'],
};

/**
 * 통합 시·도 이름. '전남광주'는 '광주'·'전남'을 모두 품고 있어 부분 일치로 넣으면
 * '광주' 검색에 전남 학원이 섞이므로, 검색어가 이 이름과 정확히 같을 때만 쓴다.
 */
export const MERGED_SIDO_NAMES: Record<string, string[]> = {
  전남광주: ['광주', '전남'],
  전남광주통합특별시: ['광주', '전남'],
};

// 2026-07-01 인천 행정체제 개편: 중구·동구·서구 → 제물포구·영종구·서해구·검단구.
// 교육청 학원 자료에는 옛 구 이름으로 남은 곳이 많아서, 옛 이름으로도 조회한 뒤 주소로 나눠 담는다.
const INCHEON_FORMER: Record<string, string[]> = {
  제물포구: ['중구', '동구'],
  영종구: ['중구'],
  서해구: ['서구'],
  검단구: ['서구'],
};
/** 영종구가 된 옛 중구 영종·용유 지역: 법정동과 대표 도로명 */
const YEONGJONG_DONGS = ['운서동', '운남동', '운북동', '중산동', '을왕동', '남북동', '덕교동', '무의동', '영종동', '용유동'];
const YEONGJONG_ROADS = /하늘(달빛|별빛|중앙|대|바라기|해안|도시)?로|공항(동|서)?로|영종(대|해안남|해안북)?로|운서|운남|운북|중산|을왕|용유|무의|구읍|마시란|덕교|삼목|잠진|금산로/;
/** 검단구가 된 옛 서구 검단 지역 법정동 */
const GEOMDAN_DONGS = ['검단동', '대곡동', '불로동', '마전동', '금곡동', '오류동', '왕길동', '당하동', '원당동', '아라동'];

/**
 * NEIS 학원교습소정보의 행정구역명(ADMST_ZONE_NM) 후보.
 * - 일반구가 있는 시는 대부분 시 단위('성남시')로 등록되어 있지만 청주시는 구 단위('흥덕구')라서 둘 다 조회한다.
 * - 세종은 '세종특별자치시', 인천 새 구는 옛 구 이름도 함께 조회한다.
 */
export function neisZoneNames(district: Pick<District, 'sido' | 'sigungu'>): string[] {
  if (district.sido === '세종') return ['세종특별자치시'];
  const city = district.sigungu.match(/^(\S+시) (\S+구)$/);
  if (city) return [city[1], city[2]];
  if (district.sido === '인천' && INCHEON_FORMER[district.sigungu]) return [district.sigungu, ...INCHEON_FORMER[district.sigungu]];
  return [district.sigungu];
}

export interface NeisLocated {
  /** ADMST_ZONE_NM */
  sigungu: string;
  roadAddress: string;
  address: string;
}

export interface DistrictFilterResult<T> {
  rows: T[];
  /** 주소로 구를 가릴 수 없는 곳이 많아 시 전체를 돌려줬는지 */
  cityWide: boolean;
  /** 주소로 구를 가릴 수 없어 뺀 곳 수 */
  unassigned: number;
}

/** 주소 괄호 안의 법정동·읍·면 이름들: '... 123 (중동, OO빌딩)' → ['중동'] */
function addressDongs(address: string): string[] {
  const inParens = Array.from(address.matchAll(/\(([^)]*)\)/g)).map((m) => m[1]).join(',');
  return Array.from(inParens.matchAll(/([가-힣0-9]+?(?:동|읍|면|가))(?=[\s,]|$)/g)).map((m) => m[1].replace(/\d+(?=동$)/, ''));
}

/** 일반구가 있는 시의 학원 한 곳이 어느 구인지: 도로명 주소의 구 → 동 이름 → 알 수 없음(null) */
function guOfRow(r: NeisLocated, cityName: string, guDongs: Map<string, Set<string>>): string | null {
  if (guDongs.has(r.sigungu)) return r.sigungu; // 청주처럼 교육청 자료가 구 단위인 경우
  const m = r.roadAddress.match(new RegExp(`${cityName}\\s+(\\S+구)\\s`));
  if (m && guDongs.has(m[1])) return m[1];
  const dongs = addressDongs(r.address);
  const hits = new Set<string>();
  for (const [gu, set] of guDongs) if (dongs.some((d) => set.has(d))) hits.add(gu);
  return hits.size === 1 ? Array.from(hits)[0] : null;
}

/**
 * 교육청 자료를 앱의 시·군·구 하나에 맞게 거른다.
 * - 일반구: 교육청 자료는 대부분 시 단위라서 학원마다 주소의 구 이름이나 동 이름으로 구를 정한다.
 *   구를 알 수 없는 곳이 절반을 넘으면(예: 2026년에 일반구가 생긴 화성시) 시 전체를 돌려주고 cityWide 로 알린다.
 * - 인천: 옛 중구·서구 학원을 주소의 법정동·도로명으로 새 구에 나눠 담고, 판단할 수 없으면 뺀다.
 */
export function filterNeisForDistrict<T extends NeisLocated>(rows: T[], district: Pick<District, 'sido' | 'sigungu'>): DistrictFilterResult<T> {
  const city = district.sigungu.match(/^(\S+시) (\S+구)$/);
  if (city) {
    const [, cityName, gu] = city;
    const guDongs = new Map<string, Set<string>>();
    for (const d of DISTRICTS) {
      const m = d.sido === district.sido && d.sigungu.match(/^(\S+시) (\S+구)$/);
      if (m && m[1] === cityName) guDongs.set(m[2], new Set(d.dongIndex ?? d.dongs));
    }
    const assigned = rows.map((r) => ({ r, gu: guOfRow(r, cityName, guDongs) }));
    const unknown = assigned.filter((a) => a.gu === null).length;
    if (rows.length > 0 && unknown / rows.length > 0.5) return { rows, cityWide: true, unassigned: 0 };
    return { rows: assigned.filter((a) => a.gu === gu).map((a) => a.r), cityWide: false, unassigned: unknown };
  }
  if (district.sido === '인천' && INCHEON_FORMER[district.sigungu]) {
    const target = district.sigungu;
    const has = (r: T, dongs: string[]) => dongs.some((d) => r.address.includes(d));
    const hasAnyDong = (r: T) => addressDongs(r.address).length > 0;
    let unassigned = 0;
    const out = rows.filter((r) => {
      if (r.sigungu === target) return true;
      let to: string | null = null;
      if (r.sigungu === '동구') to = '제물포구';
      else if (r.sigungu === '중구') to = has(r, YEONGJONG_DONGS) || YEONGJONG_ROADS.test(r.roadAddress) ? '영종구' : hasAnyDong(r) ? '제물포구' : null;
      else if (r.sigungu === '서구') to = has(r, GEOMDAN_DONGS) ? '검단구' : hasAnyDong(r) ? '서해구' : null;
      if (to === null && INCHEON_FORMER[target].includes(r.sigungu)) unassigned++;
      return to === target;
    });
    return { rows: out, cityWide: false, unassigned };
  }
  return { rows, cityWide: false, unassigned: 0 };
}
