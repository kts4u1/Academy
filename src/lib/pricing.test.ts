import { describe, expect, it } from 'vitest';
import type { Discount, ExtraFee, PricePlan } from '../types';
import { annualRecurring, computeCost, planUnits, priceLevel, summarizeExtras } from './pricing';

const basePlan: PricePlan = {
  id: 'p1',
  subjectId: 'math',
  name: '초등 주2회',
  targets: ['elementary'],
  classType: 'group',
  maxStudents: 10,
  billing: 'monthly',
  price: 240000,
  sessionsPerWeek: 2,
  minutesPerSession: 90,
};

describe('planUnits', () => {
  it('월 요금제: 주2회 90분 24만원 → 월 8회, 12시간, 시간당 2만원', () => {
    const u = planUnits(basePlan);
    expect(u.monthlyTuition).toBe(240000);
    expect(u.sessionsPerMonth).toBe(8);
    expect(u.hoursPerMonth).toBe(12);
    expect(u.pricePerSession).toBe(30000);
    expect(u.pricePerHour).toBe(20000);
    expect(u.upfrontTuition).toBe(240000);
  });

  it('회당 요금제: 회당 7만원 주1회 → 월 28만원', () => {
    const u = planUnits({ ...basePlan, billing: 'per_session', price: 70000, sessionsPerWeek: 1, minutesPerSession: 60 });
    expect(u.monthlyTuition).toBe(280000);
    expect(u.pricePerHour).toBe(70000);
  });

  it('기간권: 3개월 45만원 → 월 15만원, 첫 결제는 45만원', () => {
    const u = planUnits({ ...basePlan, billing: 'package', price: 450000, months: 3, sessionsPerWeek: 5, minutesPerSession: 60 });
    expect(u.monthlyTuition).toBe(150000);
    expect(u.upfrontTuition).toBe(450000);
    expect(u.hoursPerMonth).toBe(20);
    expect(u.pricePerHour).toBe(7500);
  });

  it('횟수권: 10회 55만원 주2회 → 회당 5.5만원, 월 44만원', () => {
    const u = planUnits({ ...basePlan, billing: 'package', price: 550000, totalSessions: 10, sessionsPerWeek: 2, minutesPerSession: 30 });
    expect(u.pricePerSession).toBe(55000);
    expect(u.monthlyTuition).toBe(440000);
    expect(u.pricePerHour).toBe(110000);
  });

  it('수업 시간이 두 배면 월 금액이 비싸도 시간당 단가는 더 쌀 수 있다', () => {
    const shortClass = planUnits({ ...basePlan, price: 200000, minutesPerSession: 60 });
    const longClass = planUnits({ ...basePlan, price: 280000, minutesPerSession: 120 });
    expect(longClass.monthlyTuition).toBeGreaterThan(shortClass.monthlyTuition);
    expect(longClass.pricePerHour).toBeLessThan(shortClass.pricePerHour);
  });
});

const fees: ExtraFee[] = [
  { id: 'f1', name: '교재비', amount: 30000, frequency: 'quarterly', required: true },
  { id: 'f2', name: '차량비', amount: 30000, frequency: 'monthly', required: true },
  { id: 'f3', name: '도복비', amount: 50000, frequency: 'once', required: true },
  { id: 'f4', name: '승급심사비', amount: 40000, frequency: 'per_event', timesPerYear: 4, required: true },
  { id: 'f5', name: '호구', amount: 500000, frequency: 'once', required: false },
  { id: 'f6', name: '보험료', amount: 20000, frequency: 'yearly', required: true },
];

describe('부대비용', () => {
  it('주기별 연간 비용', () => {
    expect(annualRecurring(fees[0])).toBe(120000);
    expect(annualRecurring(fees[1])).toBe(360000);
    expect(annualRecurring(fees[2])).toBe(0);
    expect(annualRecurring(fees[3])).toBe(160000);
    expect(annualRecurring(fees[5])).toBe(20000);
  });

  it('선택 비용은 기본적으로 제외된다', () => {
    const s = summarizeExtras(fees);
    expect(s.oneTime).toBe(50000);
    expect(s.monthlyFees).toBe(30000);
    expect(s.periodicAnnual).toBe(120000 + 160000 + 20000);
    expect(s.firstPaymentPeriodic).toBe(30000 + 20000);
    expect(summarizeExtras(fees, true).oneTime).toBe(550000);
  });
});

describe('computeCost', () => {
  const academy = { extraFees: fees, discounts: [] as Discount[] };

  it('실질 월 부담 = (수강료 + 부대비용 + 일회성) 1년 합 ÷ 12', () => {
    const c = computeCost(academy, basePlan);
    const annual = 240000 * 12 + 30000 * 12 + (120000 + 160000 + 20000) + 50000;
    expect(c.annualTotal).toBe(annual);
    expect(c.effectiveMonthly).toBeCloseTo(annual / 12);
    expect(c.firstPayment).toBe(240000 + 30000 + 50000 + 30000 + 20000);
  });

  it('형제 할인 10% + 월 정액 할인', () => {
    const discounts: Discount[] = [
      { id: 'd1', type: 'sibling', label: '형제 10%', percent: 10 },
      { id: 'd2', type: 'card', label: '카드 1만원', amount: 10000 },
    ];
    const c = computeCost({ extraFees: [], discounts }, basePlan, { discounts: ['sibling', 'card'] });
    expect(c.monthlyTuition).toBe(240000 * 0.9 - 10000);
    expect(c.annualSaving).toBe((240000 - c.monthlyTuition) * 12);
    expect(c.appliedDiscounts).toHaveLength(2);
  });

  it('학원이 제공하지 않는 할인은 적용되지 않는다', () => {
    const c = computeCost({ extraFees: [], discounts: [] }, basePlan, { discounts: ['sibling'] });
    expect(c.monthlyTuition).toBe(240000);
    expect(c.appliedDiscounts).toHaveLength(0);
  });

  it('선납 할인은 기간권에는 중복 적용되지 않는다', () => {
    const discounts: Discount[] = [{ id: 'd1', type: 'prepay', label: '3개월 선납 5%', percent: 5, months: 3 }];
    const pkg: PricePlan = { ...basePlan, billing: 'package', price: 450000, months: 3 };
    expect(computeCost({ extraFees: [], discounts }, pkg, { discounts: ['prepay'] }).monthlyTuition).toBe(150000);
    expect(computeCost({ extraFees: [], discounts }, basePlan, { discounts: ['prepay'] }).monthlyTuition).toBe(228000);
  });

  it('첫 달 할인은 첫 결제와 1년 총액에만 반영된다', () => {
    const discounts: Discount[] = [{ id: 'd1', type: 'first_month', label: '첫 달 20%', percent: 20 }];
    const c = computeCost({ extraFees: [], discounts }, basePlan, { discounts: ['first_month'] });
    expect(c.monthlyTuition).toBe(240000);
    expect(c.firstPayment).toBe(240000 - 48000);
    expect(c.annualTotal).toBe(240000 * 12 - 48000);
  });
});

describe('priceLevel', () => {
  it('백분위 구간', () => {
    expect(priceLevel(5)).toBe('very_low');
    expect(priceLevel(30)).toBe('low');
    expect(priceLevel(50)).toBe('avg');
    expect(priceLevel(70)).toBe('high');
    expect(priceLevel(95)).toBe('very_high');
  });
});
