import { ChevronDown, MapPin, Search, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Histogram } from '../charts/Histogram';
import { AcademyCard } from '../components/AcademyCard';
import { DataStamp, DistrictGate, ErrorState, LoadingState, SportsNotice } from '../components/DataState';
import { RegionPicker } from '../components/RegionPicker';
import { SubjectPicker } from '../components/SubjectPicker';
import { EmptyState, PageHeader, Segmented, Sheet, Toggle } from '../components/ui';
import { AGE_LABELS, AGE_ORDER, SUBJECT_MAP } from '../data/categories';
import { findDistrict } from '../data/regions';
import type { DistrictData } from '../data/source';
import { useDistrictData, useMarket } from '../hooks';
import { manwon, shortMan } from '../lib/format';
import { searchAcademies, SORT_OPTIONS, type SearchFilters, type SortKey } from '../lib/realSearch';
import { summarize } from '../lib/stats';
import { useApp } from '../store/AppContext';
import type { AgeGroup } from '../types';

const PAGE = 30;

function readFilters(params: URLSearchParams): SearchFilters & { sort: SortKey } {
  const age = params.get('age') ?? '';
  const kind = params.get('kind') ?? '';
  const sort = params.get('sort') ?? '';
  return {
    text: params.get('q') ?? '',
    subject: SUBJECT_MAP[params.get('subject') ?? ''] ? params.get('subject')! : '',
    age: (AGE_ORDER as string[]).includes(age) ? (age as AgeGroup) : '',
    kind: kind === '학원' || kind === '교습소' ? kind : '',
    pricedOnly: params.get('priced') === '1',
    includeUnknown: params.get('unk') !== '0',
    sort: SORT_OPTIONS.some((o) => o.id === sort) ? (sort as SortKey) : 'price',
  };
}

/** '더 보기'로 늘린 개수를 검색 조건별로 기억해, 학원을 보고 돌아와도 보던 자리까지 목록이 남게 한다 */
function readLimit(key: string): number {
  try {
    const n = Number(sessionStorage.getItem(key));
    return Number.isFinite(n) && n > PAGE ? n : PAGE;
  } catch {
    return PAGE;
  }
}

function Results({ data, filters, sort, onSort }: { data: DistrictData; filters: SearchFilters; sort: SortKey; onSort: (s: SortKey) => void }) {
  const market = useMarket([data]);
  const hits = useMemo(() => searchAcademies(data, filters, market.rows, sort), [data, filters, market.rows, sort]);
  const limitKey = `search-limit:${data.sido}|${data.sigungu}|${JSON.stringify(filters)}|${sort}`;
  const [shown, setShown] = useState(() => ({ key: limitKey, n: readLimit(limitKey) }));
  const limit = shown.key === limitKey ? shown.n : readLimit(limitKey);
  const showMore = () => {
    const n = limit + PAGE;
    setShown({ key: limitKey, n });
    try {
      sessionStorage.setItem(limitKey, String(n));
    } catch {
      // 저장이 막힌 브라우저에서는 이번 화면에서만 늘린다
    }
  };
  const priced = hits.filter((h) => h.rep);
  // 시세와 같은 기준: 학원마다 대표 과정 금액 하나
  const prices = useMemo(() => (filters.subject ? hits.flatMap((h) => (h.rep ? [h.rep.price] : [])) : []), [hits, filters.subject]);
  const stats = summarize(prices);
  const region = { sido: data.sido, sigungu: data.sigungu };
  // 시세가 늦게 오면 정렬·배지가 바뀌어 보이므로 다 받은 뒤에 보여 준다
  if (market.loading) return <LoadingState message="교습비 시세를 불러오는 중…" />;
  if (market.error) return <ErrorState message={market.error} onRetry={() => window.location.reload()} />;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-2" aria-live="polite">
          <b className="text-ink">{hits.length.toLocaleString()}곳</b> · 교습비 공개 {priced.length.toLocaleString()}곳
        </p>
        <label className="flex items-center gap-2 text-[13px] text-ink-2">
          <span className="sr-only">정렬</span>
          <select className="field w-auto py-2" value={sort} onChange={(e) => onSort(e.target.value as SortKey)}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {data.cityWide && (
        <p className="mb-3 rounded-xl bg-surface-2 px-3 py-2 text-[12px] text-ink-2">
          교육청 자료에 구가 적혀 있지 않은 학원이 많아, 같은 시의 ‘구 미상’ 학원을 함께 보여 드려요. 주소로 구를 확인해 주세요.
        </p>
      )}

      {stats && filters.subject && (
        <div className="card mb-4 p-4">
          <p className="text-[13px] text-ink-2">
            {[data.sigungu, filters.age ? AGE_LABELS[filters.age] : '', SUBJECT_MAP[filters.subject]?.name].filter(Boolean).join(' ')} 신고 교습비 · 교습비 공개 {stats.n}곳
          </p>
          <p className="num mt-1 text-[22px] font-bold">
            중앙값 {manwon(stats.median)}
            <span className="ml-2 text-[13px] font-medium text-ink-3">
              보통 {manwon(stats.p25)} ~ {manwon(stats.p75)}
            </span>
          </p>
          {stats.n >= 5 && (
            <div className="mt-3">
              <Histogram values={prices} median={stats.median} format={manwon} tickFormat={shortMan} unitLabel="곳" />
            </div>
          )}
        </div>
      )}

      {hits.length === 0 ? (
        <EmptyState
          title="조건에 맞는 곳이 없어요"
          desc={filters.subject || filters.age || filters.text ? '과목·대상·검색어를 바꿔 보세요. 교습비를 공개하지 않은 곳은 ‘교습비 공개된 곳만’을 끄면 보여요.' : '이 지역에는 교육청에 등록된 학원·교습소가 없어요.'}
        />
      ) : (
        <>
          <ul className="grid gap-3 lg:grid-cols-2">
            {hits.slice(0, limit).map((h) => (
              <li key={h.academy.id}>
                <AcademyCard hit={h} region={region} mode={data.mode} />
              </li>
            ))}
          </ul>
          {hits.length > limit && (
            <button type="button" className="btn-ghost mt-4 w-full" onClick={showMore}>
              더 보기 ({(hits.length - limit).toLocaleString()}곳 남음)
            </button>
          )}
        </>
      )}
    </div>
  );
}

function Filters({ idPrefix, filters, update, showUnknown }: { idPrefix: string; filters: SearchFilters; update: (p: Record<string, string | null>) => void; showUnknown: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <span className="label">종류</span>
        <Segmented
          ariaLabel="학원 종류"
          value={filters.kind || 'all'}
          options={[
            { id: 'all', label: '전체' },
            { id: '학원', label: '학원' },
            { id: '교습소', label: '교습소' },
          ]}
          onChange={(v) => update({ kind: v === 'all' ? null : v })}
        />
      </div>
      <Toggle id={`${idPrefix}-priced`} checked={filters.pricedOnly} onChange={(v) => update({ priced: v ? '1' : null })} label="교습비 공개된 곳만" desc="교육청 자료에 비교할 수 있는 월 교습비가 있는 곳" />
      {showUnknown && (
        <Toggle id={`${idPrefix}-unk`} checked={filters.includeUnknown} onChange={(v) => update({ unk: v ? null : '0' })} label="구 미상 학원 포함" desc="주소에 구가 없어 어느 구인지 모르는 같은 시 학원" />
      )}
    </div>
  );
}

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const { settings } = useApp();
  const paramRegion = findDistrict(params.get('sido') ?? '', params.get('sigungu') ?? '');
  const region = paramRegion ? { sido: paramRegion.sido, sigungu: paramRegion.sigungu } : settings.home;
  const { sort, ...filters } = readFilters(params);
  const [text, setText] = useState(filters.text);
  const [sheet, setSheet] = useState(false);
  const [regionSheet, setRegionSheet] = useState(false);
  const [regionDraft, setRegionDraft] = useState({ sido: '', sigungu: '' });
  useEffect(() => setText(filters.text), [filters.text]);
  const district = useDistrictData(region?.sido ?? '', region?.sigungu ?? '');
  const subject = filters.subject ? SUBJECT_MAP[filters.subject] : undefined;

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    if (region && !paramRegion) {
      next.set('sido', region.sido);
      next.set('sigungu', region.sigungu);
    }
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };
  const memoFilters = useMemo(() => filters, [params.toString()]); // eslint-disable-line react-hooks/exhaustive-deps
  const showUnknown = (district.data?.unknownDistrict.length ?? 0) > 0;
  const activeFilters = Number(Boolean(filters.kind)) + Number(filters.pricedOnly) + Number(!filters.includeUnknown && showUnknown);
  const searchForm = (id: string, withLabel: boolean) => (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        (document.activeElement as HTMLElement | null)?.blur();
        update({ q: text.trim() || null });
      }}
    >
      <label htmlFor={id} className={withLabel ? 'label' : 'sr-only'}>
        학원 이름 · 동 · 과정
      </label>
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
        <input id={id} type="search" enterKeyHint="search" className="field pl-9" value={text} onChange={(e) => setText(e.target.value)} placeholder="학원 이름·동·과정 (예: 대치동, 입시미술)" />
      </div>
    </form>
  );

  return (
    <div>
      <PageHeader
        title="학원 찾기"
        subtitle={region ? [`${region.sido} ${region.sigungu}`, subject?.name, filters.age ? AGE_LABELS[filters.age] : ''].filter(Boolean).join(' · ') : '지역을 먼저 골라 주세요'}
      />

      {/* 휴대폰: 지역·필터·검색을 두 줄로 줄여 결과가 첫 화면에 보이게 */}
      <div className="mb-3 flex flex-col gap-2 lg:hidden">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setRegionDraft(region ?? { sido: '서울', sigungu: '강남구' });
              setRegionSheet(true);
            }}
            className="flex h-11 min-w-0 flex-1 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-left text-[15px] font-semibold"
            aria-haspopup="dialog"
          >
            <MapPin aria-hidden="true" className="h-4 w-4 shrink-0 text-accent" />
            <span className="truncate">{region ? `${region.sido} ${region.sigungu}` : '지역 고르기'}</span>
            <ChevronDown aria-hidden="true" className="ml-auto h-4 w-4 shrink-0 text-ink-3" />
          </button>
          <button
            type="button"
            onClick={() => setSheet(true)}
            className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface"
            aria-label={`필터${activeFilters ? ` ${activeFilters}개 켜짐` : ''}`}
            aria-haspopup="dialog"
          >
            <SlidersHorizontal aria-hidden="true" className="h-5 w-5" />
            {activeFilters > 0 && (
              <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-accent px-1 text-center text-[11px] font-bold leading-[18px] text-on-accent">{activeFilters}</span>
            )}
          </button>
        </div>
        {searchForm('search-q-mobile', false)}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-6">
        <aside className="card hidden flex-col gap-4 p-4 lg:sticky lg:top-20 lg:flex lg:w-72 lg:shrink-0">
          <RegionPicker idPrefix="search" sido={region?.sido ?? ''} sigungu={region?.sigungu ?? ''} allowAll={false} onChange={(sido, sigungu) => update({ sido, sigungu })} />
          {searchForm('search-q', true)}
          <Filters idPrefix="side" filters={filters} update={update} showUnknown={showUnknown} />
        </aside>

        <div className="min-w-0 flex-1">
          <SubjectPicker value={filters.subject} onChange={(subject) => update({ subject })} />
          <div className="mt-2">
            <Segmented
              ariaLabel="대상"
              value={filters.age || 'all'}
              options={[{ id: 'all', label: '전체 대상' }, ...AGE_ORDER.map((a) => ({ id: a, label: AGE_LABELS[a] }))]}
              onChange={(v) => update({ age: v === 'all' ? null : v })}
            />
          </div>

          <div className="mt-4">
            {!region ? (
              <EmptyState title="어느 지역 학원을 찾을까요?" desc="지역(휴대폰은 위쪽 ‘지역 고르기’)에서 시·도와 시·군·구를 골라 주세요." />
            ) : subject && !subject.inNeis ? (
              <SportsNotice subjectName={subject.name} />
            ) : (
              <DistrictGate state={district} onRetry={district.reload}>
                {(data) => (
                  <>
                    <div className="mb-3">
                      <DataStamp data={data} onReload={district.reload} error={district.error} />
                    </div>
                    <Results data={data} filters={memoFilters} sort={sort} onSort={(s) => update({ sort: s === 'price' ? null : s })} />
                  </>
                )}
              </DistrictGate>
            )}
          </div>
        </div>
      </div>

      <Sheet
        open={regionSheet}
        onClose={() => setRegionSheet(false)}
        title="지역 고르기"
        footer={
          <button
            type="button"
            className="btn-primary w-full"
            disabled={!regionDraft.sido || !regionDraft.sigungu}
            onClick={() => {
              update({ sido: regionDraft.sido, sigungu: regionDraft.sigungu });
              setRegionSheet(false);
            }}
          >
            {regionDraft.sigungu ? `${regionDraft.sigungu} 학원 보기` : '지역을 골라 주세요'}
          </button>
        }
      >
        <RegionPicker idPrefix="search-sheet" sido={regionDraft.sido} sigungu={regionDraft.sigungu} allowAll={false} onChange={(sido, sigungu) => setRegionDraft({ sido, sigungu })} />
      </Sheet>

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="필터"
        footer={
          <button type="button" className="btn-primary w-full" onClick={() => setSheet(false)}>
            결과 보기
          </button>
        }
      >
        <Filters idPrefix="sheet" filters={filters} update={update} showUnknown={showUnknown} />
      </Sheet>
    </div>
  );
}
