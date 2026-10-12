// 시세(마켓) 계산: 같은 과목·연령·수업형태의 요금제들을 모아 분포를 만들고,
// 특정 요금제가 그 안에서 어디쯤인지(백분위)를 계산한다.

import type { Academy, AgeGroup, ClassType, PricePlan } from '../types';
import { computeCost, priceLevel, type CostBreakdown, type Metric, type PriceLevel } from './pricing';
import { percentileRank, summarize, type Stats } from './stats';

export interface PlanPoint {
  academy: Academy;
  plan: PricePlan;
  cost: CostBreakdown;
}

const pointsCache = new WeakMap<Academy[], PlanPoint[]>();

/** 모든 학원의 모든 요금제를 기본 조건(필수 비용만, 할인 없음)으로 환산한 목록 */
export function allPlanPoints(academies: Academy[]): PlanPoint[] {
  let points = pointsCache.get(academies);
  if (!points) {
    points = academies.flatMap((academy) => academy.plans.map((plan) => ({ academy, plan, cost: computeCost(academy, plan) })));
    pointsCache.set(academies, points);
  }
  return points;
}

export interface MarketQuery {
  subjectId: string;
  ages?: AgeGroup[];
  classTypes?: ClassType[];
  sessionsPerWeek?: number[];
  sido?: string;
  sigungu?: string;
  excludePublic?: boolean;
}

export function sessionBucket(sessionsPerWeek: number): number {
  return sessionsPerWeek >= 5 ? 5 : sessionsPerWeek;
}

export function matchesMarket(point: PlanPoint, q: MarketQuery): boolean {
  const { academy, plan } = point;
  if (plan.subjectId !== q.subjectId) return false;
  if (q.sido && academy.region.sido !== q.sido) return false;
  if (q.sigungu && academy.region.sigungu !== q.sigungu) return false;
  if (q.ages?.length && !plan.targets.some((a) => q.ages!.includes(a))) return false;
  if (q.classTypes?.length && !q.classTypes.includes(plan.classType)) return false;
  if (q.sessionsPerWeek?.length && !q.sessionsPerWeek.includes(sessionBucket(plan.sessionsPerWeek))) return false;
  if (q.excludePublic && academy.isPublic) return false;
  return true;
}

const bySubjectCache = new WeakMap<Academy[], Map<string, PlanPoint[]>>();

/** 과목별로 나눠 둔 요금제 목록 – 시세 조회는 항상 과목을 지정하므로 전체를 훑지 않는다 */
function pointsOfSubject(academies: Academy[], subjectId: string): PlanPoint[] {
  let index = bySubjectCache.get(academies);
  if (!index) {
    index = new Map();
    for (const p of allPlanPoints(academies)) {
      const list = index.get(p.plan.subjectId);
      if (list) list.push(p);
      else index.set(p.plan.subjectId, [p]);
    }
    bySubjectCache.set(academies, index);
  }
  return index.get(subjectId) ?? [];
}

export function marketPoints(academies: Academy[], q: MarketQuery): PlanPoint[] {
  return pointsOfSubject(academies, q.subjectId).filter((p) => matchesMarket(p, q));
}

export interface PeerComparison {
  stats: Stats;
  percentile: number;
  level: PriceLevel;
  /** 중앙값 대비 차이 비율 (-0.12 = 12% 저렴) */
  diffFromMedian: number;
  /** 저렴한 순 등수 (1 = 가장 저렴) */
  rank: number;
  scopeLabel: string;
  sorted: number[];
}

const MIN_PEERS = 5;
type PeerDist = { sorted: number[]; stats: Stats; scopeLabel: string } | null;
const peerCaches = new WeakMap<Academy[], Map<string, PeerDist>>();

/** 단가 기준이 아니면 주당 횟수가 같아야 공정하다 (주2회와 주5회의 월 금액은 비교 대상이 아님) */
function needsSameFrequency(metric: Metric): boolean {
  return metric !== 'pricePerHour' && metric !== 'pricePerSession';
}

function peerDistribution(academies: Academy[], academy: Academy, plan: PricePlan, metric: Metric): PeerDist {
  let peerCache = peerCaches.get(academies);
  if (!peerCache) {
    peerCache = new Map();
    peerCaches.set(academies, peerCache);
  }
  const bucket = sessionBucket(plan.sessionsPerWeek);
  const key = [metric, plan.subjectId, plan.classType, [...plan.targets].sort().join(','), academy.region.sido, bucket].join('|');
  if (peerCache.has(key)) return peerCache.get(key)!;

  const sido = academy.region.sido;
  const base: MarketQuery = { subjectId: plan.subjectId, ages: plan.targets, classTypes: [plan.classType] };
  const freqLabel = bucket >= 5 ? '주5회 이상' : `주${bucket}회`;
  const scopes: { q: MarketQuery; label: string }[] = [];
  if (needsSameFrequency(metric)) {
    const withFreq = { ...base, sessionsPerWeek: [bucket] };
    scopes.push({ q: { ...withFreq, sido }, label: `${sido} 같은 조건(${freqLabel})` }, { q: withFreq, label: `전국 같은 조건(${freqLabel})` });
  }
  scopes.push(
    { q: { ...base, sido }, label: `${sido} 같은 조건` },
    { q: base, label: '전국 같은 조건' },
    { q: { ...base, classTypes: undefined, sido }, label: `${sido} 같은 과목·연령` },
  );
  let result: PeerDist = null;
  for (const scope of scopes) {
    const values = marketPoints(academies, scope.q).map((p) => p.cost[metric]);
    if (values.length >= MIN_PEERS) {
      const sorted = values.sort((a, b) => a - b);
      result = { sorted, stats: summarize(sorted)!, scopeLabel: scope.label };
      break;
    }
  }
  peerCache.set(key, result);
  return result;
}

/** 요금제를 같은 조건의 다른 학원들과 비교한다. cost 를 넘기면 그 값(할인 적용 등)으로 위치를 계산. */
export function comparePlanToPeers(
  academies: Academy[],
  academy: Academy,
  plan: PricePlan,
  metric: Metric,
  cost?: CostBreakdown,
): PeerComparison | null {
  const dist = peerDistribution(academies, academy, plan, metric);
  if (!dist) return null;
  const value = (cost ?? computeCost(academy, plan))[metric];
  const percentile = percentileRank(dist.sorted, value);
  return {
    stats: dist.stats,
    percentile,
    level: priceLevel(percentile),
    diffFromMedian: dist.stats.median > 0 ? value / dist.stats.median - 1 : 0,
    rank: dist.sorted.filter((v) => v < value).length + 1,
    scopeLabel: dist.scopeLabel,
    sorted: dist.sorted,
  };
}

/** 같은 과목·연령·수업형태에서 더 저렴한 학원 추천 */
export function cheaperAlternatives(
  academies: Academy[],
  academy: Academy,
  plan: PricePlan,
  metric: Metric,
  limit = 4,
): PlanPoint[] {
  const own = computeCost(academy, plan)[metric];
  const candidates = marketPoints(academies, {
    subjectId: plan.subjectId,
    ages: plan.targets,
    classTypes: [plan.classType],
    sido: academy.region.sido,
  }).filter((p) => p.academy.id !== academy.id && p.cost[metric] < own);

  // 같은 구 우선, 그다음 가격순. 학원당 1개 요금제만.
  const seen = new Set<string>();
  return candidates
    .sort((a, b) => {
      const sameA = a.academy.region.sigungu === academy.region.sigungu ? 0 : 1;
      const sameB = b.academy.region.sigungu === academy.region.sigungu ? 0 : 1;
      return sameA - sameB || a.cost[metric] - b.cost[metric];
    })
    .filter((p) => {
      if (seen.has(p.academy.id)) return false;
      seen.add(p.academy.id);
      return true;
    })
    .slice(0, limit);
}
