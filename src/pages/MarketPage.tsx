import { ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { HBarList } from '../charts/HBarList';
import { Histogram } from '../charts/Histogram';
import { MetricPicker } from '../components/MetricPicker';
import { RegionPicker } from '../components/RegionPicker';
import { ChipToggle, EmptyState, PageHeader, PriceLevelBadge, Section, Toggle } from '../components/ui';
import { AGE_LABELS, AGE_ORDER, CLASS_TYPE_LABELS, GROUPS, SUBJECT_MAP, subjectsOf } from '../data/categories';
import { SNAPSHOT_DATE, snapshotFor } from '../data/neisSnapshot';
import { districtsOf, SIDOS } from '../data/regions';
import { useAcademies } from '../hooks';
import { formatMetric, manwon, shortMan, signedPercent, unitPrice, withJosa } from '../lib/format';
import { marketPoints, sessionBucket, type MarketQuery, type PlanPoint } from '../lib/market';
import { METRIC_MAP, planUnits, priceLevel, type Metric } from '../lib/pricing';
import { percentileRank, summarize } from '../lib/stats';
import { useApp } from '../store/AppContext';
import type { AgeGroup, Billing, ClassType } from '../types';

function medianOf(points: PlanPoint[], metric: Metric) {
  return summarize(points.map((p) => p.cost[metric]));
}

function QuoteChecker({ points, subjectName }: { points: PlanPoint[]; subjectName: string }) {
  const [price, setPrice] = useState('');
  const [billing, setBilling] = useState<'monthly' | 'months' | 'sessions' | 'per_session'>('monthly');
  const [spw, setSpw] = useState('2');
  const [minutes, setMinutes] = useState('60');
  const [count, setCount] = useState('3');
  const priceNum = Number(price.replace(/[^\d]/g, ''));

  const result = useMemo(() => {
    if (!(priceNum >= 1000) || points.length < 3) return null;
    const b: Billing = billing === 'months' || billing === 'sessions' ? 'package' : billing;
    const units = planUnits({
      ...points[0].plan,
      billing: b,
      price: priceNum,
      sessionsPerWeek: Number(spw) || 1,
      minutesPerSession: Number(minutes) || 60,
      months: billing === 'months' ? Number(count) || 1 : undefined,
      totalSessions: billing === 'sessions' ? Number(count) || 1 : undefined,
    });
    const hourValues = points.map((p) => p.cost.pricePerHour).sort((a, b) => a - b);
    const monthValues = points.map((p) => p.cost.monthlyTuition).sort((a, b) => a - b);
    const pctHour = percentileRank(hourValues, units.pricePerHour);
    const pctMonth = percentileRank(monthValues, units.monthlyTuition);
    return {
      units,
      pctHour,
      pctMonth,
      level: priceLevel(pctHour),
      medianHour: summarize(hourValues)!.median,
    };
  }, [priceNum, billing, spw, minutes, count, points]);

  return (
    <div className="card p-4">
      <p className="text-[14px] text-ink-2">상담에서 안내받은 가격을 넣으면 위 조건의 시세와 비교해 드려요.</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="col-span-2">
          <label className="label" htmlFor="qc-price">
            안내받은 가격 (원)
          </label>
          <input id="qc-price" className="field num" inputMode="numeric" placeholder="예: 250000" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="label" htmlFor="qc-billing">
            결제 방식
          </label>
          <select id="qc-billing" className="field" value={billing} onChange={(e) => setBilling(e.target.value as typeof billing)}>
            <option value="monthly">월 수강료</option>
            <option value="months">기간권 (N개월)</option>
            <option value="sessions">횟수권 (N회)</option>
            <option value="per_session">회당 요금</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="qc-spw">
            주 횟수
          </label>
          <input id="qc-spw" className="field num" inputMode="numeric" value={spw} onChange={(e) => setSpw(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="qc-min">
            1회 시간(분)
          </label>
          <input id="qc-min" className="field num" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </div>
        {(billing === 'months' || billing === 'sessions') && (
          <div>
            <label className="label" htmlFor="qc-count">
              {billing === 'months' ? '개월 수' : '총 횟수'}
            </label>
            <input id="qc-count" className="field num" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />
          </div>
        )}
      </div>
      {result ? (
        <div className="mt-4 rounded-xl bg-surface-2 p-3" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2">
            <PriceLevelBadge level={result.level} compact />
            <span className="text-[14px] font-semibold">
              시간당 {unitPrice(result.units.pricePerHour)} · 월 환산 {manwon(result.units.monthlyTuition)}
            </span>
          </div>
          <p className="mt-2 text-[14px] text-ink-2">
            같은 조건 {subjectName} {points.length}개 요금제와 비교하면, 시간당 단가는 <b className="text-ink">저렴한 쪽 {Math.max(1, Math.round(result.pctHour))}%</b>
            (중앙값 {unitPrice(result.medianHour)}, {signedPercent(result.units.pricePerHour / result.medianHour - 1)}), 월 금액은 저렴한 쪽{' '}
            {Math.max(1, Math.round(result.pctMonth))}%예요.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-[12px] text-ink-3">가격을 입력하면 결과가 바로 나와요.</p>
      )}
    </div>
  );
}

export function MarketPage() {
  const academies = useAcademies();
  const { settings, updateSettings } = useApp();
  const metric = settings.metric;
  const [params, setParams] = useSearchParams();
  const subjectId = SUBJECT_MAP[params.get('subject') ?? ''] ? params.get('subject')! : 'math';
  const subject = SUBJECT_MAP[subjectId];
  const age = (params.get('age') as AgeGroup | null) ?? null;
  const classType = (params.get('ct') as ClassType | null) ?? null;
  const sido = params.has('sido') ? params.get('sido')! : (settings.home?.sido ?? '');
  const sigungu = params.has('gu') ? params.get('gu')! : '';
  const excludePublic = params.get('pub') === '0';

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    next.set('subject', subjectId);
    next.set('sido', sido);
    if (sigungu) next.set('gu', sigungu);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    if (patch.sido !== undefined && patch.sido !== null) next.set('sido', patch.sido);
    setParams(next, { replace: true });
  };

  const availableAges = AGE_ORDER.filter((a) => subject.templates.some((t) => t.ages.includes(a)));
  const availableClassTypes = (Object.keys(CLASS_TYPE_LABELS) as ClassType[]).filter((c) => subject.templates.some((t) => t.classType === c));

  const query: MarketQuery = {
    subjectId,
    ages: age ? [age] : undefined,
    classTypes: classType ? [classType] : undefined,
    sido: sido || undefined,
    sigungu: sigungu || undefined,
    excludePublic,
  };
  const queryKey = JSON.stringify(query);
  // query 객체는 렌더마다 새로 만들어지므로 직렬화한 값을 메모 기준으로 쓴다.
  const points = useMemo(() => marketPoints(academies, query), [academies, queryKey]);
  const stats = summarize(points.map((p) => p.cost[metric]));
  const fmt = (v: number) => formatMetric(metric, v);

  const byRegion = useMemo(() => {
    const parentQuery = { ...query, sigungu: undefined };
    const all = marketPoints(academies, parentQuery);
    const names = sido ? districtsOf(sido).map((d) => d.sigungu) : SIDOS;
    return names
      .map((name) => {
        const pts = all.filter((p) => (sido ? p.academy.region.sigungu === name : p.academy.region.sido === name));
        const st = medianOf(pts, metric);
        return st ? { name, median: st.median, n: st.n } : null;
      })
      .filter((x): x is { name: string; median: number; n: number } => x !== null && x.n >= 3)
      .sort((a, b) => a.median - b.median);
  }, [academies, queryKey, metric, sido]);

  const bySessions = useMemo(() => {
    const groups = new Map<number, PlanPoint[]>();
    for (const p of points) {
      const k = sessionBucket(p.plan.sessionsPerWeek);
      groups.set(k, [...(groups.get(k) ?? []), p]);
    }
    return Array.from(groups.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([k, pts]) => ({ k, n: pts.length, monthly: medianOf(pts, 'monthlyTuition')!.median, hour: medianOf(pts, 'pricePerHour')!.median }));
  }, [points]);

  const byClassType = useMemo(() => {
    const base = marketPoints(academies, { ...query, classTypes: undefined });
    return availableClassTypes
      .map((c) => {
        const pts = base.filter((p) => p.plan.classType === c);
        return pts.length ? { c, n: pts.length, monthly: medianOf(pts, 'monthlyTuition')!.median, hour: medianOf(pts, 'pricePerHour')!.median } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [academies, queryKey]);

  const extraStats = useMemo(() => {
    const academiesInMarket = Array.from(new Map(points.map((p) => [p.academy.id, p.academy])).values());
    const byName = new Map<string, number[]>();
    for (const a of academiesInMarket) for (const f of a.extraFees) byName.set(f.name, [...(byName.get(f.name) ?? []), f.amount]);
    return Array.from(byName.entries())
      .map(([name, amounts]) => ({
        name,
        share: amounts.length / Math.max(1, academiesInMarket.length),
        median: summarize(amounts)!.median,
        frequency: academiesInMarket.flatMap((a) => a.extraFees).find((f) => f.name === name)!.frequency,
      }))
      .sort((a, b) => b.share - a.share);
  }, [points]);

  const freqLabel = { once: '최초 1회', monthly: '매월', quarterly: '3개월마다', yearly: '매년', per_event: '행사·심사 때' } as const;
  const scopeLabel = sigungu || sido || '전국';
  // 교육청 자료는 시·군·구 단위로 불러오므로, 구를 안 골랐으면 같은 시·도의 내 동네를 기본으로 쓴다
  const neisSido = sido || settings.home?.sido || '서울';
  const neisGu = sigungu || (settings.home?.sido === neisSido ? settings.home.sigungu : (districtsOf(neisSido)[0]?.sigungu ?? ''));
  // 스냅샷 카드도 비교 링크와 같은 구 기준으로 보여준다
  const snapshot = neisGu ? snapshotFor(neisSido, neisGu, subjectId, age) : undefined;
  const neisLink = `/neis?sido=${encodeURIComponent(neisSido)}${neisGu ? `&gu=${encodeURIComponent(neisGu)}` : ''}&subject=${subjectId}${age ? `&age=${age}` : ''}`;
  const searchLink = `/search?subject=${subjectId}${age ? `&age=${age}` : ''}${classType ? `&ct=${classType}` : ''}${sido ? `&sido=${encodeURIComponent(sido)}` : ''}${sigungu ? `&gu=${encodeURIComponent(sigungu)}` : ''}`;

  return (
    <div>
      <PageHeader title="학원비 시세" subtitle="과목·연령·수업형태·지역별로 가격 분포를 확인하세요" />

      <section className="card p-4" aria-label="시세 조건">
        <label className="label" htmlFor="mk-subject">
          과목
        </label>
        <select id="mk-subject" className="field" value={subjectId} onChange={(e) => set({ subject: e.target.value, age: null, ct: null })}>
          {GROUPS.map((g) => (
            <optgroup key={g.id} label={g.name}>
              {subjectsOf(g.id).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <div className="mt-3">
          <span className="label">대상</span>
          <div className="flex flex-wrap gap-1.5">
            <ChipToggle pressed={age === null} onClick={() => set({ age: null })}>
              전체
            </ChipToggle>
            {availableAges.map((a) => (
              <ChipToggle key={a} pressed={age === a} onClick={() => set({ age: a })}>
                {AGE_LABELS[a]}
              </ChipToggle>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <span className="label">수업 형태</span>
          <div className="flex flex-wrap gap-1.5">
            <ChipToggle pressed={classType === null} onClick={() => set({ ct: null })}>
              전체
            </ChipToggle>
            {availableClassTypes.map((c) => (
              <ChipToggle key={c} pressed={classType === c} onClick={() => set({ ct: c })}>
                {CLASS_TYPE_LABELS[c]}
              </ChipToggle>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <RegionPicker idPrefix="mk" sido={sido} sigungu={sigungu} onChange={(s, g) => set({ sido: s, gu: g || null })} />
        </div>
        {subject.hasPublic && (
          <div className="mt-2">
            <Toggle id="mk-public" label="구립·공공시설 제외" desc="공공시설은 사설보다 크게 저렴해서 시세를 끌어내려요" checked={excludePublic} onChange={(v) => set({ pub: v ? '0' : null })} />
          </div>
        )}
        <div className="mt-3 border-t border-line pt-3">
          <MetricPicker value={metric} onChange={(m) => updateSettings({ metric: m })} />
        </div>
      </section>

      {!stats || stats.n < 3 ? (
        <div className="mt-4">
          <EmptyState title="표본이 부족해요" desc="지역을 넓히거나 연령·수업형태를 '전체'로 바꿔 보세요." />
        </div>
      ) : (
        <>
          <Section
            title={`${scopeLabel} ${subject.name}${age ? ` · ${AGE_LABELS[age]}` : ''}${classType ? ` · ${CLASS_TYPE_LABELS[classType]}` : ''}`}
            desc={`${stats.n}개 요금제 · ${METRIC_MAP[metric].label} 기준`}
          >
            <div className="card p-4">
              <div>
                <p className="text-[12px] font-semibold text-ink-3">중앙값</p>
                <p className="text-[34px] font-bold leading-none tracking-tight">{fmt(stats.median)}</p>
              </div>
              <dl className="num mt-4 grid grid-cols-3 gap-3 border-t border-line pt-3 text-[13px]">
                <div>
                  <dt className="text-ink-3">평균</dt>
                  <dd className="font-semibold">{fmt(stats.mean)}</dd>
                </div>
                <div>
                  <dt className="text-ink-3">중간 50%</dt>
                  <dd className="font-semibold">
                    <span className="whitespace-nowrap">{fmt(stats.p25)}</span> <span className="whitespace-nowrap">~ {fmt(stats.p75)}</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-3">최저 ~ 최고</dt>
                  <dd className="font-semibold">
                    <span className="whitespace-nowrap">{fmt(stats.min)}</span> <span className="whitespace-nowrap">~ {fmt(stats.max)}</span>
                  </dd>
                </div>
              </dl>
              <div className="mt-4">
                <Histogram values={points.map((p) => p.cost[metric])} median={stats.median} format={fmt} tickFormat={shortMan} unitLabel="개" />
              </div>
              <Link to={searchLink} className="btn-primary mt-4 w-full">
                이 조건으로 학원 찾기 <ChevronRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
          </Section>

          {snapshot && (
            <div className="card mt-3 p-4">
              <p className="text-[12px] font-semibold text-ink-3">
                교육청 신고 교습비 · {snapshot.sigungu} · {SNAPSHOT_DATE} 조회
              </p>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
                <span className="text-[22px] font-bold tracking-tight">{manwon(snapshot.median)}</span>
                <span className="num text-[13px] text-ink-2">
                  중간 50% {manwon(snapshot.p25)}~{manwon(snapshot.p75)} · {snapshot.n}개 과정
                </span>
              </div>
              <p className="mt-1 text-[12px] text-ink-3">교육청에 신고된 과정별 교습비(주로 교습소) 중앙값이에요. 위 시세는 예시 데이터예요.</p>
            </div>
          )}

          {subject.group !== 'sports' && (
            <Link
              to={neisLink}
              className="card mt-3 flex items-center gap-3 p-4 transition-shadow hover:shadow-md"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold">교육청 실제 교습비와 비교하기</span>
                <span className="block text-[13px] text-ink-2">{neisSido} {neisGu} {subject.name} 학원·교습소가 교육청에 신고한 교습비를 불러와 예시 시세와 나란히 봅니다.</span>
              </span>
              <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-ink-3" />
            </Link>
          )}

          <Section title="안내받은 가격, 적정한가요?" desc="시간당 단가로 환산해서 시세와 비교합니다">
            <QuoteChecker points={points} subjectName={subject.name} />
          </Section>

          {byRegion.length > 1 && (
            <Section title={sido ? `${sido} 구별 시세` : '시·도별 시세'} desc={`${METRIC_MAP[metric].label} 중앙값 · 저렴한 순 · 누르면 그 지역으로`}>
              <div className="card p-4">
                <HBarList
                  format={fmt}
                  items={byRegion.map((r) => ({
                    key: r.name,
                    label: r.name,
                    value: r.median,
                    sub: `${r.n}개`,
                    highlight: r.name === (sido ? sigungu : sido) || r.name === settings.home?.sigungu,
                    onClick: () => (sido ? set({ gu: r.name === sigungu ? null : r.name }) : set({ sido: r.name, gu: null })),
                  }))}
                />
                {byRegion.length >= 2 && (
                  <p className="mt-3 text-[13px] text-ink-2">
                    가장 저렴한 <b>{withJosa(byRegion[0].name, '과', '와')}</b> 가장 비싼 <b>{byRegion[byRegion.length - 1].name}</b>의 차이는{' '}
                    <b>{signedPercent(byRegion[byRegion.length - 1].median / byRegion[0].median - 1)}</b>예요.
                  </p>
                )}
              </div>
            </Section>
          )}

          <div className="grid gap-x-4 md:grid-cols-2">
            {bySessions.length > 1 && (
              <Section title="주당 횟수별" desc="횟수가 늘면 월 금액은 오르고 시간당 단가는 내려가는지 확인">
                <div className="card overflow-x-auto">
                  <table className="num w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-line text-left text-[12px] text-ink-3">
                        <th scope="col" className="p-3 font-semibold">
                          횟수
                        </th>
                        <th scope="col" className="p-3 text-right font-semibold">
                          월 수강료
                        </th>
                        <th scope="col" className="p-3 text-right font-semibold">
                          시간당
                        </th>
                        <th scope="col" className="p-3 text-right font-semibold">
                          표본
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {bySessions.map((r) => (
                        <tr key={r.k} className="border-b border-line last:border-0">
                          <th scope="row" className="p-3 text-left font-semibold">
                            {r.k >= 5 ? '주5회+' : `주${r.k}회`}
                          </th>
                          <td className="p-3 text-right">{manwon(r.monthly)}</td>
                          <td className="p-3 text-right">{unitPrice(r.hour)}</td>
                          <td className="p-3 text-right text-ink-3">{r.n}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}

            {byClassType.length > 1 && (
              <Section title="수업 형태별" desc="그룹·소수정예·1:1 가격 차이">
                <div className="card overflow-x-auto">
                  <table className="num w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-line text-left text-[12px] text-ink-3">
                        <th scope="col" className="p-3 font-semibold">
                          형태
                        </th>
                        <th scope="col" className="p-3 text-right font-semibold">
                          월 수강료
                        </th>
                        <th scope="col" className="p-3 text-right font-semibold">
                          시간당
                        </th>
                        <th scope="col" className="p-3 text-right font-semibold">
                          표본
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {byClassType.map((r) => (
                        <tr key={r.c} className="border-b border-line last:border-0">
                          <th scope="row" className="p-3 text-left font-semibold">
                            {CLASS_TYPE_LABELS[r.c]}
                          </th>
                          <td className="p-3 text-right">{manwon(r.monthly)}</td>
                          <td className="p-3 text-right">{unitPrice(r.hour)}</td>
                          <td className="p-3 text-right text-ink-3">{r.n}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}
          </div>

          {extraStats.length > 0 && (
            <Section title="자주 붙는 부대비용" desc="이 조건 학원들이 받는 추가 비용과 비율">
              <ul className="card divide-y divide-line">
                {extraStats.map((e) => (
                  <li key={e.name} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold">{e.name}</p>
                      <p className="text-[12px] text-ink-3">{freqLabel[e.frequency]}</p>
                    </div>
                    <div className="w-24 shrink-0">
                      <div className="h-1.5 rounded-full bg-surface-2">
                        <div className="h-1.5 rounded-full bg-accent" style={{ width: `${Math.round(e.share * 100)}%` }} />
                      </div>
                      <p className="num mt-1 text-right text-[11px] text-ink-3">{Math.round(e.share * 100)}% 학원</p>
                    </div>
                    <p className="num w-20 shrink-0 text-right text-[14px] font-bold">{manwon(e.median)}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[12px] text-ink-3">
                {extraStats[0] && `${withJosa(extraStats[0].name, '은', '는')} 이 조건 학원 ${Math.round(extraStats[0].share * 100)}%가 받아요. 상담 때 포함 여부를 꼭 물어보세요.`}
              </p>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
