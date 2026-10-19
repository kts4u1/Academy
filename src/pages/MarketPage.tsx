import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { HBarList } from '../charts/HBarList';
import { Histogram } from '../charts/Histogram';
import { RangeStrip } from '../charts/RangeStrip';
import { DataStamp, ErrorState, LoadingState, NoDataState, SportsNotice, SportsSourceNote } from '../components/DataState';
import { RegionPicker } from '../components/RegionPicker';
import { EmptyState, PageHeader, PriceLevelBadge, Section, Segmented, SubjectTile } from '../components/ui';
import { AGE_LABELS, AGE_ORDER, SUBJECT_MAP, SUBJECTS } from '../data/categories';
import { findDistrict, SIDOS } from '../data/regions';
import { useAvailability, useDistrictData, useMarket } from '../hooks';
import { manwon, shortMan, signedPercent } from '../lib/format';
import { academyPrices, findMarket, MIN_MARKET_N, positionOf, type MarketRow } from '../lib/realData';
import { marketScopeName } from '../lib/realSearch';
import { useApp } from '../store/AppContext';
import type { AgeGroup } from '../types';

const GROUP_LABEL: Record<string, string> = { academic: '교과', arts: '예술', sports: '체육 (스포츠강좌이용권 등록 금액)' };

function rangeStats(r: MarketRow) {
  return { n: r.n, min: r.min, max: r.max, mean: r.median, median: r.median, p25: r.p25, p75: r.p75 };
}

/** 안내받은 금액이 시세에서 어디쯤인지 */
function QuoteChecker({ row, label, priceWord }: { row: MarketRow; label: string; priceWord: string }) {
  const [value, setValue] = useState('');
  const price = Math.round(Number(value) * 10000);
  const pos = price > 0 ? positionOf(price, row) : null;
  return (
    <div className="card p-4">
      <label className="label" htmlFor="quote">
        상담에서 안내받은 월 금액 (만원)
      </label>
      <input id="quote" className="field num max-w-[12rem]" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="예: 35" />
      {pos && (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-[15px]">
            {label} {priceWord} 중앙값 {manwon(row.median)}보다 <b className={pos.diffFromMedian < 0 ? 'text-cheap' : pos.diffFromMedian > 0 ? 'text-pricey' : ''}>{signedPercent(pos.diffFromMedian)}</b>{' '}
            <PriceLevelBadge level={pos.level} compact />
            <span className="block text-[13px] text-ink-3">저렴한 쪽부터 {Math.round(pos.percentile)}% 위치</span>
          </p>
          <RangeStrip stats={rangeStats(row)} value={price} valueLabel="안내받은 금액" format={manwon} />
        </div>
      )}
    </div>
  );
}

export function MarketPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { settings } = useApp();
  const availability = useAvailability();
  const paramRegion = findDistrict(params.get('sido') ?? '', params.get('sigungu') ?? '');
  const region = paramRegion ? { sido: paramRegion.sido, sigungu: paramRegion.sigungu } : settings.home;
  const subjectId = SUBJECT_MAP[params.get('subject') ?? ''] ? params.get('subject')! : 'math';
  const sportsSelected = !SUBJECT_MAP[subjectId].inNeis;
  const priceWord = sportsSelected ? '바우처 등록 금액' : '신고 교습비';
  const ageParam = params.get('age') ?? '';
  const age: AgeGroup | null = (AGE_ORDER as string[]).includes(ageParam) ? (ageParam as AgeGroup) : null;
  const district = useDistrictData(region?.sido ?? '', region?.sigungu ?? '');
  const market = useMarket([district.data]);
  const mode = market.mode ?? 'static';

  const set = (patch: Record<string, string | null>) => {
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

  const local = region ? findMarket(market.rows, region.sido, region.sigungu, subjectId, age) : undefined;
  const wide = region ? findMarket(market.rows, region.sido, '', subjectId, age) : undefined;
  const main = local ?? wide;
  const subjectName = SUBJECT_MAP[subjectId]?.name ?? subjectId;
  const condition = `${age ? AGE_LABELS[age] + ' ' : ''}${subjectName}`;

  const rawPrices = useMemo(
    () => (district.data && local ? academyPrices(district.data.academies, subjectId, age) : []),
    [district.data, local, subjectId, age],
  );

  // 같은 시·도의 구별 중앙값, 전국 시·도별 중앙값 (정적 데이터에서만 의미가 있다)
  const byDistrict = region ? market.rows.filter((r) => r.sido === region.sido && r.sigungu !== '' && r.subjectId === subjectId && r.age === age).sort((a, b) => a.median - b.median) : [];
  const bySido = SIDOS.map((s) => findMarket(market.rows, s, '', subjectId, age)).filter((r): r is MarketRow => Boolean(r)).sort((a, b) => a.median - b.median);
  // 체육 시세(국민체육진흥공단 자료)가 있는 과목만 고를 수 있게 한다
  const withRows = useMemo(() => new Set(market.rows.map((r) => r.subjectId)), [market.rows]);
  const selectable = SUBJECTS.filter((s) => s.inNeis || withRows.has(s.id) || s.id === subjectId);
  // 과목별 비교는 같은 종류끼리 (교과·예술은 신고 교습비, 체육은 바우처 등록 금액이라 섞지 않는다)
  const sameKind = SUBJECTS.filter((s) => s.inNeis !== sportsSelected);
  const subjectsHere = region
    ? sameKind.map((s) => findMarket(market.rows, region.sido, region.sigungu, s.id, age) ?? findMarket(market.rows, region.sido, '', s.id, age)).filter((r): r is MarketRow => Boolean(r)).sort((a, b) => b.median - a.median)
    : [];

  return (
    <div>
      <PageHeader title="교습비 시세" subtitle="교육청 신고 교습비(체육은 스포츠강좌이용권 등록 금액)로 본 과목·연령별 시세" />

      <div className="card flex flex-col gap-3 p-4">
        <RegionPicker idPrefix="market" sido={region?.sido ?? ''} sigungu={region?.sigungu ?? ''} allowAll={false} onChange={(sido, sigungu) => set({ sido, sigungu })} />
        <div>
          <label className="label" htmlFor="market-subject">
            과목
          </label>
          <select id="market-subject" className="field" value={subjectId} onChange={(e) => set({ subject: e.target.value })}>
            {(['academic', 'arts', 'sports'] as const).map((g) => {
              const list = selectable.filter((s) => s.group === g);
              return list.length ? (
                <optgroup key={g} label={GROUP_LABEL[g]}>
                  {list.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              ) : null;
            })}
          </select>
        </div>
        <div>
          <span className="label">대상</span>
          <Segmented ariaLabel="대상" value={age ?? 'all'} options={[{ id: 'all', label: '전체' }, ...AGE_ORDER.map((a) => ({ id: a, label: AGE_LABELS[a] }))]} onChange={(v) => set({ age: v === 'all' ? null : v })} />
        </div>
      </div>

      <div className="mt-4">
        {availability.loading || (availability.mode === 'live' && district.status === 'loading') || market.loading ? (
          <LoadingState message={district.progress} />
        ) : availability.mode === 'error' ? (
          <ErrorState message={availability.error ?? '데이터를 불러오지 못했어요.'} onRetry={availability.retry} />
        ) : district.status === 'error' ? (
          <ErrorState message={district.error ?? '데이터를 불러오지 못했어요.'} onRetry={district.reload} />
        ) : market.error ? (
          <ErrorState message={market.error} onRetry={() => window.location.reload()} />
        ) : availability.mode === 'none' ? (
          <NoDataState />
        ) : !region ? (
          <EmptyState title="지역을 골라 주세요" desc="시·도와 시·군·구를 고르면 그 지역 교습비 시세를 보여 드려요." />
        ) : sportsSelected && !main && district.data && !district.data.sports ? (
          <SportsNotice subjectName={subjectName} />
        ) : !main ? (
          <EmptyState
            title={`${region.sigungu} ${condition} 시세를 낼 수 없어요`}
            desc={`${sportsSelected ? '바우처 한도 금액이 아닌 강좌 금액을' : '교습비를'} 공개한 곳이 ${MIN_MARKET_N}곳 미만이에요. ${age ? '대상을 ‘전체’로 바꾸거나 ' : ''}다른 과목이나 이웃 지역을 골라 보세요.`}
          />
        ) : (
          <>
            {sportsSelected && district.data?.sports && <SportsSourceNote voucherCap={district.data.sports.voucherCap} fetchedAt={district.data.sports.fetchedAt} />}
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <SubjectTile subjectId={subjectId} />
                <div>
                  <p className="text-[13px] text-ink-2">
                    {marketScopeName(main, mode)} {condition} 월 {sportsSelected ? '바우처 등록 금액' : '교습비'}
                  </p>
                  <p className="num text-[26px] font-bold leading-tight">중앙값 {manwon(main.median)}</p>
                </div>
              </div>
              <p className="num mt-2 text-sm text-ink-2">
                보통 {manwon(main.p25)} ~ {manwon(main.p75)} · 10~90% {manwon(main.p10)} ~ {manwon(main.p90)} · {main.academies.toLocaleString()}곳 ({main.n.toLocaleString()}개 과정)
              </p>
              {!local && <p className="mt-1 text-[12px] text-ink-3">{region.sigungu}에는 같은 조건으로 금액을 공개한 곳이 {MIN_MARKET_N}곳 미만이라 {marketScopeName(main, mode)} 기준으로 보여 드려요.</p>}
              <div className="mt-4">
                <RangeStrip stats={rangeStats(main)} format={manwon} />
              </div>
              {rawPrices.length >= 5 && (
                <div className="mt-4">
                  <Histogram values={rawPrices} median={main.median} format={manwon} tickFormat={shortMan} unitLabel="곳" />
                </div>
              )}
              {district.data && (
                <div className="mt-3">
                  <DataStamp data={district.data} onReload={district.reload} error={district.error} sports={sportsSelected} />
                </div>
              )}
            </div>

            <Section title="안내받은 금액, 적정한가요?" desc="상담에서 들은 금액을 넣으면 시세에서 어디쯤인지 알려 드려요">
              <QuoteChecker row={main} label={`${marketScopeName(main, mode)} ${condition}`} priceWord={priceWord} />
            </Section>

            {mode === 'static' && byDistrict.length > 1 && (
              <Section title={`${region.sido} 구별 ${condition} 시세`} desc={`${priceWord} 중앙값 · 저렴한 순 · 누르면 그 지역으로`}>
                <div className="card p-4">
                  <HBarList
                    format={manwon}
                    items={byDistrict.map((r) => ({
                      key: r.sigungu,
                      label: r.sigungu,
                      value: r.median,
                      sub: `${r.academies}곳`,
                      highlight: r.sigungu === region.sigungu,
                      onClick: () => set({ sido: r.sido, sigungu: r.sigungu }),
                    }))}
                  />
                </div>
              </Section>
            )}

            {mode === 'static' && bySido.length > 1 && (
              <Section title={`전국 시·도별 ${condition} 시세`} desc={`${priceWord} 중앙값 · 저렴한 순`}>
                <div className="card p-4">
                  <HBarList
                    format={manwon}
                    items={bySido.map((r) => ({ key: r.sido, label: r.sido, value: r.median, sub: `${r.academies.toLocaleString()}곳`, highlight: r.sido === region.sido }))}
                  />
                </div>
              </Section>
            )}

            {subjectsHere.length > 1 && (
              <Section title={`${region.sigungu} 과목별 시세`} desc={`${age ? AGE_LABELS[age] + ' · ' : ''}중앙값 높은 순 · 누르면 그 과목으로`}>
                <div className="card p-4">
                  <HBarList
                    format={manwon}
                    items={subjectsHere.map((r) => ({
                      key: r.subjectId,
                      label: SUBJECT_MAP[r.subjectId]?.name ?? r.subjectId,
                      value: r.median,
                      sub: r.sigungu ? `${r.academies}곳` : marketScopeName(r, mode),
                      highlight: r.subjectId === subjectId,
                      onClick: () => set({ subject: r.subjectId }),
                    }))}
                  />
                </div>
              </Section>
            )}

            <div className="mt-6">
              <button
                type="button"
                className="btn-primary"
                onClick={() => navigate(`/search?sido=${encodeURIComponent(region.sido)}&sigungu=${encodeURIComponent(region.sigungu)}&subject=${subjectId}${age ? `&age=${age}` : ''}&sort=value`)}
              >
                {region.sigungu} {condition} {sportsSelected ? "체육시설" : "학원"} 시세 대비 저렴한 순으로 보기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
