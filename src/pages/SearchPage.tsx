import { ChevronDown, MapPin, Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Histogram } from '../charts/Histogram';
import { RangeStrip } from '../charts/RangeStrip';
import { AcademyCard } from '../components/AcademyCard';
import { MetricPicker } from '../components/MetricPicker';
import { RegionPicker } from '../components/RegionPicker';
import { ChipToggle, EmptyState, Segmented, Sheet, Toggle } from '../components/ui';
import { AGE_LABELS, AGE_ORDER, CLASS_TYPE_LABELS, GROUPS, SUBJECTS } from '../data/categories';
import { useAcademies, useOrigin } from '../hooks';
import { formatMetric, shortMan } from '../lib/format';
import { METRIC_MAP } from '../lib/pricing';
import { countActiveFilters, EMPTY_FILTERS, searchAcademies, SORTS, type SearchFilters, type SortKey } from '../lib/search';
import { filtersFromParams, paramsFromFilters } from '../lib/searchParams';
import { summarize } from '../lib/stats';
import { useApp } from '../store/AppContext';
import type { CategoryGroup, ClassType } from '../types';

const PAGE = 20;

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="border-b border-line py-4 first:pt-0 last:border-0">
      <h3 id={id} className="mb-2 text-[13px] font-bold text-ink">
        {title}
      </h3>
      {children}
    </div>
  );
}

interface PanelProps {
  /** 사이드바와 모바일 시트에 패널이 동시에 있으므로 id 가 겹치지 않게 접두어를 다르게 준다 */
  idPrefix: string;
  filters: SearchFilters;
  update: (patch: Partial<SearchFilters>) => void;
  hasOrigin: boolean;
  homeLabel: string;
  presets: { label: string; max: number }[];
  metricUnit: string;
}

function FilterPanel({ idPrefix, filters, update, hasOrigin, homeLabel, presets, metricUnit }: PanelProps) {
  const toMan = (v: number | null) => (v == null ? '' : String(Math.round((v / 10000) * 10) / 10));
  const fromMan = (s: string) => (s.trim() === '' ? null : Math.round(Number(s) * 10000));
  return (
    <div>
      <FilterGroup title="지역">
        <RegionPicker idPrefix={idPrefix} sido={filters.sido} sigungu={filters.sigungu} onChange={(sido, sigungu) => update({ sido, sigungu })} />
        <div className="mt-3">
          <span className="label">내 동네({homeLabel})에서 거리</span>
          <div className="flex flex-wrap gap-1.5">
            {[null, 1, 3, 5, 10].map((d) => (
              <ChipToggle key={String(d)} pressed={filters.maxDistanceKm === d} onClick={() => update({ maxDistanceKm: d })}>
                {d == null ? '제한 없음' : `${d}km 이내`}
              </ChipToggle>
            ))}
          </div>
          {!hasOrigin && <p className="mt-1 text-[12px] text-ink-3">상단에서 동네를 설정하면 거리로 거를 수 있어요.</p>}
        </div>
      </FilterGroup>
      <FilterGroup title="대상">
        <div className="flex flex-wrap gap-1.5">
          {AGE_ORDER.map((a) => (
            <ChipToggle key={a} pressed={filters.ages.includes(a)} onClick={() => update({ ages: toggle(filters.ages, a) })}>
              {AGE_LABELS[a]}
            </ChipToggle>
          ))}
        </div>
      </FilterGroup>
      <FilterGroup title="수업 형태">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(CLASS_TYPE_LABELS) as ClassType[]).map((c) => (
            <ChipToggle key={c} pressed={filters.classTypes.includes(c)} onClick={() => update({ classTypes: toggle(filters.classTypes, c) })}>
              {CLASS_TYPE_LABELS[c]}
            </ChipToggle>
          ))}
        </div>
      </FilterGroup>
      <FilterGroup title="주당 수업 횟수">
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 5].map((n) => (
            <ChipToggle key={n} pressed={filters.sessions.includes(n)} onClick={() => update({ sessions: toggle(filters.sessions, n) })}>
              {n === 5 ? '주5회 이상' : `주${n}회`}
            </ChipToggle>
          ))}
        </div>
      </FilterGroup>
      <FilterGroup title={`가격 (${metricUnit} 기준, 만원)`}>
        <div className="flex items-center gap-2">
          <label htmlFor={`${idPrefix}-pmin`} className="sr-only">
            최소 금액
          </label>
          <input
            id={`${idPrefix}-pmin`}
            inputMode="decimal"
            className="field"
            placeholder="최소"
            value={toMan(filters.priceMin)}
            onChange={(e) => update({ priceMin: fromMan(e.target.value) })}
          />
          <span className="text-ink-3">~</span>
          <label htmlFor={`${idPrefix}-pmax`} className="sr-only">
            최대 금액
          </label>
          <input
            id={`${idPrefix}-pmax`}
            inputMode="decimal"
            className="field"
            placeholder="최대"
            value={toMan(filters.priceMax)}
            onChange={(e) => update({ priceMax: fromMan(e.target.value) })}
          />
        </div>
        {presets.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <ChipToggle key={p.label} pressed={filters.priceMax === p.max && filters.priceMin == null} onClick={() => update({ priceMin: null, priceMax: p.max })}>
                {p.label}
              </ChipToggle>
            ))}
          </div>
        )}
      </FilterGroup>
      <FilterGroup title="조건">
        <Toggle id={`${idPrefix}-shuttle`} label="차량 운행" checked={filters.shuttle} onChange={(v) => update({ shuttle: v })} />
        <Toggle id={`${idPrefix}-trial`} label="체험 수업 가능" checked={filters.trial} onChange={(v) => update({ trial: v })} />
        <Toggle id={`${idPrefix}-discount`} label="할인 혜택 있음" desc="형제·선납·다과목 할인 등" checked={filters.discountOnly} onChange={(v) => update({ discountOnly: v })} />
        <Toggle
          id={`${idPrefix}-verified`}
          label="교육청 신고가만"
          desc="교육청에 신고된 교습비 기준 학원"
          checked={filters.verifiedOnly}
          onChange={(v) => update({ verifiedOnly: v })}
        />
        <Toggle id={`${idPrefix}-public`} label="구립·공공시설만" desc="수영장·체육센터 등" checked={filters.publicOnly} onChange={(v) => update({ publicOnly: v })} />
      </FilterGroup>
      <FilterGroup title="평점">
        <div className="flex flex-wrap gap-1.5">
          {[0, 4, 4.5].map((r) => (
            <ChipToggle key={r} pressed={filters.minRating === r} onClick={() => update({ minRating: r })}>
              {r === 0 ? '전체' : `${r} 이상`}
            </ChipToggle>
          ))}
        </div>
      </FilterGroup>
    </div>
  );
}

export function SearchPage() {
  const academies = useAcademies();
  const origin = useOrigin();
  const { settings, updateSettings } = useApp();
  const metric = settings.metric;
  const [params, setParams] = useSearchParams();
  const { filters, sort } = useMemo(() => filtersFromParams(params), [params]);
  const [qDraft, setQDraft] = useState(filters.q);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showDist, setShowDist] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => setQDraft(filters.q), [filters.q]);
  useEffect(() => setLimit(PAGE), [params, metric]);

  const apply = (next: SearchFilters, nextSort: SortKey = sort) => setParams(paramsFromFilters(next, nextSort), { replace: true });
  const update = (patch: Partial<SearchFilters>) => apply({ ...filters, ...patch });

  const results = useMemo(() => searchAcademies(academies, filters, sort, metric, { origin }), [academies, filters, sort, metric, origin]);
  // 가격 범위 프리셋은 가격 필터를 뺀 결과 분포로 만든다
  const unpricedStats = useMemo(() => {
    const base = searchAcademies(academies, { ...filters, priceMin: null, priceMax: null }, 'price_asc', metric, { origin, withPeers: false });
    return summarize(base.map((r) => r.value));
  }, [academies, filters, metric, origin]);
  const stats = useMemo(() => summarize(results.map((r) => r.value)), [results]);
  const cheapestValue = results.length ? Math.min(...results.map((r) => r.value)) : null;
  const fmt = (v: number) => formatMetric(metric, v);
  const activeCount = countActiveFilters(filters) - (filters.group !== 'all' ? 1 : 0) - (filters.subjectIds.length ? 1 : 0);
  const visibleSubjects = SUBJECTS.filter((s) => filters.group === 'all' || s.group === filters.group);
  const presets = unpricedStats
    ? [
        { label: `하위 25% (${fmt(unpricedStats.p25)} 이하)`, max: Math.round(unpricedStats.p25) },
        { label: `중앙값 이하 (${fmt(unpricedStats.median)})`, max: Math.round(unpricedStats.median) },
      ]
    : [];
  const homeLabel = settings.home?.sigungu ?? '미설정';

  return (
    <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-6">
      <aside className="hidden lg:block">
        <div className="card sticky top-[4.5rem] max-h-[calc(100vh-6rem)] overflow-y-auto p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-bold">필터</h2>
            {activeCount > 0 && (
              <button type="button" className="text-[13px] font-semibold text-accent" onClick={() => apply({ ...EMPTY_FILTERS, q: filters.q, group: filters.group, subjectIds: filters.subjectIds })}>
                초기화
              </button>
            )}
          </div>
          <FilterPanel idPrefix="side" filters={filters} update={update} hasOrigin={!!origin} homeLabel={homeLabel} presets={presets} metricUnit={METRIC_MAP[metric].label} />
        </div>
      </aside>

      <div className="min-w-0">
        <form
          role="search"
          className="relative"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: qDraft.trim() });
          }}
        >
          <label htmlFor="search-q" className="sr-only">
            검색어
          </label>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-3" />
          <input
            id="search-q"
            className="field h-12 pl-10 pr-10 text-[15px]"
            placeholder="과목, 동네, 학원 이름"
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
          />
          {qDraft && (
            <button
              type="button"
              aria-label="검색어 지우기"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-3 hover:bg-surface-2"
              onClick={() => {
                setQDraft('');
                update({ q: '' });
              }}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>

        <div className="mt-3">
          <Segmented<CategoryGroup | 'all'>
            ariaLabel="분야"
            value={filters.group}
            onChange={(g) => update({ group: g, subjectIds: filters.subjectIds.filter((id) => g === 'all' || SUBJECTS.find((s) => s.id === id)?.group === g) })}
            options={[{ id: 'all', label: '전체' }, ...GROUPS.map((g) => ({ id: g.id, label: g.name }))]}
          />
        </div>
        <div className="scroll-x mt-2" aria-label="과목">
          {visibleSubjects.map((s) => (
            <ChipToggle key={s.id} pressed={filters.subjectIds.includes(s.id)} onClick={() => update({ subjectIds: toggle(filters.subjectIds, s.id) })}>
              {s.name}
            </ChipToggle>
          ))}
        </div>

        <div className="mt-4">
          <MetricPicker value={metric} onChange={(m) => {
            updateSettings({ metric: m });
            if (filters.priceMin != null || filters.priceMax != null) update({ priceMin: null, priceMax: null });
          }} />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button type="button" className="btn-ghost px-3 py-2 lg:hidden" onClick={() => setSheetOpen(true)}>
            <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
            필터
            {activeCount > 0 && <span className="rounded-full bg-accent px-1.5 text-[11px] text-on-accent">{activeCount}</span>}
          </button>
          {filters.sido || filters.sigungu ? (
            <button type="button" className="chip" aria-pressed="true" onClick={() => update({ sido: '', sigungu: '' })} aria-label={`${filters.sido} ${filters.sigungu} 지역 조건 해제`}>
              {filters.sigungu ? `${filters.sido} ${filters.sigungu}` : filters.sido}
              <X aria-hidden="true" className="h-3 w-3" />
            </button>
          ) : (
            settings.home && (
              <button type="button" className="chip" aria-pressed="false" onClick={() => update({ sido: settings.home!.sido, sigungu: settings.home!.sigungu })}>
                <MapPin aria-hidden="true" className="h-3 w-3" />
                {settings.home.sigungu}만
              </button>
            )
          )}
          <div className="ml-auto">
            <label htmlFor="search-sort" className="sr-only">
              정렬
            </label>
            <select id="search-sort" className="field w-auto py-2" value={sort} onChange={(e) => apply(filters, e.target.value as SortKey)}>
              {SORTS.map((s) => (
                <option key={s.id} value={s.id} disabled={s.id === 'distance' && !origin}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {stats && (
          <section className="card mt-3 p-4" aria-label="검색 결과 가격 요약">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[15px]">
                <b className="text-[18px]">{results.length.toLocaleString()}곳</b>
                <span className="text-ink-2"> · {METRIC_MAP[metric].label} 기준</span>
              </p>
              <p className="num text-[13px] text-ink-2">
                평균 <b className="text-ink">{fmt(stats.mean)}</b>
              </p>
            </div>
            <div className="mt-3">
              <RangeStrip stats={stats} format={fmt} />
            </div>
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-accent"
              aria-expanded={showDist}
              onClick={() => setShowDist((v) => !v)}
            >
              가격 분포 {showDist ? '접기' : '보기'}
              <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform ${showDist ? 'rotate-180' : ''}`} />
            </button>
            {showDist && (
              <div className="mt-2">
                <Histogram values={results.map((r) => r.value)} median={stats.median} format={fmt} tickFormat={shortMan} />
              </div>
            )}
          </section>
        )}

        <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {results.slice(0, limit).map((r) => (
            <AcademyCard key={r.academy.id} result={r} metric={metric} cheapest={r.value === cheapestValue && results.length > 1} />
          ))}
        </div>
        {results.length === 0 && (
          <EmptyState
            title="조건에 맞는 학원이 없어요"
            desc="필터를 줄이거나 지역을 넓혀 보세요."
            action={
              <button type="button" className="btn-ghost" onClick={() => apply({ ...EMPTY_FILTERS })}>
                조건 모두 지우기
              </button>
            }
          />
        )}
        {results.length > limit && (
          <button type="button" className="btn-ghost mt-4 w-full" onClick={() => setLimit((l) => l + PAGE)}>
            더 보기 ({(results.length - limit).toLocaleString()}곳 남음)
          </button>
        )}
      </div>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="필터"
        footer={
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={() => apply({ ...EMPTY_FILTERS, q: filters.q, group: filters.group, subjectIds: filters.subjectIds })}>
              초기화
            </button>
            <button type="button" className="btn-primary flex-1" onClick={() => setSheetOpen(false)}>
              {results.length.toLocaleString()}곳 보기
            </button>
          </div>
        }
      >
        <FilterPanel idPrefix="sheet" filters={filters} update={update} hasOrigin={!!origin} homeLabel={homeLabel} presets={presets} metricUnit={METRIC_MAP[metric].label} />
      </Sheet>
    </div>
  );
}
