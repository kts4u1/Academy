import { Plus, Trash } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CostStack } from '../charts/CostStack';
import { EmptyState, GroupDot, PageHeader, Section, SubjectTile, Toggle } from '../components/ui';
import { getAcademy } from '../data';
import { GROUPS, SUBJECT_MAP } from '../data/categories';
import { useAcademies, useOrigin } from '../hooks';
import { manwon, won } from '../lib/format';
import { computeCost } from '../lib/pricing';
import { EMPTY_FILTERS, searchAcademies } from '../lib/search';
import { useApp, type CalcItem } from '../store/AppContext';
import type { CategoryGroup, DiscountType } from '../types';

const PEOPLE = ['첫째', '둘째', '셋째', '나'];

interface ItemCost {
  item: CalcItem;
  title: string;
  subtitle: string;
  subjectId: string | null;
  group: CategoryGroup | null;
  monthlyTuition: number;
  monthlyFees: number;
  periodicAnnual: number;
  oneTime: number;
  effectiveMonthly: number;
  annualTotal: number;
  firstPayment: number;
}

function evaluate(item: CalcItem): ItemCost | null {
  if (item.custom) {
    const c = item.custom;
    const annualTotal = (c.monthly + c.monthlyExtras) * 12 + c.oneTime;
    return {
      item,
      title: c.name,
      subtitle: '직접 입력',
      subjectId: null,
      group: null,
      monthlyTuition: c.monthly,
      monthlyFees: c.monthlyExtras,
      periodicAnnual: 0,
      oneTime: c.oneTime,
      effectiveMonthly: annualTotal / 12,
      annualTotal,
      firstPayment: c.monthly + c.monthlyExtras + c.oneTime,
    };
  }
  const academy = item.academyId ? getAcademy(item.academyId) : undefined;
  const plan = academy?.plans.find((p) => p.id === item.planId) ?? academy?.plans[0];
  if (!academy || !plan) return null;
  const cost = computeCost(academy, plan, { includeOptional: item.includeOptional, discounts: item.discounts });
  return {
    item,
    title: academy.name,
    subtitle: plan.name,
    subjectId: plan.subjectId,
    group: SUBJECT_MAP[plan.subjectId]?.group ?? null,
    monthlyTuition: cost.monthlyTuition,
    monthlyFees: cost.monthlyFees,
    periodicAnnual: cost.periodicAnnual,
    oneTime: cost.oneTime,
    effectiveMonthly: cost.effectiveMonthly,
    annualTotal: cost.annualTotal,
    firstPayment: cost.firstPayment,
  };
}

function CustomForm({ onAdd }: { onAdd: (item: Omit<CalcItem, 'id'>) => void }) {
  const [name, setName] = useState('');
  const [person, setPerson] = useState('첫째');
  const [monthly, setMonthly] = useState('');
  const [extras, setExtras] = useState('');
  const [oneTime, setOneTime] = useState('');
  const [error, setError] = useState('');
  const n = (s: string) => Number(s.replace(/[^\d]/g, '')) || 0;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || n(monthly) <= 0) return setError('이름과 월 수강료를 입력해 주세요.');
    setError('');
    onAdd({ person, custom: { name: name.trim(), monthly: n(monthly), monthlyExtras: n(extras), oneTime: n(oneTime) }, discounts: [], includeOptional: false });
    setName('');
    setMonthly('');
    setExtras('');
    setOneTime('');
  };
  return (
    <form onSubmit={submit} className="card grid gap-3 p-4" noValidate>
      <div className="grid grid-cols-[1fr_6.5rem] gap-2">
        <div>
          <label className="label" htmlFor="cf-name">
            학원·수업 이름
          </label>
          <input id="cf-name" className="field" placeholder="예: 동네 미술학원" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="cf-person">
            누구
          </label>
          <input id="cf-person" className="field" list="people" value={person} onChange={(e) => setPerson(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="label" htmlFor="cf-monthly">
            월 수강료(원)
          </label>
          <input id="cf-monthly" className="field num" inputMode="numeric" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="cf-extras">
            월 부대비용
          </label>
          <input id="cf-extras" className="field num" inputMode="numeric" value={extras} onChange={(e) => setExtras(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="cf-once">
            초기 비용
          </label>
          <input id="cf-once" className="field num" inputMode="numeric" value={oneTime} onChange={(e) => setOneTime(e.target.value)} />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-[13px] font-semibold text-pricey">
          {error}
        </p>
      )}
      <button type="submit" className="btn-ghost">
        <Plus aria-hidden="true" className="h-4 w-4" /> 직접 추가
      </button>
    </form>
  );
}

export function BudgetPage() {
  const academies = useAcademies();
  const origin = useOrigin();
  const { calc, addCalc, updateCalc, removeCalc, settings, showToast } = useApp();
  const evaluated = useMemo(() => calc.map(evaluate).filter((x): x is ItemCost => x !== null), [calc]);

  const loadExample = () => {
    const home = settings.home;
    const pick = (subjectId: string, age: 'preschool' | 'elementary') =>
      searchAcademies(
        academies,
        { ...EMPTY_FILTERS, subjectIds: [subjectId], ages: [age], sido: home?.sido ?? '서울', sigungu: home?.sigungu ?? '' },
        origin ? 'distance' : 'price_asc',
        'effectiveMonthly',
        { origin, withPeers: false },
      )[0];
    const examples: [string, string, 'preschool' | 'elementary'][] = [
      ['첫째', 'math', 'elementary'],
      ['첫째', 'english', 'elementary'],
      ['첫째', 'swim', 'elementary'],
      ['둘째', 'taekwondo', 'preschool'],
      ['둘째', 'piano', 'elementary'],
    ];
    for (const [person, subjectId, age] of examples) {
      const r = pick(subjectId, age);
      if (r) addCalc({ person, academyId: r.academy.id, planId: r.plan.id, discounts: [], includeOptional: false });
    }
    showToast('예시 학원 5곳을 담았어요. 자유롭게 바꿔 보세요');
  };

  const totals = evaluated.reduce(
    (t, e) => ({
      monthlyFixed: t.monthlyFixed + e.monthlyTuition + e.monthlyFees,
      effective: t.effective + e.effectiveMonthly,
      annual: t.annual + e.annualTotal,
      first: t.first + e.firstPayment,
    }),
    { monthlyFixed: 0, effective: 0, annual: 0, first: 0 },
  );
  const people = Array.from(new Set(evaluated.map((e) => e.item.person)));
  const byGroup = GROUPS.map((g) => ({ ...g, total: evaluated.filter((e) => e.group === g.id).reduce((s, e) => s + e.effectiveMonthly, 0) })).filter((g) => g.total > 0);
  const customTotal = evaluated.filter((e) => e.group === null).reduce((s, e) => s + e.effectiveMonthly, 0);

  return (
    <div>
      <PageHeader title="내 학원비" subtitle="다니는(다닐) 학원을 담아 한 달·1년 지출을 계산해요" />
      <datalist id="people">
        {PEOPLE.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>

      {evaluated.length === 0 ? (
        <EmptyState
          title="담은 학원이 없어요"
          desc="학원 상세 화면에서 '계산기 담기'를 누르거나 아래에서 직접 입력하세요. 아이별로 나눠서 합계를 보여드려요."
          action={
            <button type="button" className="btn-primary" onClick={loadExample}>
              예시로 채워 보기
            </button>
          }
        />
      ) : (
        <>
          <section className="card p-4" aria-label="합계">
            <p className="text-[12px] font-semibold text-ink-3">실질 월 부담 합계</p>
            <p className="text-[34px] font-bold leading-tight tracking-tight">{won(totals.effective)}</p>
            <dl className="num mt-3 grid grid-cols-3 gap-3 border-t border-line pt-3 text-[13px]">
              <div>
                <dt className="text-ink-3">매달 나가는 돈</dt>
                <dd className="font-bold">{manwon(totals.monthlyFixed)}</dd>
              </div>
              <div>
                <dt className="text-ink-3">첫 달 결제</dt>
                <dd className="font-bold">{manwon(totals.first)}</dd>
              </div>
              <div>
                <dt className="text-ink-3">1년 총비용</dt>
                <dd className="font-bold">{manwon(totals.annual)}</dd>
              </div>
            </dl>
            {(byGroup.length > 0 || customTotal > 0) && (
              <div className="mt-4">
                <div className="flex h-3 gap-[2px] overflow-hidden rounded-full">
                  {byGroup.map((g) => (
                    <div
                      key={g.id}
                      title={`${g.name} ${won(g.total)}`}
                      className={{ academic: 'bg-academic', sports: 'bg-sports', arts: 'bg-arts' }[g.id]}
                      style={{ flexGrow: g.total, flexBasis: 0 }}
                    />
                  ))}
                  {customTotal > 0 && <div title={`직접 입력 ${won(customTotal)}`} className="bg-ink-3" style={{ flexGrow: customTotal, flexBasis: 0 }} />}
                </div>
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-2">
                  {byGroup.map((g) => (
                    <li key={g.id} className="flex items-center gap-1.5">
                      <GroupDot group={g.id} /> {g.name} <b className="num text-ink">{manwon(g.total)}</b>
                      <span className="text-ink-3">({Math.round((g.total / totals.effective) * 100)}%)</span>
                    </li>
                  ))}
                  {customTotal > 0 && (
                    <li className="flex items-center gap-1.5">
                      <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-ink-3" /> 직접 입력 <b className="num text-ink">{manwon(customTotal)}</b>
                    </li>
                  )}
                </ul>
              </div>
            )}
          </section>

          {people.length > 1 && (
            <Section title="사람별 1년 비용" desc="수강료와 부대비용 구성">
              <div className="card p-4">
                <CostStack
                  format={manwon}
                  segmentLabels={['수강료', '매월 부대비용', '정기 비용', '초기 비용']}
                  rows={people.map((person) => {
                    const items = evaluated.filter((e) => e.item.person === person);
                    const sum = (f: (e: ItemCost) => number) => items.reduce((s, e) => s + f(e), 0);
                    const fees = sum((e) => e.monthlyFees * 12);
                    const periodic = sum((e) => e.periodicAnnual);
                    const once = sum((e) => e.oneTime);
                    return { key: person, label: `${person} (${items.length}곳)`, segments: [sum((e) => e.annualTotal) - fees - periodic - once, fees, periodic, once] };
                  })}
                />
              </div>
            </Section>
          )}

          {people.map((person) => (
            <Section key={person} title={person} desc={`월 ${manwon(evaluated.filter((e) => e.item.person === person).reduce((s, e) => s + e.effectiveMonthly, 0))} (실질)`}>
              <ul className="flex flex-col gap-2">
                {evaluated
                  .filter((e) => e.item.person === person)
                  .map((e) => {
                    const academy = e.item.academyId ? getAcademy(e.item.academyId) : undefined;
                    return (
                      <li key={e.item.id} className="card p-4">
                        <div className="flex items-start gap-3">
                          {e.subjectId ? <SubjectTile subjectId={e.subjectId} size="sm" /> : <span className="h-8 w-8 shrink-0 rounded-lg bg-surface-2" aria-hidden="true" />}
                          <div className="min-w-0 flex-1">
                            {academy ? (
                              <Link to={`/academy/${academy.id}?plan=${e.item.planId}`} className="block truncate text-[15px] font-bold hover:text-accent">
                                {e.title}
                              </Link>
                            ) : (
                              <p className="truncate text-[15px] font-bold">{e.title}</p>
                            )}
                            <p className="truncate text-[12px] text-ink-3">{e.subtitle}</p>
                          </div>
                          <div className="num shrink-0 text-right">
                            <p className="text-[16px] font-bold">{manwon(e.effectiveMonthly)}</p>
                            <p className="text-[11px] text-ink-3">실질 월</p>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {academy && (
                            <div className="col-span-2 sm:col-span-1">
                              <label className="label" htmlFor={`plan-${e.item.id}`}>
                                요금제
                              </label>
                              <select id={`plan-${e.item.id}`} className="field py-2 text-[13px]" value={e.item.planId} onChange={(ev) => updateCalc(e.item.id, { planId: ev.target.value })}>
                                {academy.plans.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                          <div>
                            <label className="label" htmlFor={`person-${e.item.id}`}>
                              누구
                            </label>
                            <input id={`person-${e.item.id}`} className="field py-2 text-[13px]" list="people" value={e.item.person} onChange={(ev) => updateCalc(e.item.id, { person: ev.target.value || '첫째' })} />
                          </div>
                          <div className="flex items-end justify-end">
                            <button type="button" className="btn-ghost px-3 py-2 text-[13px]" onClick={() => removeCalc(e.item.id)}>
                              <Trash aria-hidden="true" className="h-4 w-4" /> 삭제
                            </button>
                          </div>
                        </div>
                        {academy && (academy.discounts.length > 0 || academy.extraFees.some((f) => !f.required)) && (
                          <div className="mt-2 border-t border-line pt-1">
                            {academy.extraFees.some((f) => !f.required) && (
                              <Toggle id={`opt-${e.item.id}`} label="선택 비용 포함" checked={e.item.includeOptional} onChange={(v) => updateCalc(e.item.id, { includeOptional: v })} />
                            )}
                            {academy.discounts.map((d) => (
                              <Toggle
                                key={d.id}
                                id={`d-${e.item.id}-${d.id}`}
                                label={d.label}
                                checked={e.item.discounts.includes(d.type)}
                                onChange={(v) =>
                                  updateCalc(e.item.id, {
                                    discounts: v ? [...e.item.discounts, d.type] : e.item.discounts.filter((x: DiscountType) => x !== d.type),
                                  })
                                }
                              />
                            ))}
                          </div>
                        )}
                        <dl className="num mt-2 grid grid-cols-3 gap-2 rounded-lg bg-surface-2 p-2 text-[12px]">
                          <div>
                            <dt className="text-ink-3">월 수강료</dt>
                            <dd className="font-semibold">{won(e.monthlyTuition)}</dd>
                          </div>
                          <div>
                            <dt className="text-ink-3">첫 결제</dt>
                            <dd className="font-semibold">{won(e.firstPayment)}</dd>
                          </div>
                          <div>
                            <dt className="text-ink-3">1년</dt>
                            <dd className="font-semibold">{won(e.annualTotal)}</dd>
                          </div>
                        </dl>
                      </li>
                    );
                  })}
              </ul>
            </Section>
          ))}
        </>
      )}

      <Section title="직접 입력" desc="앱에 없는 학원이나 과외도 함께 계산할 수 있어요">
        <CustomForm
          onAdd={(item) => {
            addCalc(item);
            showToast('추가했어요');
          }}
        />
      </Section>
    </div>
  );
}
