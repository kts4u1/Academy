// 교육청 데이터에서 학원 찾기 · 시세 대비 위치 계산
// 검색은 시·군·구 하나 단위로 한다 (데이터 파일도 시·군·구별로 나뉘어 있다).

import { SUBJECTS } from '../data/categories';
import { DISTRICTS, findDistrict, MERGED_SIDO_NAMES, SIDO_ALIASES, type District } from '../data/regions';
import type { DataMode, DistrictData } from '../data/source';
import type { AgeGroup } from '../types';
import { courseMatches, isComparableCourse, marketFor, positionOf, type Course, type MarketRow, type PriceLevel, type RealAcademy } from './realData';

// ───────────── 시세 찾기 ─────────────

export interface MarketMatch {
  row: MarketRow;
  /** 시·군·구 시세가 없어 넓힌 범위인지 */
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
  return row ? { row, widened: row.sigungu !== sigungu } : null;
}

/** 시세 행의 범위 이름 */
export function marketScopeName(row: MarketRow, mode: DataMode, district?: { sigungu: string }): string {
  if (row.sigungu) return row.sigungu;
  if (mode === 'live' && district) return `${district.sigungu} 일대`;
  return `${row.sido} 전체`;
}

// ───────────── 검색어 해석 ─────────────

export interface ParsedQuery {
  sido?: string;
  sigungu?: string;
  subject?: string;
  /** 지역·과목으로 쓰이지 않은 나머지 낱말 (학원 이름·동·과정 이름으로 찾는다) */
  text: string;
}

const strip = (s: string) => s.replace(/(특별자치시|특별자치도|특별시|광역시|시|군|구)$/, '');

function sidoOf(token: string): string[] | null {
  if (MERGED_SIDO_NAMES[token]) return MERGED_SIDO_NAMES[token];
  for (const [sido, aliases] of Object.entries(SIDO_ALIASES)) {
    if (token === sido || aliases.includes(token)) return [sido];
  }
  return null;
}

function districtsByName(token: string, sidos: string[] | null): District[] {
  const pool = sidos ? DISTRICTS.filter((d) => sidos.includes(d.sido)) : DISTRICTS;
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

/**
 * '목동 영어', '광산구 수학', '분당 피아노 교습소' 같은 검색어에서 지역과 과목을 골라낸다.
 * 같은 이름의 구·동이 여러 곳이면 내 동네가 있는 시·도를 먼저 고른다.
 */
export function parseQuery(raw: string, home?: { sido: string; sigungu: string } | null): ParsedQuery {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  const out: ParsedQuery = { text: '' };
  const rest: string[] = [];
  let sidos: string[] | null = null;
  for (const token of tokens) {
    const s = !out.sigungu ? sidoOf(token) : null;
    if (s && !sidos) {
      sidos = s;
      continue;
    }
    if (!out.sigungu) {
      const found = districtsByName(token, sidos);
      if (found.length) {
        const pick = found.find((d) => d.sido === home?.sido && d.sigungu === home?.sigungu) ?? found.find((d) => d.sido === home?.sido) ?? found[0];
        out.sido = pick.sido;
        out.sigungu = pick.sigungu;
        continue;
      }
    }
    if (!out.subject) {
      const subject = subjectOf(token);
      if (subject) {
        out.subject = subject;
        continue;
      }
    }
    rest.push(token);
  }
  if (!out.sigungu && sidos) {
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
  /** 대표로 보여 줄 과정 (가장 싼 것) */
  best: Course | null;
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
    const best = courses[0] ?? null;
    const market = best ? marketForCourse(rows, a, best, age) : null;
    const pos = best && market ? positionOf(best.price, market.row) : null;
    hits.push({ academy: a, courses, best, market, percentile: pos?.percentile ?? null, level: pos?.level ?? null, diffFromMedian: pos?.diffFromMedian ?? null });
  }
  const byName = (x: SearchHit, y: SearchHit) => x.academy.name.localeCompare(y.academy.name, 'ko');
  // 교습비를 모르는 곳은 가격 정렬에서 늘 뒤로
  const priced = (fn: (x: SearchHit, y: SearchHit) => number) => (x: SearchHit, y: SearchHit) => {
    if (!x.best !== !y.best) return x.best ? -1 : 1;
    return fn(x, y) || byName(x, y);
  };
  const cmp: Record<SortKey, (x: SearchHit, y: SearchHit) => number> = {
    price: priced((x, y) => (x.best && y.best ? x.best.price - y.best.price : 0)),
    price_desc: priced((x, y) => (x.best && y.best ? y.best.price - x.best.price : 0)),
    value: priced((x, y) => {
      if ((x.percentile === null) !== (y.percentile === null)) return x.percentile === null ? 1 : -1;
      return (x.percentile ?? 0) - (y.percentile ?? 0) || (x.best && y.best ? x.best.price - y.best.price : 0);
    }),
    name: byName,
  };
  return hits.sort(cmp[sort]);
}

/** 같은 지역에서 같은 과목·연령을 더 싸게 가르치는 곳 */
export function cheaperAlternatives(data: DistrictData, academy: RealAcademy, course: Course, limit = 5): { academy: RealAcademy; course: Course }[] {
  if (!course.subjectId) return [];
  const age = course.ages.length === 1 ? course.ages[0] : null;
  const out: { academy: RealAcademy; course: Course }[] = [];
  for (const a of [...data.academies, ...data.unknownDistrict]) {
    if (a.id === academy.id) continue;
    const c = a.courses.filter((x) => courseMatches(x, course.subjectId, age) && x.price < course.price).sort((x, y) => x.price - y.price)[0];
    if (c) out.push({ academy: a, course: c });
  }
  return out.sort((x, y) => x.course.price - y.course.price).slice(0, limit);
}
