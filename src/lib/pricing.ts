// 가격 환산 엔진
//
// 학원비는 "월 28만원(주2회 90분)", "3개월 45만원(자유이용)", "10회 55만원(1:1)",
// "회당 7만원"처럼 청구 방식이 제각각이다. 월 금액만 비교하면 수업 시간이 두 배인 학원이
// 비싸 보이고, 도복·교재·심사비가 빠지면 실제 부담과 다르다.
// 그래서 모든 요금제를 아래 단위로 환산해서 비교한다.
//
//   월 환산 수강료  : 한 달에 내는 수강료 (패키지는 기간/횟수로 나눠 환산)
//   회당 단가       : 월 환산 수강료 ÷ 월 수업 횟수
//   시간당 단가     : 월 환산 수강료 ÷ 월 수업 시간
//   실질 월 부담    : (1년 수강료 + 1년 부대비용 + 초기 일회성 비용) ÷ 12
//   첫 결제 금액    : 등록할 때 한 번에 내야 하는 돈 (패키지 총액, 도복·등록비 등 포함)
//   1년 총비용      : 12개월 다닐 때 드는 전체 비용

import type { Academy, Discount, DiscountType, ExtraFee, PricePlan } from '../types';

/** 학원 관행상 한 달은 4주로 계산한다. (주 2회 = 월 8회) */
export const WEEKS_PER_MONTH = 4;

export interface PlanUnits {
  /** 월 환산 수강료 */
  monthlyTuition: number;
  sessionsPerMonth: number;
  hoursPerMonth: number;
  pricePerSession: number;
  pricePerHour: number;
  /** 등록 시 수강료로 한 번에 내는 금액 (패키지는 총액) */
  upfrontTuition: number;
}

export function planUnits(plan: PricePlan): PlanUnits {
  const sessionsPerMonth = plan.sessionsPerWeek * WEEKS_PER_MONTH;
  let monthly: number;
  let upfront: number;
  switch (plan.billing) {
    case 'monthly':
      monthly = plan.price;
      upfront = plan.price;
      break;
    case 'per_session':
      monthly = plan.price * sessionsPerMonth;
      upfront = monthly;
      break;
    case 'package':
      if (plan.months && plan.months > 0) {
        monthly = plan.price / plan.months;
      } else if (plan.totalSessions && plan.totalSessions > 0) {
        monthly = (plan.price / plan.totalSessions) * sessionsPerMonth;
      } else {
        monthly = plan.price;
      }
      upfront = plan.price;
      break;
  }
  const hoursPerMonth = (sessionsPerMonth * plan.minutesPerSession) / 60;
  return {
    monthlyTuition: monthly,
    sessionsPerMonth,
    hoursPerMonth,
    pricePerSession: sessionsPerMonth > 0 ? monthly / sessionsPerMonth : monthly,
    pricePerHour: hoursPerMonth > 0 ? monthly / hoursPerMonth : monthly,
    upfrontTuition: upfront,
  };
}

/** 부대비용 1건의 연간 반복 비용 (일회성 제외) */
export function annualRecurring(fee: ExtraFee): number {
  switch (fee.frequency) {
    case 'monthly':
      return fee.amount * 12;
    case 'quarterly':
      return fee.amount * 4;
    case 'yearly':
      return fee.amount;
    case 'per_event':
      return fee.amount * (fee.timesPerYear ?? 1);
    case 'once':
      return 0;
  }
}

export interface ExtrasSummary {
  /** 매달 나가는 비용 (차량비, 재료비 등) */
  monthlyFees: number;
  /** 분기·연간·행사성 비용의 연간 합 (교재비, 심사비, 보험료 등) */
  periodicAnnual: number;
  /** 최초 1회 비용 (도복, 등록비, 장비 등) */
  oneTime: number;
  /** 첫 결제 때 함께 내는 분기·연간 비용 */
  firstPaymentPeriodic: number;
  included: ExtraFee[];
}

export function summarizeExtras(fees: ExtraFee[], includeOptional = false): ExtrasSummary {
  const included = fees.filter((f) => f.required || includeOptional);
  let monthlyFees = 0;
  let periodicAnnual = 0;
  let oneTime = 0;
  let firstPaymentPeriodic = 0;
  for (const fee of included) {
    if (fee.frequency === 'monthly') monthlyFees += fee.amount;
    else if (fee.frequency === 'once') oneTime += fee.amount;
    else periodicAnnual += annualRecurring(fee);
    if (fee.frequency === 'quarterly' || fee.frequency === 'yearly') firstPaymentPeriodic += fee.amount;
  }
  return { monthlyFees, periodicAnnual, oneTime, firstPaymentPeriodic, included };
}

export interface CostOptions {
  /** 선택 비용(호구, 개인 장비, 대회 참가 등)도 포함할지 */
  includeOptional?: boolean;
  /** 적용할 할인 종류. 학원이 제공하는 할인만 실제로 적용된다. */
  discounts?: DiscountType[];
}

export interface CostBreakdown extends PlanUnits {
  /** 할인 전 월 환산 수강료 */
  baseMonthlyTuition: number;
  monthlyFees: number;
  periodicAnnual: number;
  oneTime: number;
  firstPayment: number;
  annualTotal: number;
  /** 1년 기준 실질 월 부담 (부대비용·초기비용 포함) */
  effectiveMonthly: number;
  /** 부대비용까지 포함한 시간당 비용 */
  effectivePerHour: number;
  /** 할인으로 줄어든 연간 금액 */
  annualSaving: number;
  appliedDiscounts: Discount[];
  extras: ExtraFee[];
}

/** 할인율을 곱해서 적용한다. (여러 할인이 겹치면 순차 적용) */
function applyDiscounts(
  monthlyTuition: number,
  plan: PricePlan,
  discounts: Discount[],
): { monthly: number; firstMonthExtraOff: number; applied: Discount[] } {
  let monthly = monthlyTuition;
  let firstMonthExtraOff = 0;
  const applied: Discount[] = [];
  for (const dsc of discounts) {
    // 선납 할인은 월납 요금제에만 의미가 있다. (기간권은 이미 할인가)
    if (dsc.type === 'prepay' && plan.billing !== 'monthly') continue;
    if (dsc.type === 'first_month') {
      firstMonthExtraOff += monthly * ((dsc.percent ?? 0) / 100) + (dsc.amount ?? 0);
      applied.push(dsc);
      continue;
    }
    if (dsc.percent) monthly *= 1 - dsc.percent / 100;
    if (dsc.amount) monthly = Math.max(0, monthly - dsc.amount);
    applied.push(dsc);
  }
  return { monthly, firstMonthExtraOff, applied };
}

export function computeCost(academy: Pick<Academy, 'extraFees' | 'discounts'>, plan: PricePlan, options: CostOptions = {}): CostBreakdown {
  const units = planUnits(plan);
  const extras = summarizeExtras(academy.extraFees, options.includeOptional);
  const wanted = new Set(options.discounts ?? []);
  const offered = academy.discounts.filter((d) => wanted.has(d.type));
  const { monthly, firstMonthExtraOff, applied } = applyDiscounts(units.monthlyTuition, plan, offered);

  const ratio = units.monthlyTuition > 0 ? monthly / units.monthlyTuition : 1;
  const upfrontTuition = units.upfrontTuition * ratio - firstMonthExtraOff;
  const firstPayment = upfrontTuition + extras.monthlyFees + extras.oneTime + extras.firstPaymentPeriodic;
  const annualTuition = monthly * 12 - firstMonthExtraOff;
  const annualTotal = annualTuition + extras.monthlyFees * 12 + extras.periodicAnnual + extras.oneTime;
  const baseAnnualTuition = units.monthlyTuition * 12;
  const effectiveMonthly = annualTotal / 12;

  return {
    ...units,
    baseMonthlyTuition: units.monthlyTuition,
    monthlyTuition: monthly,
    pricePerSession: units.sessionsPerMonth > 0 ? monthly / units.sessionsPerMonth : monthly,
    pricePerHour: units.hoursPerMonth > 0 ? monthly / units.hoursPerMonth : monthly,
    upfrontTuition,
    monthlyFees: extras.monthlyFees,
    periodicAnnual: extras.periodicAnnual,
    oneTime: extras.oneTime,
    firstPayment,
    annualTotal,
    effectiveMonthly,
    effectivePerHour: units.hoursPerMonth > 0 ? effectiveMonthly / units.hoursPerMonth : effectiveMonthly,
    annualSaving: baseAnnualTuition - annualTuition,
    appliedDiscounts: applied,
    extras: extras.included,
  };
}

// ───────────── 비교 기준 ─────────────

export type Metric = 'effectiveMonthly' | 'monthlyTuition' | 'pricePerHour' | 'pricePerSession' | 'firstPayment' | 'annualTotal';

export interface MetricMeta {
  id: Metric;
  label: string;
  short: string;
  desc: string;
}

export const METRICS: MetricMeta[] = [
  {
    id: 'effectiveMonthly',
    label: '실질 월 부담',
    short: '실질 월',
    desc: '수강료에 교재·차량·심사비, 도복 같은 초기비용까지 1년 기준으로 나눠 더한 금액',
  },
  { id: 'monthlyTuition', label: '월 수강료', short: '월 수강료', desc: '패키지·회당 요금을 한 달 기준으로 환산한 수강료' },
  { id: 'pricePerHour', label: '시간당 단가', short: '시간당', desc: '월 수강료 ÷ 월 수업 시간. 수업 시간이 다른 학원을 공정하게 비교' },
  { id: 'pricePerSession', label: '회당 단가', short: '회당', desc: '월 수강료 ÷ 월 수업 횟수' },
  { id: 'firstPayment', label: '첫 결제 금액', short: '첫 결제', desc: '등록할 때 한 번에 내는 돈 (기간권 총액, 등록비, 도복·용품 포함)' },
  { id: 'annualTotal', label: '1년 총비용', short: '1년', desc: '12개월 다닐 때 드는 수강료와 부대비용 전체' },
];

export const METRIC_MAP: Record<Metric, MetricMeta> = Object.fromEntries(METRICS.map((m) => [m.id, m])) as Record<
  Metric,
  MetricMeta
>;

export function metricValue(cost: CostBreakdown, metric: Metric): number {
  return cost[metric];
}

// ───────────── 지역 시세 대비 가격 수준 ─────────────

export type PriceLevel = 'very_low' | 'low' | 'avg' | 'high' | 'very_high';

export const PRICE_LEVEL_META: Record<PriceLevel, { label: string; tone: 'cheap' | 'neutral' | 'pricey' }> = {
  very_low: { label: '매우 저렴', tone: 'cheap' },
  low: { label: '저렴', tone: 'cheap' },
  avg: { label: '평균', tone: 'neutral' },
  high: { label: '다소 비쌈', tone: 'pricey' },
  very_high: { label: '비쌈', tone: 'pricey' },
};

/** 백분위(0=가장 저렴, 100=가장 비쌈)를 가격 수준으로 */
export function priceLevel(percentile: number): PriceLevel {
  if (percentile < 20) return 'very_low';
  if (percentile < 40) return 'low';
  if (percentile <= 60) return 'avg';
  if (percentile <= 80) return 'high';
  return 'very_high';
}

export function billingLabel(plan: PricePlan): string {
  switch (plan.billing) {
    case 'monthly':
      return '월';
    case 'per_session':
      return '회당';
    case 'package':
      if (plan.months) return `${plan.months}개월권`;
      if (plan.totalSessions) return `${plan.totalSessions}회권`;
      return '패키지';
  }
}

export function scheduleLabel(plan: PricePlan): string {
  const freq = plan.unlimited ? `자유이용(주${plan.sessionsPerWeek}회 기준)` : `주${plan.sessionsPerWeek}회`;
  return `${freq} · ${plan.minutesPerSession}분`;
}
