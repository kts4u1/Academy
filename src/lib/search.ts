import type { Academy, AgeGroup, CategoryGroup, ClassType, PricePlan } from '../types';
import { SUBJECT_MAP } from '../data/categories';
import { MERGED_SIDO_NAMES, SIDO_ALIASES } from '../data/regions';
import { distanceKm } from './geo';
import { comparePlanToPeers, sessionBucket, type PeerComparison } from './market';
import { computeCost, type CostBreakdown, type CostOptions, type Metric } from './pricing';

export interface SearchFilters {
  q: string;
  group: CategoryGroup | 'all';
  subjectIds: string[];
  sido: string;
  sigungu: string;
  ages: AgeGroup[];
  classTypes: ClassType[];
  /** 1, 2, 3, 5(=주5회 이상) */
  sessions: number[];
  priceMin: number | null;
  priceMax: number | null;
  shuttle: boolean;
  trial: boolean;
  publicOnly: boolean;
  verifiedOnly: boolean;
  discountOnly: boolean;
  minRating: number;
  maxDistanceKm: number | null;
}

export const EMPTY_FILTERS: SearchFilters = {
  q: '',
  group: 'all',
  subjectIds: [],
  sido: '',
  sigungu: '',
  ages: [],
  classTypes: [],
  sessions: [],
  priceMin: null,
  priceMax: null,
  shuttle: false,
  trial: false,
  publicOnly: false,
  verifiedOnly: false,
  discountOnly: false,
  minRating: 0,
  maxDistanceKm: null,
};

export type SortKey = 'price_asc' | 'price_desc' | 'value' | 'rating' | 'distance' | 'reviews';

export const SORTS: { id: SortKey; label: string }[] = [
  { id: 'price_asc', label: '가격 낮은순' },
  { id: 'value', label: '시세 대비 저렴순' },
  { id: 'price_desc', label: '가격 높은순' },
  { id: 'rating', label: '평점순' },
  { id: 'reviews', label: '리뷰 많은순' },
  { id: 'distance', label: '가까운순' },
];

export interface Origin {
  lat: number;
  lng: number;
}

export interface SearchResult {
  academy: Academy;
  /** 필터 조건에 맞는 요금제 중 선택한 기준으로 가장 저렴한 것 */
  plan: PricePlan;
  cost: CostBreakdown;
  value: number;
  matchingPlans: number;
  distanceKm: number | null;
  peer: PeerComparison | null;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '');
}

/** 검색어 토큰이 모두 학원 정보 어딘가에 포함되면 일치 (예: "대치동 수학", "강남 주짓수") */
export function matchesKeyword(academy: Academy, q: string): boolean {
  let tokens = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  // '전남광주통합특별시'처럼 통합 시·도 이름은 정확히 같을 때만 광주·전남 둘 다에 맞춘다
  const merged = tokens.filter((t) => MERGED_SIDO_NAMES[t]);
  if (merged.some((t) => !MERGED_SIDO_NAMES[t].includes(academy.region.sido))) return false;
  tokens = tokens.filter((t) => !MERGED_SIDO_NAMES[t]);
  if (tokens.length === 0) return true;
  const haystack = normalize(
    [
      academy.name,
      academy.region.sido,
      ...(SIDO_ALIASES[academy.region.sido] ?? []),
      academy.region.sigungu,
      academy.region.dong,
      ...academy.features,
      ...academy.plans.map((p) => p.name),
      ...academy.subjectIds.flatMap((id) => [SUBJECT_MAP[id]?.name ?? '', ...(SUBJECT_MAP[id]?.keywords ?? [])]),
    ].join(' '),
  );
  return tokens.every((t) => haystack.includes(normalize(t)));
}

export function planMatches(plan: PricePlan, f: Pick<SearchFilters, 'subjectIds' | 'ages' | 'classTypes' | 'sessions' | 'group'>): boolean {
  if (f.subjectIds.length && !f.subjectIds.includes(plan.subjectId)) return false;
  if (f.group !== 'all' && SUBJECT_MAP[plan.subjectId]?.group !== f.group) return false;
  if (f.ages.length && !plan.targets.some((a) => f.ages.includes(a))) return false;
  if (f.classTypes.length && !f.classTypes.includes(plan.classType)) return false;
  if (f.sessions.length && !f.sessions.includes(sessionBucket(plan.sessionsPerWeek))) return false;
  return true;
}

export function searchAcademies(
  academies: Academy[],
  filters: SearchFilters,
  sort: SortKey,
  metric: Metric,
  options: { origin?: Origin | null; cost?: CostOptions; withPeers?: boolean } = {},
): SearchResult[] {
  const { origin = null, cost: costOptions = {}, withPeers = true } = options;
  const results: SearchResult[] = [];

  for (const academy of academies) {
    if (filters.sido && academy.region.sido !== filters.sido) continue;
    if (filters.sigungu && academy.region.sigungu !== filters.sigungu) continue;
    if (filters.shuttle && !academy.shuttle) continue;
    if (filters.trial && !academy.trialClass.available) continue;
    if (filters.publicOnly && !academy.isPublic) continue;
    if (filters.verifiedOnly && academy.priceSource !== 'education_office') continue;
    if (filters.discountOnly && academy.discounts.length === 0) continue;
    if (academy.rating < filters.minRating) continue;
    if (!matchesKeyword(academy, filters.q)) continue;

    const distance = origin ? distanceKm(origin.lat, origin.lng, academy.lat, academy.lng) : null;
    if (filters.maxDistanceKm != null && distance != null && distance > filters.maxDistanceKm) continue;

    const plans = academy.plans.filter((p) => planMatches(p, filters));
    if (plans.length === 0) continue;

    let best: { plan: PricePlan; cost: CostBreakdown; value: number } | null = null;
    for (const plan of plans) {
      const cost = computeCost(academy, plan, costOptions);
      const value = cost[metric];
      if (!best || value < best.value) best = { plan, cost, value };
    }
    if (!best) continue;
    if (filters.priceMin != null && best.value < filters.priceMin) continue;
    if (filters.priceMax != null && best.value > filters.priceMax) continue;

    results.push({
      academy,
      plan: best.plan,
      cost: best.cost,
      value: best.value,
      matchingPlans: plans.length,
      distanceKm: distance,
      peer: withPeers ? comparePlanToPeers(academies, academy, best.plan, metric, best.cost) : null,
    });
  }

  const byPrice = (a: SearchResult, b: SearchResult) => a.value - b.value;
  const sorters: Record<SortKey, (a: SearchResult, b: SearchResult) => number> = {
    price_asc: byPrice,
    price_desc: (a, b) => b.value - a.value,
    value: (a, b) => (a.peer?.diffFromMedian ?? 0) - (b.peer?.diffFromMedian ?? 0) || byPrice(a, b),
    rating: (a, b) => b.academy.rating - a.academy.rating || b.academy.reviewCount - a.academy.reviewCount,
    reviews: (a, b) => b.academy.reviewCount - a.academy.reviewCount,
    distance: (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || byPrice(a, b),
  };
  return results.sort(sorters[sort]);
}

/** 필터 상태를 사람이 읽을 수 있는 칩 목록으로 (활성 필터 표시용) */
export function countActiveFilters(f: SearchFilters): number {
  let n = 0;
  if (f.group !== 'all') n++;
  n += f.subjectIds.length ? 1 : 0;
  n += f.ages.length ? 1 : 0;
  n += f.classTypes.length ? 1 : 0;
  n += f.sessions.length ? 1 : 0;
  if (f.priceMin != null || f.priceMax != null) n++;
  for (const flag of [f.shuttle, f.trial, f.publicOnly, f.verifiedOnly, f.discountOnly]) if (flag) n++;
  if (f.minRating > 0) n++;
  if (f.maxDistanceKm != null) n++;
  return n;
}
