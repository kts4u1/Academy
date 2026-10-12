import { useState, type FormEvent } from 'react';
import { unitPrice } from '../lib/format';
import { planUnits } from '../lib/pricing';
import { useApp } from '../store/AppContext';
import type { Academy, Billing, PricePlan } from '../types';

type BillingChoice = 'monthly' | 'months' | 'sessions' | 'per_session';

export function PriceReportForm({ academy, defaultPlan }: { academy: Academy; defaultPlan: PricePlan }) {
  const { addReport, showToast } = useApp();
  const [planName, setPlanName] = useState(defaultPlan.name);
  const [choice, setChoice] = useState<BillingChoice>('monthly');
  const [price, setPrice] = useState('');
  const [sessionsPerWeek, setSessionsPerWeek] = useState(String(defaultPlan.sessionsPerWeek));
  const [minutes, setMinutes] = useState(String(defaultPlan.minutesPerSession));
  const [count, setCount] = useState('3');
  const [memo, setMemo] = useState('');
  const [error, setError] = useState('');

  const priceNum = Number(price.replace(/[^\d]/g, ''));
  const billing: Billing = choice === 'months' || choice === 'sessions' ? 'package' : choice;
  const draftPlan: PricePlan = {
    ...defaultPlan,
    billing,
    price: priceNum,
    sessionsPerWeek: Number(sessionsPerWeek) || 1,
    minutesPerSession: Number(minutes) || 60,
    months: choice === 'months' ? Number(count) || 1 : undefined,
    totalSessions: choice === 'sessions' ? Number(count) || 1 : undefined,
  };
  const preview = priceNum > 0 ? planUnits(draftPlan) : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!planName.trim()) return setError('요금제 이름을 적어 주세요.');
    if (!(priceNum >= 1000)) return setError('가격을 원 단위 숫자로 적어 주세요. (예: 180000)');
    setError('');
    addReport({
      academyId: academy.id,
      planName: planName.trim(),
      price: priceNum,
      billing,
      sessionsPerWeek: draftPlan.sessionsPerWeek,
      minutesPerSession: draftPlan.minutesPerSession,
      months: draftPlan.months,
      totalSessions: draftPlan.totalSessions,
      memo: memo.trim() || undefined,
    });
    setPrice('');
    setMemo('');
    showToast('가격 제보를 저장했어요. 고맙습니다!');
  };

  return (
    <form onSubmit={submit} className="card grid gap-3 p-4" noValidate>
      <div>
        <label className="label" htmlFor="rp-name">
          요금제 이름
        </label>
        <input id="rp-name" className="field" value={planName} onChange={(e) => setPlanName(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor="rp-billing">
            결제 방식
          </label>
          <select id="rp-billing" className="field" value={choice} onChange={(e) => setChoice(e.target.value as BillingChoice)}>
            <option value="monthly">월 수강료</option>
            <option value="months">기간권 (N개월)</option>
            <option value="sessions">횟수권 (N회)</option>
            <option value="per_session">회당 요금</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="rp-price">
            가격 (원)
          </label>
          <input id="rp-price" className="field num" inputMode="numeric" placeholder="예: 180000" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="label" htmlFor="rp-spw">
            주 횟수
          </label>
          <input id="rp-spw" className="field num" inputMode="numeric" value={sessionsPerWeek} onChange={(e) => setSessionsPerWeek(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="rp-min">
            1회 시간(분)
          </label>
          <input id="rp-min" className="field num" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </div>
        {(choice === 'months' || choice === 'sessions') && (
          <div>
            <label className="label" htmlFor="rp-count">
              {choice === 'months' ? '개월 수' : '총 횟수'}
            </label>
            <input id="rp-count" className="field num" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />
          </div>
        )}
      </div>
      <div>
        <label className="label" htmlFor="rp-memo">
          메모 (선택)
        </label>
        <input id="rp-memo" className="field" placeholder="예: 교재비 별도, 상담 때 안내받음" value={memo} onChange={(e) => setMemo(e.target.value)} />
      </div>
      {preview && (
        <p className="num rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-ink-2">
          환산하면 월 <b className="text-ink">{Math.round(preview.monthlyTuition).toLocaleString()}원</b> · 시간당{' '}
          <b className="text-ink">{unitPrice(preview.pricePerHour)}</b> (현재 등록가 시간당 {unitPrice(planUnits(defaultPlan).pricePerHour)})
        </p>
      )}
      {error && (
        <p role="alert" className="text-[13px] font-semibold text-pricey">
          {error}
        </p>
      )}
      <button type="submit" className="btn-primary">
        제보하기
      </button>
    </form>
  );
}
