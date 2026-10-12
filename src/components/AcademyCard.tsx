import { Heart, MapPin, Plus, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CLASS_TYPE_LABELS } from '../data/categories';
import { formatMetric, km, manwon, unitPrice } from '../lib/format';
import { METRIC_MAP, scheduleLabel, type Metric } from '../lib/pricing';
import type { SearchResult } from '../lib/search';
import { useApp } from '../store/AppContext';
import { PriceLevelBadge, SourceBadge, Stars, SubjectChips, SubjectTile } from './ui';

interface Props {
  result: Pick<SearchResult, 'academy' | 'plan' | 'cost' | 'value' | 'peer'> & Partial<Pick<SearchResult, 'matchingPlans' | 'distanceKm'>>;
  metric: Metric;
  cheapest?: boolean;
}

/** 다른 기준 두 개를 보조로 보여준다 (주 기준과 겹치지 않게) */
function secondaryMetrics(metric: Metric): Metric[] {
  const order: Metric[] = ['monthlyTuition', 'pricePerHour', 'effectiveMonthly', 'firstPayment'];
  return order.filter((m) => m !== metric).slice(0, 2);
}

export function AcademyCard({ result, metric, cheapest = false }: Props) {
  const { academy, plan, cost, value, peer } = result;
  const { toggleFavorite, isFavorite, addCompare, inCompare, removeCompare, showToast } = useApp();
  const fav = isFavorite(academy.id);
  const comparing = inCompare(academy.id);

  const onCompare = () => {
    if (comparing) {
      removeCompare(academy.id);
      showToast('비교함에서 뺐어요');
      return;
    }
    const r = addCompare({ academyId: academy.id, planId: plan.id });
    showToast(r === 'full' ? '비교함은 최대 4곳까지 담을 수 있어요' : `비교함에 담았어요 · ${plan.name}`);
  };

  return (
    <article className="card relative flex flex-col gap-3 p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3">
        <SubjectTile subjectId={plan.subjectId} />
        <div className="min-w-0 flex-1">
          <h3 className="pr-8 text-[16px] font-bold leading-snug">
            <Link to={`/academy/${academy.id}?plan=${plan.id}`} className="after:absolute after:inset-0 after:rounded-card hover:text-accent">
              {academy.name}
            </Link>
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-3">
            <SubjectChips subjectIds={academy.subjectIds} />
            <span className="inline-flex items-center gap-0.5">
              <MapPin aria-hidden="true" className="h-3 w-3" />
              {academy.region.sigungu} {academy.region.dong}
              {result.distanceKm != null && <b className="ml-1 font-semibold text-ink-2">{km(result.distanceKm)}</b>}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <Stars value={academy.rating} count={academy.reviewCount} />
            <SourceBadge source={academy.priceSource} />
            {academy.isPublic && <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold text-ink-2">공공시설</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            toggleFavorite(academy.id);
            showToast(fav ? '찜을 해제했어요' : '찜한 학원에 추가했어요');
          }}
          aria-pressed={fav}
          aria-label={fav ? '찜 해제' : '찜하기'}
          className="absolute right-3 top-3 z-10 rounded-full p-2 text-ink-3 hover:bg-surface-2"
        >
          <Heart className={`h-5 w-5 ${fav ? 'fill-pricey text-pricey' : ''}`} />
        </button>
      </div>

      <div className="rounded-xl bg-surface-2 px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-2 text-[12px] text-ink-2">
          <span className="min-w-0 truncate font-medium text-ink">{plan.name}</span>
          {result.matchingPlans && result.matchingPlans > 1 ? <span className="shrink-0 text-ink-3">외 {result.matchingPlans - 1}개 요금제</span> : null}
        </div>
        <div className="mt-0.5 text-[12px] text-ink-3">
          {scheduleLabel(plan)} · {CLASS_TYPE_LABELS[plan.classType]}
          {plan.classType !== 'private' && ` ${plan.maxStudents}명`}
        </div>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
          <div>
            <div className="text-[11px] font-semibold text-ink-3">{METRIC_MAP[metric].label}</div>
            <div className="flex items-center gap-1.5">
              <span className="text-[22px] font-bold leading-tight tracking-tight">{formatMetric(metric, value)}</span>
              {cheapest && <span className="price-tag">최저가</span>}
            </div>
          </div>
          <dl className="num flex gap-3 text-right text-[12px]">
            {secondaryMetrics(metric).map((m) => (
              <div key={m}>
                <dt className="text-ink-3">{METRIC_MAP[m].short}</dt>
                <dd className="font-semibold text-ink-2">
                  {m === 'pricePerHour' || m === 'pricePerSession' ? unitPrice(cost[m]) : manwon(cost[m])}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap gap-1">
          {peer && <PriceLevelBadge level={peer.level} diff={peer.diffFromMedian} />}
          {academy.discounts.length > 0 && (
            <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold text-ink-2">할인 {academy.discounts.length}</span>
          )}
          {academy.shuttle && <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold text-ink-2">차량</span>}
          {academy.trialClass.available && (
            <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold text-ink-2">
              {academy.trialClass.price ? '체험' : '무료체험'}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onCompare}
          aria-pressed={comparing}
          className={`relative z-10 inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold transition-colors ${
            comparing ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-ink-2 hover:bg-surface-2'
          }`}
        >
          {comparing ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : <Plus aria-hidden="true" className="h-3.5 w-3.5" />}
          {comparing ? '비교 중' : '비교'}
        </button>
      </div>
    </article>
  );
}
