// 지역 정보: 시·군·구 목록, 교육청(NEIS) 조회용 행정구역명, 교육청 자료를 앱의 시·군·구에 배정하는 규칙.
// 시·군·구 목록과 좌표는 행정동 경계 데이터에서 만든 districts.ts(전국 256곳)를 쓴다.

import { DISTRICT_SEEDS } from './districts';

export interface District {
  sido: string;
  /** 공식 시·도 명칭 */
  sidoFull: string;
  sigungu: string;
  /** 행정구역코드 앞 5자리 (시·군·구) */
  code: string;
  /** 행정동 이름 전체 (숫자 제거: 대치1동 → 대치동) */
  dongs: string[];
  lat: number;
  lng: number;
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

export const DISTRICTS: District[] = DISTRICT_SEEDS;

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
  /** 이 시·군·구로 배정된 곳 + 구를 정하지 못한 같은 시 학원 */
  rows: T[];
  /** 구를 정하지 못한 곳이 절반을 넘어 시 전체 기준으로 봐야 하는지 */
  cityWide: boolean;
  /** 구를 정하지 못한 곳 수 */
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

export type NeisResolution = { sigungu: string } | { bucket: string };

/** 일반구가 있는 시 → 구 이름 → 그 구의 동 이름들 */
function cityGuDongs(sido: string, cityName: string): Map<string, Set<string>> {
  const guDongs = new Map<string, Set<string>>();
  for (const d of DISTRICTS) {
    const m = d.sido === sido && d.sigungu.match(/^(\S+시) (\S+구)$/);
    if (m && m[1] === cityName) guDongs.set(m[2], new Set(d.dongs));
  }
  return guDongs;
}

/**
 * 교육청 자료 한 건을 앱의 시·군·구에 배정한다.
 * - 대부분은 행정구역명(ADMST_ZONE_NM)이 시·군·구 이름과 같다.
 * - 일반구가 있는 시는 교육청 자료가 시 단위('성남시')라서 주소의 구·동 이름으로 구를 정한다. 청주는 구 단위('흥덕구')다.
 * - 인천 옛 중구·동구·서구는 주소의 법정동·도로명으로 새 구에 나눈다.
 * 구를 정할 수 없으면 bucket(예: '성남시')으로 따로 모은다.
 */
export function resolveNeisDistrict(sido: string, row: NeisLocated): NeisResolution {
  const zone = row.sigungu.trim();
  if (sido === '세종') return { sigungu: '세종시' };
  if (findDistrict(sido, zone)) return { sigungu: zone };
  // 청주처럼 구 이름만 있는 경우: 같은 시·도에서 '○○시 {구}'가 하나뿐이면 그곳
  const byGu = DISTRICTS.filter((d) => d.sido === sido && d.sigungu.endsWith(` ${zone}`));
  if (byGu.length === 1) return { sigungu: byGu[0].sigungu };
  // 일반구가 있는 시
  const guDongs = cityGuDongs(sido, zone);
  if (guDongs.size > 0) {
    const gu = guOfRow(row, zone, guDongs);
    return gu ? { sigungu: `${zone} ${gu}` } : { bucket: zone };
  }
  if (sido === '인천' && ['중구', '동구', '서구'].includes(zone)) {
    const has = (dongs: string[]) => dongs.some((d) => row.address.includes(d));
    const hasAnyDong = addressDongs(row.address).length > 0;
    if (zone === '동구') return { sigungu: '제물포구' };
    if (zone === '중구') {
      if (has(YEONGJONG_DONGS) || YEONGJONG_ROADS.test(row.roadAddress)) return { sigungu: '영종구' };
      return hasAnyDong ? { sigungu: '제물포구' } : { bucket: '인천 옛 중구' };
    }
    if (has(GEOMDAN_DONGS)) return { sigungu: '검단구' };
    return hasAnyDong ? { sigungu: '서해구' } : { bucket: '인천 옛 서구' };
  }
  return { bucket: zone || '지역 미상' };
}

/** 이 버킷의 학원이 이 시·군·구일 수도 있는지 (구를 정하지 못한 같은 시 학원) */
export function bucketsFor(district: Pick<District, 'sido' | 'sigungu'>): string[] {
  const city = district.sigungu.match(/^(\S+시) \S+구$/);
  if (city) return [city[1]];
  if (district.sido === '인천' && (district.sigungu === '영종구' || district.sigungu === '제물포구')) return ['인천 옛 중구'];
  if (district.sido === '인천' && (district.sigungu === '서해구' || district.sigungu === '검단구')) return ['인천 옛 서구'];
  return [];
}

/**
 * 교육청 자료를 앱의 시·군·구 하나에 맞게 거른다 (브라우저에서 한 지역만 바로 받을 때).
 * 구를 정하지 못한 같은 시 학원도 함께 돌려주고, 그런 곳이 절반을 넘으면(예: 2026년에 일반구가 생긴 화성시) cityWide 로 알린다.
 * 매주 만드는 정적 데이터(loadStaticDistrict)와 같은 규칙이다.
 */
export function filterNeisForDistrict<T extends NeisLocated>(rows: T[], district: Pick<District, 'sido' | 'sigungu'>): DistrictFilterResult<T> {
  const resolved = rows.map((r) => ({ r, res: resolveNeisDistrict(district.sido, r) }));
  const mine = resolved.filter((x) => 'sigungu' in x.res && x.res.sigungu === district.sigungu).map((x) => x.r);
  const buckets = new Set(bucketsFor(district));
  const unknown = resolved.filter((x) => 'bucket' in x.res && buckets.has(x.res.bucket)).map((x) => x.r);
  const cityWide = unknown.length > 0 && unknown.length / (unknown.length + mine.length) > 0.5;
  return { rows: [...mine, ...unknown], cityWide, unassigned: unknown.length };
}
