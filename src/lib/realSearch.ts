// 교육청 데이터에서 학원 찾기 · 시세 대비 위치 계산
// 검색은 시·군·구 하나 단위로 한다 (데이터 파일도 시·군·구별로 나뉘어 있다).

import { SUBJECTS } from '../data/categories';
import { DISTRICTS, findDistrict, MERGED_SIDO_NAMES, SIDO_ALIASES, type District } from '../data/regions';
import type { DataMode, DistrictData } from '../data/source';
import type { AgeGroup } from '../types';
import { courseMatches, isComparableCourse, marketFor, positionOf, representativeCourse, type Course, type MarketRow, type PriceLevel, type RealAcademy } from './realData';

// ───────────── 시세 찾기 ─────────────

export interface MarketMatch {
  row: MarketRow;
  /** 학원이 있는 시·군·구가 아닌 더 넓은 범위와 비교했는지 (표본 부족, 또는 구 미상 학원) */
  widened: boolean;
}

/**
 * 과정 하나에 맞는 시세. 대상 연령이 하나로 정해진 과정은 그 연령 시세와만 비교하고
 * (고등 수학을 전체 연령 시세와 견주면 늘 비싸 보이므로), 대상이 없거나 여럿이면 과목 전체 시세를 쓴다.
 * 시·군·구에 표본이 부족하면 시·도 전체(브라우저에서 받은 경우는 받은 지역 전체)로 넓힌다.
 */
export function marketForCourse(rows: MarketRow[], academy: Pick<RealAcademy, 'sido' | 'sigungu' | 'unassigned'>, course: Pick<Course, 'subjectId' | 'ages'>, ageHint?: AgeGroup | null): MarketMatch | null {
  if (!course.subjectId) return null;
  const sigungu = academy.unassigned ? '' : academy.sigungu;
  const age = ageHint ?? (course.ages.length === 1 ? course.ages[0] : null);
  const row = marketFor(rows, academy.sido, sigungu, course.subjectId, age);
  return row ? { row, widened: Boolean(academy.unassigned) || row.sigungu !== academy.sigungu } : null;
}

/**
 * 시세 행의 범위 이름. 브라우저에서 지역별로 받은 경우의 넓은 범위는 시·도 전체가 아니라
 * 그동안 받은 지역(과 그 시의 구 미상 학원)만 합친 것이라 그렇게 부른다.
 */
export function marketScopeName(row: MarketRow, mode: DataMode): string {
  if (row.sigungu) return row.sigungu;
  return mode === 'live' ? '받은 지역 전체' : `${row.sido} 전체`;
}

// ───────────── 검색어 해석 ─────────────

export interface ParsedQuery {
  sido?: string;
  sigungu?: string;
  subject?: string;
  age?: AgeGroup;
  /** 지역·과목·대상으로 쓰이지 않은 나머지 낱말 (학원 이름·동·과정 이름으로 찾는다) */
  text: string;
}

const strip = (s: string) => s.replace(/(특별자치시|특별자치도|특별시|광역시|시|군|구)$/, '');

/** 흔히 쓰는 시·도 줄임말 ('제주시'·'세종시'·'광주시'는 시·군·구 이름이라 넣지 않는다) */
const SHORT_SIDO: Record<string, string> = { 서울시: '서울', 부산시: '부산', 대구시: '대구', 인천시: '인천', 대전시: '대전', 울산시: '울산' };

/** 행정구역 이름이 아니지만 지역 이름으로 흔히 쓰는 말 */
const AREA_ALIASES: Record<string, string[]> = {
  일산: ['경기|고양시 일산동구', '경기|고양시 일산서구'],
  마산: ['경남|창원시 마산합포구', '경남|창원시 마산회원구'],
};

const AGE_WORDS: Record<string, AgeGroup> = {
  유아: 'preschool',
  유치부: 'preschool',
  미취학: 'preschool',
  초등: 'elementary',
  초등학생: 'elementary',
  초등부: 'elementary',
  중등: 'middle',
  중학생: 'middle',
  중등부: 'middle',
  고등: 'high',
  고등학생: 'high',
  고교: 'high',
  고등부: 'high',
  성인: 'adult',
  직장인: 'adult',
};

/** 검색에 뜻이 없는 말: 남겨 두면 이름에 그 글자가 있는 곳만 남는다 */
const GENERIC_WORDS = new Set(['학원', '교습소', '레슨', '수업', '과외', '반', '강좌', '교실', '전문', '추천', '근처', '가격', '학원비', '교습비', '시세', '잘하는', '저렴한', '싼']);

function sidoOf(token: string): string[] | null {
  if (MERGED_SIDO_NAMES[token]) return MERGED_SIDO_NAMES[token];
  if (SHORT_SIDO[token]) return [SHORT_SIDO[token]];
  for (const [sido, aliases] of Object.entries(SIDO_ALIASES)) {
    if (token === sido || aliases.includes(token)) return [sido];
  }
  return null;
}

function districtsByName(token: string, sidos: string[] | null): District[] {
  const pool = sidos ? DISTRICTS.filter((d) => sidos.includes(d.sido)) : DISTRICTS;
  if (AREA_ALIASES[token]) return pool.filter((d) => AREA_ALIASES[token].includes(`${d.sido}|${d.sigungu}`));
  const t = token.replace(/\s/g, '');
  const exact = pool.filter((d) => {
    const parts = d.sigungu.split(' ');
    return d.sigungu.replace(/\s/g, '') === t || parts.includes(t) || (t.length >= 2 && parts.some((p) => strip(p) === t && strip(p).length >= 2));
  });
  if (exact.length) return exact;
  // 동 이름: '목동', '대치동', '대치'
  if (t.length < 2) return [];
  return pool.filter((d) => d.dongs.some((dong) => dong === t || dong.replace(/\d+(?=동$)/, '') === t || dong === `${t}동`));
}

function subjectOf(token: string): string | undefined {
  const t = token.toLowerCase();
  const exact = SUBJECTS.find((s) => s.name === token || s.id === t);
  if (exact) return exact.id;
  return SUBJECTS.find((s) => s.keywords.some((k) => k.toLowerCase() === t))?.id;
}

/** '피아노학원' → '피아노', '학원' → '' */
function cleanToken(token: string): string {
  if (GENERIC_WORDS.has(token)) return '';
  const stem = token.replace(/(학원|교습소)$/, '');
  return stem.length >= 2 ? stem : token;
}

/**
 * '목동 영어', '성남시 중원구 수학', '서울시 강남구 고등 영어', '분당 피아노학원' 같은 검색어에서
 * 지역·과목·대상을 골라낸다. 지역 낱말이 여럿이면 차례로 좁히고('성남시' → '중원구'),
 * 같은 이름의 구·동이 여러 곳이면 내 동네가 있는 시·도를 먼저 고른다.
 */
export function parseQuery(raw: string, home?: { sido: string; sigungu: string } | null): ParsedQuery {
  const words = raw.trim().split(/\s+/).map(cleanToken).filter(Boolean);
  // '광주시 광산구': 경기 광주시가 아니라 광주광역시
  const tokens = words.map((w, i) => (w === '광주시' && ['동구', '서구', '남구', '북구', '광산구'].includes(words[i + 1] ?? '') ? '광주' : w));
  const out: ParsedQuery = { text: '' };
  const rest: string[] = [];
  let sidos: string[] | null = null;
  let candidates: District[] | null = null;
  for (const token of tokens) {
    if (!out.age && AGE_WORDS[token]) {
      out.age = AGE_WORDS[token];
      continue;
    }
    const s = sidoOf(token);
    if (s) {
      sidos ??= s;
      if (candidates) candidates = candidates.filter((d) => s.includes(d.sido));
      continue;
    }
    const subject = subjectOf(token);
    if (subject && (!out.subject || out.subject === subject)) {
      out.subject = subject;
      continue;
    }
    const found = districtsByName(token, sidos);
    if (found.length) {
      const narrowed: District[] = candidates ? candidates.filter((c) => found.includes(c)) : found;
      if (narrowed.length) {
        candidates = narrowed;
        continue;
      }
    }
    rest.push(token);
  }
  if (candidates?.length) {
    const pick =
      candidates.find((d) => d.sido === home?.sido && d.sigungu === home?.sigungu) ?? candidates.find((d) => d.sido === home?.sido) ?? candidates[0];
    out.sido = pick.sido;
    out.sigungu = pick.sigungu;
  } else if (sidos) {
    const sido = home && sidos.includes(home.sido) ? home.sido : sidos[0];
    out.sido = sido;
    out.sigungu = home && home.sido === sido && findDistrict(home.sido, home.sigungu) ? home.sigungu : DISTRICTS.find((d) => d.sido === sido)?.sigungu;
  }
  out.text = rest.join(' ');
  return out;
}

// ───────────── 검색 ─────────────

export interface SearchFilters {
  text: string;
  subject: string;
  age: AgeGroup | '';
  kind: '' | '학원' | '교습소';
  pricedOnly: boolean;
  /** 주소로 구를 정하지 못한 같은 시 학원도 보기 */
  includeUnknown: boolean;
}

export const EMPTY_FILTERS: SearchFilters = { text: '', subject: '', age: '', kind: '', pricedOnly: false, includeUnknown: true };

export type SortKey = 'value' | 'price' | 'price_desc' | 'name';

export const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: 'price', label: '교습비 낮은 순' },
  { id: 'value', label: '시세 대비 저렴한 순' },
  { id: 'price_desc', label: '교습비 높은 순' },
  { id: 'name', label: '이름순' },
];

export interface SearchHit {
  academy: RealAcademy;
  /** 조건에 맞는 비교 가능한 과정 (싼 순) */
  courses: Course[];
  /** 대표 과정: 맞는 과정 가운데 금액이 가운데인 것. 시세도 학원마다 이 금액으로 계산한다 */
  rep: Course | null;
  market: MarketMatch | null;
  percentile: number | null;
  level: PriceLevel | null;
  diffFromMedian: number | null;
}

function textMatches(a: RealAcademy, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const hay = [a.name, a.address, a.dong, a.realm, a.category, a.kind, ...a.courses.map((c) => c.name), ...a.subjects.map((id) => SUBJECTS.find((s) => s.id === id)?.name ?? '')]
    .join(' ')
    .toLowerCase();
  return tokens.every((t) => hay.includes(t));
}

export function searchAcademies(data: DistrictData, filters: SearchFilters, rows: MarketRow[], sort: SortKey): SearchHit[] {
  const pool = filters.includeUnknown ? [...data.academies, ...data.unknownDistrict] : data.academies;
  const tokens = filters.text.toLowerCase().split(/\s+/).filter(Boolean);
  const age = filters.age || null;
  const hits: SearchHit[] = [];
  for (const a of pool) {
    // 체육시설은 체육 종목을 고르거나 이름으로 찾을 때만 보여 준다 (학원 목록에 섞이지 않게)
    if (a.source && !filters.subject && tokens.length === 0) continue;
    if (filters.kind && a.kind !== filters.kind) continue;
    if (!textMatches(a, tokens)) continue;
    const comparable = a.courses.filter(isComparableCourse);
    const courses = comparable.filter((c) => courseMatches(c, filters.subject || null, age)).sort((x, y) => x.price - y.price);
    if (filters.subject || age) {
      // 과목·연령을 고르면: 맞는 과정이 있거나, 교습비를 공개하지 않았지만 과목이 맞는 곳
      const unknownPrice = comparable.length === 0 && (!filters.subject || a.subjects.includes(filters.subject));
      if (courses.length === 0 && !unknownPrice) continue;
    }
    if (filters.pricedOnly && courses.length === 0) continue;
    // 바우처 한도에 맞춘 금액보다 실제 금액을 대표로 보여 준다
    const rep = representativeCourse(courses.some((c) => !c.voucherCap) ? courses.filter((c) => !c.voucherCap) : courses);
    const market = rep ? marketForCourse(rows, a, rep, age) : null;
    const pos = rep && market && !rep.voucherCap ? positionOf(rep.price, market.row) : null;
    hits.push({ academy: a, courses, rep, market, percentile: pos?.percentile ?? null, level: pos?.level ?? null, diffFromMedian: pos?.diffFromMedian ?? null });
  }
  const byName = (x: SearchHit, y: SearchHit) => x.academy.name.localeCompare(y.academy.name, 'ko');
  // 교습비를 모르는 곳은 가격 정렬에서 늘 뒤로
  const priced = (fn: (x: SearchHit, y: SearchHit) => number) => (x: SearchHit, y: SearchHit) => {
    if (!x.rep !== !y.rep) return x.rep ? -1 : 1;
    return fn(x, y) || byName(x, y);
  };
  const cmp: Record<SortKey, (x: SearchHit, y: SearchHit) => number> = {
    price: priced((x, y) => (x.rep && y.rep ? x.rep.price - y.rep.price : 0)),
    price_desc: priced((x, y) => (x.rep && y.rep ? y.rep.price - x.rep.price : 0)),
    value: priced((x, y) => {
      if ((x.percentile === null) !== (y.percentile === null)) return x.percentile === null ? 1 : -1;
      return (x.percentile ?? 0) - (y.percentile ?? 0) || (x.rep && y.rep ? x.rep.price - y.rep.price : 0);
    }),
    name: byName,
  };
  return hits.sort(cmp[sort]);
}

/**
 * 같은 지역에서 같은 과목·대상을 더 싸게 가르치는 곳.
 * 대상이 정해진 과정이면 대상이 겹치는 과정만 본다 (고등반을 유아반 금액과 견주지 않게).
 */
export function cheaperAlternatives(data: DistrictData, academy: RealAcademy, course: Course, limit = 5): { academy: RealAcademy; course: Course }[] {
  if (!course.subjectId) return [];
  const sameAge = (x: Course) => course.ages.length === 0 || x.ages.some((a) => course.ages.includes(a));
  const out: { academy: RealAcademy; course: Course }[] = [];
  for (const a of [...data.academies, ...data.unknownDistrict]) {
    if (a.id === academy.id) continue;
    const c = a.courses.filter((x) => courseMatches(x, course.subjectId) && sameAge(x) && x.price < course.price).sort((x, y) => x.price - y.price)[0];
    if (c) out.push({ academy: a, course: c });
  }
  return out.sort((x, y) => x.course.price - y.course.price).slice(0, limit);
}
