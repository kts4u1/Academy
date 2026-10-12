import { Bus, Car, Check, Clock, Heart, MapPin, Phone, Plus, Users, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { PriceHistoryChart } from '../charts/PriceHistoryChart';
import { RangeStrip } from '../charts/RangeStrip';
import { MetricPicker } from '../components/MetricPicker';
import { PriceReportForm } from '../components/PriceReportForm';
import { BackButton, EmptyState, PriceLevelBadge, Section, SourceBadge, Stars, SubjectChips, SubjectTile, Toggle } from '../components/ui';
import { getAcademy } from '../data';
import { AGE_LABELS, CLASS_TYPE_LABELS, SUBJECT_MAP } from '../data/categories';
import { useAcademies } from '../hooks';
import { dotDate, formatMetric, hoursLabel, manwon, signedPercent, unitPrice, won } from '../lib/format';
import { cheaperAlternatives, comparePlanToPeers } from '../lib/market';
import { annualRecurring, billingLabel, computeCost, METRIC_MAP, PRICE_LEVEL_META, scheduleLabel, planUnits } from '../lib/pricing';
import { useApp } from '../store/AppContext';
import type { DiscountType, ExtraFee } from '../types';

export function frequencyLabel(fee: ExtraFee): string {
  switch (fee.frequency) {
    case 'once':
      return '최초 1회';
    case 'monthly':
      return '매월';
    case 'quarterly':
      return '3개월마다';
    case 'yearly':
      return '매년';
    case 'per_event':
      return `연 ${fee.timesPerYear ?? 1}회`;
  }
}

export function AcademyPage() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const academies = useAcademies();
  const academy = getAcademy(id);
  const { settings, updateSettings, toggleFavorite, isFavorite, addCompare, addCalc, showToast, reports } = useApp();
  const metric = settings.metric;
  const [includeOptional, setIncludeOptional] = useState(false);
  const [discounts, setDiscounts] = useState<DiscountType[]>([]);

  const plan = academy?.plans.find((p) => p.id === params.get('plan')) ?? academy?.plans[0];

  const cost = useMemo(() => (academy && plan ? computeCost(academy, plan, { includeOptional, discounts }) : null), [academy, plan, includeOptional, discounts]);
  const baseCost = useMemo(() => (academy && plan ? computeCost(academy, plan) : null), [academy, plan]);
  const peer = useMemo(() => (academy && plan ? comparePlanToPeers(academies, academy, plan, metric) : null), [academies, academy, plan, metric]);
  const alternatives = useMemo(() => (academy && plan ? cheaperAlternatives(academies, academy, plan, metric) : []), [academies, academy, plan, metric]);

  if (!academy || !plan || !cost || !baseCost) {
    return (
      <div className="pt-6">
        <EmptyState title="학원을 찾을 수 없어요" action={<Link to="/search" className="btn-primary">검색으로 가기</Link>} />
      </div>
    );
  }

  const fav = isFavorite(academy.id);
  const myReports = reports.filter((r) => r.academyId === academy.id);
  const fmt = (v: number) => formatMetric(metric, v);

  return (
    <div className="mx-auto max-w-3xl">
      <BackButton />
      <header className="mt-1 flex items-start gap-3">
        <SubjectTile subjectId={academy.subjectIds[0]} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-bold leading-tight tracking-tight">{academy.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
            <SubjectChips subjectIds={academy.subjectIds} />
            <span>
              {academy.region.sigungu} {academy.region.dong}
            </span>
            <Stars value={academy.rating} count={academy.reviewCount} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-ink-3">
            <SourceBadge source={academy.priceSource} />
            <span>가격 업데이트 {dotDate(academy.priceUpdatedAt)}</span>
          </div>
        </div>
        <button
          type="button"
          aria-pressed={fav}
          aria-label={fav ? '찜 해제' : '찜하기'}
          onClick={() => {
            toggleFavorite(academy.id);
            showToast(fav ? '찜을 해제했어요' : '찜한 학원에 추가했어요');
          }}
          className="rounded-full p-2 text-ink-3 hover:bg-surface-2"
        >
          <Heart className={`h-6 w-6 ${fav ? 'fill-pricey text-pricey' : ''}`} />
        </button>
      </header>

      <Section title="요금제" desc={`${academy.plans.length}개 · 선택하면 아래 비용 계산이 바뀌어요`}>
        <div role="radiogroup" aria-label="요금제 선택" className="flex flex-col gap-2">
          {academy.plans.map((p) => {
            const u = planUnits(p);
            const selected = p.id === plan.id;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setParams({ plan: p.id }, { replace: true })}
                className={`card flex items-center gap-3 p-3 text-left transition-colors ${selected ? 'border-accent ring-1 ring-accent' : 'hover:bg-surface-2'}`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${selected ? 'border-accent bg-accent text-on-accent' : 'border-line'}`}
                >
                  {selected && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold">{p.name}</span>
                  <span className="block text-[12px] text-ink-3">
                    {scheduleLabel(p)} · {CLASS_TYPE_LABELS[p.classType]}
                    {p.classType !== 'private' && ` 정원 ${p.maxStudents}명`} · {p.targets.map((t) => AGE_LABELS[t]).join('·')}
                  </span>
                </span>
                <span className="num shrink-0 text-right">
                  <span className="block text-[15px] font-bold">
                    <span className="mr-1 text-[11px] font-semibold text-ink-3">{billingLabel(p)}</span>
                    {manwon(p.price)}
                  </span>
                  <span className="block text-[11px] text-ink-3">시간당 {unitPrice(u.pricePerHour)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="가격 한눈에" desc={`${plan.name} 기준 · 필수 비용 포함, 할인 미적용`}>
        <div className="card p-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            {(
              [
                ['effectiveMonthly', manwon(baseCost.effectiveMonthly)],
                ['monthlyTuition', manwon(baseCost.monthlyTuition)],
                ['pricePerHour', unitPrice(baseCost.pricePerHour)],
                ['pricePerSession', unitPrice(baseCost.pricePerSession)],
                ['firstPayment', manwon(baseCost.firstPayment)],
                ['annualTotal', manwon(baseCost.annualTotal)],
              ] as const
            ).map(([m, v]) => (
              <div key={m}>
                <dt className="text-[12px] text-ink-3">{METRIC_MAP[m].label}</dt>
                <dd className="text-[18px] font-bold tracking-tight">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 border-t border-line pt-3 text-[12px] text-ink-3">
            월 {baseCost.sessionsPerMonth}회 · 월 {hoursLabel(baseCost.hoursPerMonth)} 수업 (한 달 4주 기준)
          </p>
        </div>

        <div className="card mt-3 p-4">
          <h3 className="text-[15px] font-bold">같은 조건 학원과 비교</h3>
          <div className="mt-2">
            <MetricPicker value={metric} onChange={(m) => updateSettings({ metric: m })} />
          </div>
          {peer ? (
            <>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <PriceLevelBadge level={peer.level} compact />
                <p className="text-[14px]">
                  {peer.scopeLabel} {peer.stats.n}개 요금제 중 <b>저렴한 순 {peer.rank}번째</b> · 중앙값보다{' '}
                  <b className={peer.diffFromMedian <= 0 ? 'text-cheap' : 'text-pricey'}>{signedPercent(peer.diffFromMedian)}</b>
                </p>
              </div>
              <div className="mt-4">
                <RangeStrip stats={peer.stats} value={baseCost[metric]} format={fmt} />
              </div>
              <p className="mt-3 text-[12px] text-ink-3">
                비교 대상: {peer.scopeLabel} · {SUBJECT_MAP[plan.subjectId].name} · {plan.targets.map((t) => AGE_LABELS[t]).join('/')} · {CLASS_TYPE_LABELS[plan.classType]} 요금제.{' '}
                {PRICE_LEVEL_META[peer.level].tone === 'pricey' && alternatives.length > 0 && '아래에 더 저렴한 곳을 모았어요.'}
              </p>
            </>
          ) : (
            <p className="mt-3 text-[13px] text-ink-3">비교할 만큼 같은 조건의 학원이 많지 않아요.</p>
          )}
        </div>
      </Section>

      <Section title="내 조건으로 계산" desc="할인과 선택 비용을 넣어 실제로 낼 금액을 확인하세요">
        <div className="card p-4">
          <Toggle
            id="opt-extra"
            label="선택 비용도 포함"
            desc={academy.extraFees.filter((f) => !f.required).map((f) => f.name).join(', ') || '선택 비용 없음'}
            checked={includeOptional}
            onChange={setIncludeOptional}
          />
          {academy.discounts.length > 0 && (
            <div className="mt-2 border-t border-line pt-3">
              <p className="mb-1 text-[13px] font-semibold text-ink-2">받을 수 있는 할인</p>
              {academy.discounts.map((d) => (
                <Toggle
                  key={d.id}
                  id={`dsc-${d.id}`}
                  label={d.label}
                  desc={d.type === 'prepay' && plan.billing !== 'monthly' ? '기간권에는 적용되지 않아요' : undefined}
                  checked={discounts.includes(d.type)}
                  onChange={(v) => setDiscounts((prev) => (v ? [...prev, d.type] : prev.filter((x) => x !== d.type)))}
                />
              ))}
            </div>
          )}
          <table className="num mt-3 w-full border-t border-line text-[14px]">
            <tbody>
              {[
                ['월 수강료', won(cost.monthlyTuition), cost.monthlyTuition !== cost.baseMonthlyTuition ? `할인 전 ${won(cost.baseMonthlyTuition)}` : ''],
                ['매월 부대비용', won(cost.monthlyFees), '차량비·재료비 등'],
                ['정기 비용 (연간)', won(cost.periodicAnnual), '교재·심사·보험 등'],
                ['초기 비용 (1회)', won(cost.oneTime), '등록비·도복·장비 등'],
              ].map(([label, value, note]) => (
                <tr key={label} className="border-b border-line">
                  <th scope="row" className="py-2 text-left font-normal text-ink-2">
                    {label}
                    {note && <span className="block text-[11px] text-ink-3">{note}</span>}
                  </th>
                  <td className="py-2 text-right font-semibold">{value}</td>
                </tr>
              ))}
              <tr className="border-b border-line">
                <th scope="row" className="py-2 text-left font-semibold">
                  첫 결제 금액
                </th>
                <td className="py-2 text-right text-[16px] font-bold">{won(cost.firstPayment)}</td>
              </tr>
              <tr className="border-b border-line">
                <th scope="row" className="py-2 text-left font-semibold">
                  1년 총비용
                </th>
                <td className="py-2 text-right text-[16px] font-bold">{won(cost.annualTotal)}</td>
              </tr>
              <tr>
                <th scope="row" className="py-2 text-left font-semibold">
                  실질 월 부담
                </th>
                <td className="py-2 text-right text-[18px] font-bold text-accent">{won(cost.effectiveMonthly)}</td>
              </tr>
            </tbody>
          </table>
          {cost.annualSaving > 0 && (
            <p className="mt-2 rounded-lg bg-cheap-soft px-3 py-2 text-[13px] font-semibold text-cheap">할인으로 1년에 {won(cost.annualSaving)} 아낄 수 있어요</p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                const r = addCompare({ academyId: academy.id, planId: plan.id });
                showToast(r === 'full' ? '비교함은 최대 4곳까지 담을 수 있어요' : r === 'updated' ? '비교함의 요금제를 바꿨어요' : '비교함에 담았어요');
              }}
            >
              <Plus aria-hidden="true" className="h-4 w-4" /> 비교함 담기
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                addCalc({ person: '첫째', academyId: academy.id, planId: plan.id, discounts, includeOptional });
                showToast('내 학원비 계산기에 담았어요');
              }}
            >
              <Wallet aria-hidden="true" className="h-4 w-4" /> 계산기 담기
            </button>
          </div>
        </div>
      </Section>

      <Section title="부대비용" desc="주기별 금액과 1년 환산액">
        {academy.extraFees.length === 0 ? (
          <p className="card p-4 text-[14px] text-ink-2">별도 부대비용이 등록되지 않았어요.</p>
        ) : (
          <ul className="card divide-y divide-line">
            {academy.extraFees.map((f) => (
              <li key={f.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold">
                    {f.name}{' '}
                    <span className={`ml-1 rounded px-1 py-0.5 text-[11px] font-semibold ${f.required ? 'bg-pricey-soft text-pricey' : 'bg-surface-2 text-ink-3'}`}>
                      {f.required ? '필수' : '선택'}
                    </span>
                  </p>
                  <p className="text-[12px] text-ink-3">
                    {frequencyLabel(f)}
                    {f.note && ` · ${f.note}`}
                  </p>
                </div>
                <div className="num shrink-0 text-right">
                  <p className="text-[14px] font-bold">{won(f.amount)}</p>
                  <p className="text-[11px] text-ink-3">{f.frequency === 'once' ? '처음 한 번' : `연 ${manwon(annualRecurring(f))}`}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {academy.discounts.length > 0 && (
        <Section title="할인 혜택">
          <ul className="flex flex-wrap gap-2">
            {academy.discounts.map((d) => (
              <li key={d.id} className="rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-semibold">
                {d.label}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {academy.priceHistory.length > 2 && (
        <Section title="가격 변동" desc="매년 3월 기준 요금">
          <div className="card p-4">
            <PriceHistoryChart history={academy.priceHistory} plans={academy.plans} format={manwon} />
          </div>
        </Section>
      )}

      {alternatives.length > 0 && (
        <Section title="같은 조건, 더 저렴한 곳" desc={`${METRIC_MAP[metric].label} 기준 · 같은 구 우선`}>
          <ul className="card divide-y divide-line">
            {alternatives.map((alt) => {
              const diff = alt.cost[metric] - baseCost[metric];
              return (
                <li key={alt.academy.id}>
                  <Link to={`/academy/${alt.academy.id}?plan=${alt.plan.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                    <SubjectTile subjectId={alt.plan.subjectId} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">{alt.academy.name}</span>
                      <span className="block truncate text-[12px] text-ink-3">
                        {alt.academy.region.sigungu} {alt.academy.region.dong} · {alt.plan.name}
                      </span>
                    </span>
                    <span className="num shrink-0 text-right">
                      <span className="block text-[14px] font-bold">{fmt(alt.cost[metric])}</span>
                      <span className="block text-[12px] font-semibold text-cheap">{formatMetric(metric, diff)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      <Section title="학원 정보">
        <div className="card p-4 text-[14px]">
          <p className="text-ink-2">{academy.description}</p>
          <ul className="mt-3 flex flex-col gap-2">
            <li className="flex gap-2">
              <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
              {academy.address}
            </li>
            <li className="flex gap-2">
              <Phone aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
              <span className="select-all">{academy.phone}</span>
              <span className="text-[12px] text-ink-3">(예시 번호)</span>
            </li>
            <li className="flex gap-2">
              <Clock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
              {academy.hours}
            </li>
            <li className="flex gap-2">
              <Users aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
              {academy.isPublic ? '강사' : '선생님·코치'} {academy.teacherCount}명 · {academy.establishedYear}년 개원
            </li>
            <li className="flex gap-2">
              <Bus aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
              {academy.shuttle ? '차량 운행' : '차량 운행 없음'}
            </li>
            <li className="flex gap-2">
              <Car aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
              {academy.parking ? '주차 가능' : '주차 불가'}
            </li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {academy.features.map((f) => (
              <span key={f} className="rounded-md bg-surface-2 px-2 py-1 text-[12px] font-medium text-ink-2">
                {f}
              </span>
            ))}
          </div>
          {academy.trialClass.available && (
            <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-[13px] font-semibold text-accent">
              체험 수업 {academy.trialClass.price ? won(academy.trialClass.price) : '무료'}
            </p>
          )}
        </div>
      </Section>

      <Section title="후기" desc={`평점 ${academy.rating.toFixed(1)} · 가격 만족도 ${academy.priceSatisfaction.toFixed(1)} / 5`}>
        <ul className="flex flex-col gap-2">
          {academy.reviews.map((r) => (
            <li key={r.id} className="card p-4">
              <div className="flex items-center justify-between gap-2 text-[12px] text-ink-3">
                <span>
                  <Stars value={r.rating} /> <span className="ml-1">가격 만족 {r.priceSatisfaction}/5</span>
                </span>
                <span>
                  {r.author} · {dotDate(r.date)}
                </span>
              </div>
              <p className="mt-2 text-[14px]">{r.text}</p>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[12px] text-ink-3">예시 후기입니다.</p>
      </Section>

      <Section title="가격 제보" desc="실제로 안내받은 가격이 다르면 알려주세요. 이 기기에 저장됩니다.">
        {myReports.length > 0 && (
          <ul className="mb-3 flex flex-col gap-2">
            {myReports.map((r) => {
              const u = planUnits({ ...plan, billing: r.billing, price: r.price, sessionsPerWeek: r.sessionsPerWeek, minutesPerSession: r.minutesPerSession, months: r.months, totalSessions: r.totalSessions });
              return (
                <li key={r.id} className="card flex items-center justify-between gap-3 p-3 text-[13px]">
                  <span className="min-w-0">
                    <b className="block truncate">{r.planName}</b>
                    <span className="text-ink-3">
                      제보 {dotDate(r.createdAt)} · 주{r.sessionsPerWeek}회 {r.minutesPerSession}분
                    </span>
                  </span>
                  <span className="num shrink-0 text-right">
                    <b className="block">{manwon(r.price)}</b>
                    <span className="text-ink-3">시간당 {unitPrice(u.pricePerHour)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <PriceReportForm academy={academy} defaultPlan={plan} />
      </Section>
    </div>
  );
}
