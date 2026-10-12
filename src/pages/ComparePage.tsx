import { Trash, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CostStack } from '../charts/CostStack';
import { EmptyState, PageHeader, PriceLevelBadge, Section, SubjectTile, Toggle } from '../components/ui';
import { getAcademy } from '../data';
import { CLASS_TYPE_LABELS, SUBJECT_MAP } from '../data/categories';
import { useAcademies, useOrigin } from '../hooks';
import { hoursLabel, km, manwon, unitPrice, withJosa, won } from '../lib/format';
import { distanceKm } from '../lib/geo';
import { comparePlanToPeers } from '../lib/market';
import { billingLabel, computeCost, METRIC_MAP, scheduleLabel, type CostBreakdown, type Metric } from '../lib/pricing';
import { EMPTY_FILTERS, searchAcademies } from '../lib/search';
import { MAX_COMPARE, useApp } from '../store/AppContext';
import type { Academy, DiscountType, PricePlan } from '../types';

interface Column {
  academy: Academy;
  plan: PricePlan;
  cost: CostBreakdown;
}

type RowDef = {
  key: string;
  label: string;
  hint?: string;
  value: (c: Column) => number | null;
  format: (v: number, c: Column) => string;
  /** 'low' = 낮을수록 좋음, 'high' = 높을수록 좋음 */
  better?: 'low' | 'high';
  strong?: boolean;
};

export function ComparePage() {
  const academies = useAcademies();
  const origin = useOrigin();
  const { compare, removeCompare, setComparePlan, clearCompare, addCompare, settings, showToast } = useApp();
  const [includeOptional, setIncludeOptional] = useState(false);
  const [discountTypes, setDiscountTypes] = useState<DiscountType[]>([]);

  const columns: Column[] = useMemo(
    () =>
      compare
        .map((item) => {
          const academy = getAcademy(item.academyId);
          if (!academy) return null;
          const plan = academy.plans.find((p) => p.id === item.planId) ?? academy.plans[0];
          return { academy, plan, cost: computeCost(academy, plan, { includeOptional, discounts: discountTypes }) };
        })
        .filter((c): c is Column => c !== null),
    [compare, includeOptional, discountTypes],
  );

  const loadExample = () => {
    const home = settings.home;
    const picks = searchAcademies(
      academies,
      { ...EMPTY_FILTERS, subjectIds: ['math'], ages: ['elementary'], classTypes: ['group'], sido: home?.sido ?? '서울' },
      'distance',
      'effectiveMonthly',
      { origin, withPeers: false },
    ).slice(0, 3);
    for (const p of picks) addCompare({ academyId: p.academy.id, planId: p.plan.id });
    showToast('가까운 초등 수학 학원 3곳을 예시로 담았어요');
  };

  if (columns.length === 0) {
    return (
      <div>
        <PageHeader title="가격 비교" subtitle="최대 4곳을 같은 기준으로 나란히 비교해요" />
        <EmptyState
          title="비교함이 비어 있어요"
          desc="검색 결과나 학원 상세에서 '비교'를 누르면 여기에 담겨요. 요금제가 달라도 시간당 단가와 1년 총비용으로 공정하게 비교합니다."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" className="btn-primary" onClick={loadExample}>
                예시로 비교해 보기
              </button>
              <Link to="/search" className="btn-ghost">
                학원 찾기
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  const subjects = new Set(columns.map((c) => c.plan.subjectId));
  const offeredDiscounts = Array.from(new Map(columns.flatMap((c) => c.academy.discounts).map((d) => [d.type, d])).values());
  const peerOf = (c: Column, metric: Metric) => comparePlanToPeers(academies, c.academy, c.plan, metric, c.cost);

  const rows: { group: string; items: RowDef[] }[] = [
    {
      group: '핵심 비교',
      items: [
        { key: 'eff', label: '실질 월 부담', hint: '부대비용·초기비용 포함 1년 ÷ 12', value: (c) => c.cost.effectiveMonthly, format: (v) => won(v), better: 'low', strong: true },
        { key: 'pph', label: '시간당 단가', hint: '수강료 ÷ 월 수업 시간', value: (c) => c.cost.pricePerHour, format: (v) => unitPrice(v), better: 'low', strong: true },
        { key: 'annual', label: '1년 총비용', value: (c) => c.cost.annualTotal, format: (v) => won(v), better: 'low', strong: true },
        { key: 'first', label: '첫 결제 금액', hint: '기간권 총액·등록비·도복 등', value: (c) => c.cost.firstPayment, format: (v) => won(v), better: 'low' },
      ],
    },
    {
      group: '수강료',
      items: [
        { key: 'billed', label: '안내 가격', value: (c) => c.plan.price, format: (v, c) => `${billingLabel(c.plan)} ${won(v)}` },
        { key: 'monthly', label: '월 환산 수강료', value: (c) => c.cost.monthlyTuition, format: (v) => won(v), better: 'low' },
        { key: 'pps', label: '회당 단가', value: (c) => c.cost.pricePerSession, format: (v) => unitPrice(v), better: 'low' },
        { key: 'hours', label: '월 수업 시간', value: (c) => c.cost.hoursPerMonth, format: (v, c) => `${hoursLabel(v)} (${c.cost.sessionsPerMonth}회)`, better: 'high' },
        { key: 'size', label: '정원', value: (c) => (c.plan.classType === 'private' ? 1 : c.plan.maxStudents), format: (v, c) => (c.plan.classType === 'private' ? '1:1' : `${v}명`), better: 'low' },
      ],
    },
    {
      group: '부대비용',
      items: [
        { key: 'mfee', label: '매월 부대비용', value: (c) => c.cost.monthlyFees, format: (v) => won(v), better: 'low' },
        { key: 'pfee', label: '정기 비용 (연간)', value: (c) => c.cost.periodicAnnual, format: (v) => won(v), better: 'low' },
        { key: 'once', label: '초기 비용', value: (c) => c.cost.oneTime, format: (v) => won(v), better: 'low' },
      ],
    },
    {
      group: '시세 · 평가',
      items: [
        {
          key: 'peer',
          label: '같은 조건 시세 대비',
          hint: '시간당 단가 기준',
          value: (c) => peerOf(c, 'pricePerHour')?.diffFromMedian ?? null,
          format: (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`,
          better: 'low',
        },
        { key: 'rating', label: '평점', value: (c) => c.academy.rating, format: (v, c) => `${v.toFixed(1)} (${c.academy.reviewCount})`, better: 'high' },
        { key: 'psat', label: '가격 만족도', value: (c) => c.academy.priceSatisfaction, format: (v) => `${v.toFixed(1)} / 5`, better: 'high' },
        ...(origin
          ? [{ key: 'dist', label: '내 동네에서 거리', value: (c: Column) => distanceKm(origin.lat, origin.lng, c.academy.lat, c.academy.lng), format: (v: number) => km(v), better: 'low' as const }]
          : []),
      ],
    },
  ];

  const bestOf = (row: RowDef): number | null => {
    if (!row.better || columns.length < 2) return null;
    const values = columns.map(row.value).filter((v): v is number => v !== null);
    if (values.length < 2 || new Set(values).size === 1) return null;
    return row.better === 'low' ? Math.min(...values) : Math.max(...values);
  };

  const byAnnual = [...columns].sort((a, b) => a.cost.annualTotal - b.cost.annualTotal);
  const cheapest = byAnnual[0];
  const priciest = byAnnual[byAnnual.length - 1];
  const byHour = [...columns].sort((a, b) => a.cost.pricePerHour - b.cost.pricePerHour);
  const hourDiffers = columns.length > 1 && byHour[0].academy.id !== cheapest.academy.id;

  return (
    <div>
      <PageHeader
        title="가격 비교"
        subtitle={`${columns.length}곳 · 최대 ${MAX_COMPARE}곳`}
        action={
          <button type="button" className="btn-ghost px-3 py-2 text-[13px]" onClick={clearCompare}>
            <Trash aria-hidden="true" className="h-4 w-4" /> 비우기
          </button>
        }
      />

      {columns.length > 1 && (
        <section className="card p-4" aria-label="비교 요약">
          <p className="text-[16px] leading-relaxed">
            1년 기준 <b>{withJosa(cheapest.academy.name, '이', '가')}</b> 가장 저렴하고, <b>{priciest.academy.name}</b>보다{' '}
            <b className="text-cheap">{manwon(priciest.cost.annualTotal - cheapest.cost.annualTotal)}</b> 덜 들어요.
          </p>
          {hourDiffers && (
            <p className="mt-2 text-[14px] text-ink-2">
              다만 수업 시간까지 따지면 <b className="text-ink">{byHour[0].academy.name}</b>의 시간당 단가({unitPrice(byHour[0].cost.pricePerHour)})가 가장 낮아요.
            </p>
          )}
          {subjects.size > 1 && (
            <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-ink-2">
              서로 다른 과목({Array.from(subjects).map((s) => SUBJECT_MAP[s].name).join(', ')})을 비교 중이에요. 총비용 예산 비교용으로 보세요.
            </p>
          )}
        </section>
      )}

      <section className="card mt-3 p-4" aria-label="비교 조건">
        <Toggle id="cmp-optional" label="선택 비용 포함" desc="호구, 개인 장비, 대회 참가비 등" checked={includeOptional} onChange={setIncludeOptional} />
        {offeredDiscounts.length > 0 && (
          <div className="mt-1 border-t border-line pt-2">
            <p className="mb-1 text-[13px] font-semibold text-ink-2">할인 적용 (제공하는 학원에만 반영)</p>
            {offeredDiscounts.map((d) => (
              <Toggle
                key={d.type}
                id={`cmp-dsc-${d.type}`}
                label={{ sibling: '형제·자매 할인', prepay: '선납 할인', multi_subject: '다과목 할인', first_month: '첫 달 할인', card: '제휴카드 할인' }[d.type]}
                checked={discountTypes.includes(d.type)}
                onChange={(v) => setDiscountTypes((prev) => (v ? [...prev, d.type] : prev.filter((x) => x !== d.type)))}
              />
            ))}
          </div>
        )}
      </section>

      <div className="mt-3 overflow-x-auto rounded-card border border-line bg-surface">
        <table className="num w-full min-w-[520px] border-collapse text-[13px]">
          <caption className="sr-only">학원별 가격 비교표</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 w-[6.5rem] bg-surface p-3 text-left align-bottom text-[12px] font-semibold text-ink-3">
                항목
              </th>
              {columns.map((c) => (
                <th key={c.academy.id} scope="col" className="min-w-[140px] border-l border-line p-3 text-left align-top font-normal">
                  <div className="flex items-start justify-between gap-1">
                    <SubjectTile subjectId={c.plan.subjectId} size="sm" />
                    <button type="button" aria-label={`${c.academy.name} 빼기`} className="rounded p-1 text-ink-3 hover:bg-surface-2" onClick={() => removeCompare(c.academy.id)}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <Link to={`/academy/${c.academy.id}?plan=${c.plan.id}`} className="mt-1.5 block text-[14px] font-bold leading-snug hover:text-accent">
                    {c.academy.name}
                  </Link>
                  <span className="block text-[11px] text-ink-3">
                    {c.academy.region.sigungu} {c.academy.region.dong}
                  </span>
                  <label className="sr-only" htmlFor={`cmp-plan-${c.academy.id}`}>
                    {c.academy.name} 요금제
                  </label>
                  <select
                    id={`cmp-plan-${c.academy.id}`}
                    className="field mt-2 px-2 py-1.5 text-[12px]"
                    value={c.plan.id}
                    onChange={(e) => setComparePlan(c.academy.id, e.target.value)}
                  >
                    {c.academy.plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-[11px] text-ink-3">
                    {scheduleLabel(c.plan)} · {CLASS_TYPE_LABELS[c.plan.classType]}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          {rows.map((group) => (
            <tbody key={group.group}>
              <tr>
                <th colSpan={columns.length + 1} scope="colgroup" className="bg-surface-2 px-3 py-1.5 text-left text-[12px] font-bold text-ink-2">
                  {group.group}
                </th>
              </tr>
              {group.items.map((row) => {
                const best = bestOf(row);
                return (
                  <tr key={row.key} className="border-t border-line">
                    <th scope="row" className="sticky left-0 z-10 bg-surface p-3 text-left align-top font-medium text-ink-2">
                      {row.label}
                      {row.hint && <span className="block text-[11px] font-normal text-ink-3">{row.hint}</span>}
                    </th>
                    {columns.map((c) => {
                      const v = row.value(c);
                      const isBest = v !== null && best !== null && v === best;
                      return (
                        <td key={c.academy.id} className={`border-l border-line p-3 align-top ${row.strong ? 'text-[15px] font-bold' : 'font-semibold'}`}>
                          {v === null ? (
                            <span className="text-ink-3">-</span>
                          ) : (
                            <span className="inline-flex flex-wrap items-center gap-1">
                              {row.format(v, c)}
                              {isBest && <span className="price-tag">{row.better === 'low' ? '최저' : '최고'}</span>}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          ))}
          <tbody>
            <tr className="border-t border-line">
              <th scope="row" className="sticky left-0 z-10 bg-surface p-3 text-left align-top font-medium text-ink-2">
                시세 위치
              </th>
              {columns.map((c) => {
                const peer = peerOf(c, settings.metric);
                return (
                  <td key={c.academy.id} className="border-l border-line p-3 align-top">
                    {peer ? <PriceLevelBadge level={peer.level} /> : <span className="text-ink-3">-</span>}
                    <span className="mt-1 block text-[11px] text-ink-3">{METRIC_MAP[settings.metric].label} 기준</span>
                  </td>
                );
              })}
            </tr>
            <tr className="border-t border-line">
              <th scope="row" className="sticky left-0 z-10 bg-surface p-3 text-left align-top font-medium text-ink-2">
                혜택·편의
              </th>
              {columns.map((c) => (
                <td key={c.academy.id} className="border-l border-line p-3 align-top text-[12px] text-ink-2">
                  <ul className="flex flex-col gap-0.5">
                    <li>{c.academy.shuttle ? '차량 운행' : '차량 없음'}</li>
                    <li>{c.academy.trialClass.available ? `체험 ${c.academy.trialClass.price ? won(c.academy.trialClass.price) : '무료'}` : '체험 없음'}</li>
                    {c.academy.discounts.map((d) => (
                      <li key={d.id} className={c.cost.appliedDiscounts.some((a) => a.id === d.id) ? 'font-semibold text-cheap' : ''}>
                        {d.label}
                      </li>
                    ))}
                  </ul>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[12px] text-ink-3">표가 넓으면 옆으로 밀어서 보세요. 노란 표시는 항목별 가장 유리한 값이에요.</p>

      <Section title="1년 비용 구성" desc="같은 길이 기준으로 어디에 돈이 드는지 비교">
        <div className="card p-4">
          <CostStack
            format={manwon}
            segmentLabels={['수강료', '매월 부대비용', '정기 비용', '초기 비용']}
            rows={byAnnual.map((c, i) => ({
              key: c.academy.id,
              label: c.academy.name,
              best: i === 0 && columns.length > 1,
              segments: [c.cost.annualTotal - c.cost.monthlyFees * 12 - c.cost.periodicAnnual - c.cost.oneTime, c.cost.monthlyFees * 12, c.cost.periodicAnnual, c.cost.oneTime],
            }))}
          />
        </div>
      </Section>

      {columns.length < MAX_COMPARE && (
        <Link to="/search" className="btn-ghost mt-4 w-full">
          학원 더 담기 ({MAX_COMPARE - columns.length}곳 가능)
        </Link>
      )}
    </div>
  );
}
