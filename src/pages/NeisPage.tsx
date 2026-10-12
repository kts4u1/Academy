import { ExternalLink, KeyRound, Search } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Histogram } from '../charts/Histogram';
import { RangeStrip } from '../charts/RangeStrip';
import { RegionPicker } from '../components/RegionPicker';
import { ChipToggle, EmptyState, PageHeader, Section, SubjectTile } from '../components/ui';
import { AGE_LABELS, SUBJECT_MAP } from '../data/categories';
import { districtsOf, EDU_OFFICES, filterNeisForDistrict, findDistrict, neisZoneNames, SIDOS } from '../data/regions';
import { useAcademies } from '../hooks';
import { manwon, shortMan, signedPercent, won } from '../lib/format';
import { fetchAllNeisAcademies, NEIS_REALMS, neisErrorMessage, type NeisAcademy } from '../lib/neis';
import { classifyRows, compareWithSample, coverage, isComparable, pricedByKind, sampleStats, type ClassifiedItem, type ComparisonRow } from '../lib/neisCompare';
import { summarize } from '../lib/stats';
import { useApp } from '../store/AppContext';
import type { AgeGroup } from '../types';

type SortMode = 'min_asc' | 'min_desc' | 'name';

interface LoadState {
  loading: boolean;
  progress: string;
  error: string;
  rows: NeisAcademy[];
  total: number;
  sampleMode: boolean;
  truncated: boolean;
  cityWide: boolean;
  unassigned: number;
  searchedFor: { sido: string; sigungu: string; realm: string } | null;
}

/** 같은 조건을 다시 조회하지 않도록 세션 동안 기억한다 (일일 호출 한도 보호) */
const cache = new Map<string, Omit<LoadState, 'loading' | 'progress' | 'error' | 'searchedFor'>>();

const MAX_ROWS_PER_ZONE = 6000;

function DiffPill({ diff }: { diff: number | null }) {
  if (diff === null) return <span className="text-ink-3">-</span>;
  const pct = Math.round(diff * 100);
  const tone = Math.abs(pct) <= 10 ? 'bg-surface-2 text-ink-2' : pct > 0 ? 'bg-pricey-soft text-pricey' : 'bg-cheap-soft text-cheap';
  return <span className={`num inline-block rounded-md px-1.5 py-0.5 text-[12px] font-bold ${tone}`}>{signedPercent(diff)}</span>;
}

export function NeisPage() {
  const academies = useAcademies();
  const { settings, updateSettings, showToast } = useApp();
  const [params] = useSearchParams();
  // 링크로 받은 지역이 잘못됐거나 구가 없으면 내 동네 → 그 시·도의 첫 구 순서로 채운다
  const paramSido = params.get('sido') ?? '';
  const initialSido = SIDOS.includes(paramSido) ? paramSido : (settings.home?.sido ?? '서울');
  const paramGu = params.get('gu') ?? '';
  const initialGu = findDistrict(initialSido, paramGu)
    ? paramGu
    : settings.home?.sido === initialSido
      ? settings.home.sigungu
      : (districtsOf(initialSido)[0]?.sigungu ?? '');
  const [sido, setSido] = useState(initialSido);
  const [sigungu, setSigungu] = useState(initialGu);
  const [realm, setRealm] = useState(params.get('realm') ?? '');
  const [name, setName] = useState('');
  const [keyDraft, setKeyDraft] = useState('');
  const [sort, setSort] = useState<SortMode>('min_asc');
  const [selected, setSelected] = useState<{ subjectId: string; age: AgeGroup | null } | null>(
    params.get('subject') ? { subjectId: params.get('subject')!, age: (params.get('age') as AgeGroup | null) ?? null } : null,
  );
  const [state, setState] = useState<LoadState>({
    loading: false,
    progress: '',
    error: '',
    rows: [],
    total: 0,
    sampleMode: false,
    truncated: false,
    cityWide: false,
    unassigned: 0,
    searchedFor: null,
  });

  const district = findDistrict(sido, sigungu);
  const office = EDU_OFFICES.find((o) => o.sido === sido) ?? EDU_OFFICES[0];

  const run = async () => {
    if (!district) return;
    const zones = neisZoneNames(district);
    const cacheKey = [settings.neisKey ? 'key' : 'nokey', office.code, district.sigungu, realm, name.trim()].join('|');
    const searchedFor = { sido, sigungu: district.sigungu, realm };
    const cached = cache.get(cacheKey);
    if (cached) {
      setState({ ...cached, loading: false, progress: '', error: '', searchedFor });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: '', progress: '교육청 서버에 연결하는 중…' }));
    try {
      const byId = new Map<string, NeisAcademy>();
      let total = 0;
      let sampleMode = false;
      let truncated = false;
      for (const zone of zones) {
        const r = await fetchAllNeisAcademies(
          { key: settings.neisKey, officeCode: office.code, sigungu: zone, realm: realm || undefined, name: name.trim() || undefined },
          {
            maxRows: MAX_ROWS_PER_ZONE,
            onProgress: (loaded, all) => setState((s) => ({ ...s, progress: `${zone} ${loaded.toLocaleString()} / ${all.toLocaleString()}곳 불러오는 중…` })),
          },
        );
        total += r.total;
        sampleMode = sampleMode || r.sampleMode;
        truncated = truncated || r.truncated;
        for (const row of r.rows) byId.set(row.id, row);
      }
      const filtered = filterNeisForDistrict(Array.from(byId.values()), district);
      const result = { rows: filtered.rows, total, sampleMode, truncated, cityWide: filtered.cityWide, unassigned: filtered.unassigned };
      cache.set(cacheKey, result);
      setState({ ...result, loading: false, progress: '', error: '', searchedFor });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, progress: '', error: neisErrorMessage(err), searchedFor }));
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void run();
  };

  const items = useMemo(() => classifyRows(state.rows), [state.rows]);
  const cov = useMemo(() => coverage(items), [items]);
  const kinds = useMemo(() => pricedByKind(state.rows), [state.rows]);
  const hakwonOnlyEmpty = kinds.some((k) => k.kind === '학원' && k.total > 0 && k.priced === 0);
  const scope = state.searchedFor ? { sido: state.searchedFor.sido, sigungu: state.searchedFor.sigungu } : { sido };
  const scopeKey = `${scope.sido}|${scope.sigungu ?? ''}`;
  // scope 객체는 렌더마다 새로 만들어지므로 문자열 키로 메모한다
  const comparison = useMemo(() => compareWithSample(items, academies, scope), [items, academies, scopeKey]);
  const subjectRows = comparison.filter((r) => r.age === null);

  // 샘플 5건으로는 과목 필터가 의미가 없어 적용하지 않는다
  const activeSelected = state.sampleMode ? null : selected;
  const selectedItems = useMemo(
    () =>
      activeSelected
        ? items.filter((i) => isComparable(i) && i.subjectId === activeSelected.subjectId && (!activeSelected.age || i.ages.includes(activeSelected.age)))
        : [],
    [items, activeSelected],
  );
  const selectedStats = summarize(selectedItems.map((i) => i.price));
  const selectedSample = activeSelected ? sampleStats(academies, activeSelected.subjectId, activeSelected.age, scope) : null;

  const listAcademies = useMemo(() => {
    const ids = activeSelected ? new Set(selectedItems.map((i) => i.academy.id)) : null;
    const list = state.rows.filter((r) => r.tuitions.length > 0 && (!ids || ids.has(r.id)));
    const relevant = (r: NeisAcademy) =>
      activeSelected ? selectedItems.filter((i) => i.academy.id === r.id).map((i) => i.price) : r.tuitions.map((t) => t.price);
    const minOf = (r: NeisAcademy) => Math.min(...relevant(r));
    return [...list].sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name, 'ko') : sort === 'min_asc' ? minOf(a) - minOf(b) : minOf(b) - minOf(a)));
  }, [state.rows, activeSelected, selectedItems, sort]);

  const itemsByAcademy = useMemo(() => {
    const map = new Map<string, ClassifiedItem[]>();
    for (const i of items) map.set(i.academy.id, [...(map.get(i.academy.id) ?? []), i]);
    return map;
  }, [items]);

  const rowLabel = (r: Pick<ComparisonRow, 'subjectId' | 'age'>) => `${SUBJECT_MAP[r.subjectId]?.name ?? r.subjectId}${r.age ? ` · ${AGE_LABELS[r.age]}` : ''}`;
  const isSelected = (r: Pick<ComparisonRow, 'subjectId' | 'age'>) => activeSelected?.subjectId === r.subjectId && (activeSelected?.age ?? null) === r.age;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="교육청 실데이터" subtitle="실제 신고 교습비를 불러와 예시 데이터와 비교해요" back />

      <div className="card p-4 text-[13px] text-ink-2">
        <p>
          나이스 교육정보 개방 포털의 <b className="text-ink">학원교습소정보</b>를 불러옵니다. 학원이 교육청에 신고한 과정별 1인 교습비예요. 체육시설(수영장·태권도장·복싱장
          등)은 이 자료에 없어요.
        </p>
        {__SINGLE_FILE__ && (
          <p className="mt-2 rounded-lg bg-pricey-soft px-3 py-2 font-semibold text-pricey">
            공유용 데모 링크에서는 외부 서버 연결이 막혀 있어 조회가 되지 않을 수 있어요. 저장소의 앱을 직접 실행하면 정상 동작합니다.
          </p>
        )}
        {!settings.neisKey ? (
          <form
            className="mt-3 rounded-lg bg-surface-2 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!keyDraft.trim()) return;
              updateSettings({ neisKey: keyDraft.trim() });
              setKeyDraft('');
              cache.clear();
              showToast('인증키를 저장했어요. 이제 전체 데이터를 불러올 수 있어요');
            }}
          >
            <label htmlFor="nx-key" className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
              <KeyRound aria-hidden="true" className="h-4 w-4 text-accent" />
              인증키를 넣으면 지역 전체를 불러와요 (없으면 샘플 5건)
            </label>
            <div className="mt-2 flex gap-2">
              <input id="nx-key" className="field font-mono text-[13px]" autoComplete="off" placeholder="발급받은 인증키" value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} />
              <button type="submit" className="btn-primary shrink-0">
                저장
              </button>
            </div>
            <p className="mt-1.5 text-[12px] text-ink-3">키는 이 기기(브라우저)에만 저장돼요.</p>
          </form>
        ) : (
          <p className="mt-2 text-[12px] text-ink-3">
            인증키 사용 중 ·{' '}
            <Link to="/settings" className="font-semibold text-accent">
              변경
            </Link>
          </p>
        )}
      </div>

      <form onSubmit={onSubmit} className="card mt-3 grid gap-3 p-4">
        <RegionPicker
          idPrefix="nx"
          allowAll={false}
          sido={sido}
          sigungu={sigungu}
          onChange={(s, g) => {
            setSido(s);
            setSigungu(g);
          }}
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="nx-realm">
              분야
            </label>
            <select id="nx-realm" className="field" value={realm} onChange={(e) => setRealm(e.target.value)}>
              <option value="">전체</option>
              {NEIS_REALMS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="nx-name">
              학원명 (선택)
            </label>
            <input id="nx-name" className="field" placeholder="예: 수학, 피아노" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>
        <button type="submit" className="btn-primary" disabled={state.loading || !district}>
          <Search aria-hidden="true" className="h-4 w-4" />
          {state.loading ? '불러오는 중…' : '실데이터 불러오기'}
        </button>
        {state.progress && (
          <p className="num text-[13px] text-ink-2" aria-live="polite">
            {state.progress}
          </p>
        )}
        <p className="text-[12px] text-ink-3">
          {office.office} · 교육청 자료의 행정구역 이름: {district ? neisZoneNames(district).join(', ') : '-'}
          {district && /시 \S+구$/.test(district.sigungu) && ' (시 단위 자료는 주소의 구·동 이름으로 거릅니다)'}
        </p>
      </form>

      {state.error && (
        <p role="alert" className="mt-3 rounded-lg bg-pricey-soft px-4 py-3 text-[14px] font-semibold text-pricey">
          {state.error}
        </p>
      )}

      {state.searchedFor && !state.error && !state.loading && (
        <>
          <Section
            title={`${state.searchedFor.sido} ${state.searchedFor.sigungu} 학원 ${state.rows.length.toLocaleString()}곳`}
            desc={
              state.sampleMode
                ? '인증키 없이 조회해서 샘플 5건만 받았어요. 비교하려면 인증키를 넣어 주세요.'
                : `교습비 과정 ${cov.total.toLocaleString()}개 중 비교에 쓴 과정 ${cov.comparable.toLocaleString()}개${state.truncated ? ` · 지역 학원이 많아 앞의 ${MAX_ROWS_PER_ZONE.toLocaleString()}곳만 받았어요` : ''}`
            }
          >
            {state.cityWide && (
              <p className="mb-3 rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-ink-2">
                교육청 자료 주소의 절반 이상에 구 이름이 없어 {state.searchedFor.sigungu.split(' ')[0]} 전체 기준으로 보여드려요.
              </p>
            )}
            {state.unassigned > 0 && (
              <p className="mb-3 rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-ink-2">
                주소만으로 어느 구인지 알 수 없는 {state.unassigned.toLocaleString()}곳은 뺐어요.
              </p>
            )}
            {kinds.length > 0 && (
              <ul className="num mb-2 flex flex-wrap gap-2 text-[12px]">
                {kinds.map((k) => (
                  <li key={k.kind} className="rounded-md bg-surface-2 px-2 py-1 text-ink-2">
                    {k.kind} {k.total.toLocaleString()}곳 · 교습비 공개 <b className="text-ink">{k.priced.toLocaleString()}</b>
                  </li>
                ))}
              </ul>
            )}
            {hakwonOnlyEmpty && (
              <p className="mb-3 rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-ink-2">
                교육청 자료에서 과정별 교습비는 교습소(1인 운영 소규모)만 채워져 있고 학원은 비어 있어요. 아래 실제 시세는 교습소 기준이라 규모가 큰 학원보다 낮게 나올 수 있어요.
              </p>
            )}
            {!state.sampleMode && cov.total > 0 && (
              <ul className="num mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-3">
                <li>과목 판별 못함 {cov.noSubject.toLocaleString()}</li>
                <li>특강·재료비·비정상 금액 제외 {cov.excluded.toLocaleString()}</li>
                <li>1:1 개인 과정 제외 {cov.privateLessons.toLocaleString()}</li>
                <li>대상 연령 확인 {cov.withAge.toLocaleString()}</li>
              </ul>
            )}
          </Section>

          {subjectRows.length > 0 && !state.sampleMode ? (
            <Section title="예시 데이터와 비교" desc="교육청 신고 교습비 중앙값 vs 예시 데이터 월 수강료 중앙값 (그룹·소수정예). 누르면 아래에 자세히 보여요.">
              <div className="overflow-x-auto rounded-card border border-line bg-surface">
                <table className="num w-full text-[13px]">
                  <caption className="sr-only">과목·연령별 실제 교습비와 예시 데이터 비교</caption>
                  <thead>
                    <tr className="border-b border-line text-left text-[12px] text-ink-3">
                      <th scope="col" className="p-3 font-semibold">
                        과목 · 대상
                      </th>
                      <th scope="col" className="p-3 text-right font-semibold">
                        교육청 실제
                      </th>
                      <th scope="col" className="p-3 text-right font-semibold">
                        예시 데이터 · 차이
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.map((r) => (
                      <tr
                        key={`${r.subjectId}-${r.age ?? 'all'}`}
                        className={`border-b border-line last:border-0 ${r.age ? '' : 'bg-surface-2/60'} ${isSelected(r) ? 'outline outline-2 -outline-offset-2 outline-accent' : ''}`}
                      >
                        <th scope="row" className="p-0 text-left font-normal">
                          <button
                            type="button"
                            className={`flex w-full items-center gap-2 p-3 text-left hover:text-accent ${r.age ? 'pl-8 text-ink-2' : 'font-semibold'}`}
                            onClick={() => setSelected(isSelected(r) ? null : { subjectId: r.subjectId, age: r.age })}
                            aria-pressed={isSelected(r)}
                          >
                            {!r.age && <SubjectTile subjectId={r.subjectId} size="sm" />}
                            {r.age ? AGE_LABELS[r.age] : rowLabel(r)}
                          </button>
                        </th>
                        <td className="p-3 text-right">
                          <b className="font-semibold">{manwon(r.real.median)}</b>
                          <span className="block text-[11px] text-ink-3">{r.real.n}개 과정</span>
                        </td>
                        <td className="p-3 text-right">
                          {r.sample ? (
                            <>
                              <span className="inline-flex items-center gap-1.5">
                                <b className="font-semibold">{manwon(r.sample.median)}</b>
                                <DiffPill diff={r.diff} />
                              </span>
                              <span className="block text-[11px] text-ink-3">{r.sample.n}개 · {r.sampleScope}</span>
                            </>
                          ) : (
                            <span className="text-ink-3">표본 부족</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[12px] text-ink-3">
                차이는 예시 데이터가 실제보다 몇 % 비싼지예요. ±10% 안이면 비슷, 빨강은 예시가 비싸게, 초록은 싸게 잡혀 있다는 뜻이에요. 교육청 교습비는 대부분 월 단위지만 과정마다 수업 시간이 달라요.
              </p>
            </Section>
          ) : (
            !state.sampleMode && (
              <div className="mt-6">
                <EmptyState title="비교할 만큼 교습비 자료가 없어요" desc="분야를 '전체'로 바꾸거나 다른 지역을 골라 보세요." />
              </div>
            )
          )}

          {activeSelected && (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <ChipToggle pressed onClick={() => setSelected(null)}>
                {rowLabel(activeSelected)}만 보는 중 · 해제 ✕
              </ChipToggle>
              {selectedItems.length === 0 && <span className="text-[13px] text-ink-3">이 지역에는 해당 과정이 없어요.</span>}
            </div>
          )}

          {activeSelected && selectedStats && (
            <Section title={`${rowLabel(activeSelected)} 실제 교습비 분포`} desc={`${selectedStats.n}개 과정 · 세로선은 중앙값과 예시 데이터 중앙값`}>
              <div className="card p-4">
                <RangeStrip stats={selectedStats} value={selectedSample?.stats?.median} valueLabel="예시 중앙값" format={manwon} />
                <div className="mt-4">
                  <Histogram
                    values={selectedItems.map((i) => i.price)}
                    median={selectedStats.median}
                    marker={selectedSample?.stats ? { value: selectedSample.stats.median, label: '예시' } : null}
                    format={manwon}
                    tickFormat={shortMan}
                    unitLabel="개 과정"
                  />
                </div>
              </div>
            </Section>
          )}

          {listAcademies.length > 0 && (
            <Section
              title={activeSelected ? `${rowLabel(activeSelected)} 과정이 있는 학원` : '교습비를 공개한 학원'}
              desc={`${listAcademies.length.toLocaleString()}곳`}
              action={
                <>
                  <label htmlFor="nx-sort" className="sr-only">
                    정렬
                  </label>
                  <select id="nx-sort" className="field w-auto py-1.5 text-[13px]" value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
                    <option value="min_asc">교습비 낮은순</option>
                    <option value="min_desc">교습비 높은순</option>
                    <option value="name">이름순</option>
                  </select>
                </>
              }
            >
              <ul className="flex flex-col gap-2">
                {listAcademies.slice(0, 60).map((r) => {
                  const its = itemsByAcademy.get(r.id) ?? [];
                  return (
                    <li key={r.id} className="card p-4">
                      <div className="min-w-0">
                        <h3 className="text-[15px] font-bold">{r.name}</h3>
                        <p className="text-[12px] text-ink-3">
                          {r.kind} · {r.realm}
                          {r.capacity ? ` · 정원 ${r.capacity}명` : ''}
                          {r.establishedAt && ` · ${r.establishedAt.slice(0, 4)}년 설립`}
                        </p>
                      </div>
                      <ul className="num mt-2 flex flex-wrap gap-1.5">
                        {its.slice(0, 14).map((t, i) => {
                          const highlight = activeSelected && isComparable(t) && t.subjectId === activeSelected.subjectId && (!activeSelected.age || t.ages.includes(activeSelected.age));
                          return (
                            <li
                              key={`${t.course}-${i}`}
                              title={t.excluded ?? (t.subjectId ? `${SUBJECT_MAP[t.subjectId]?.name ?? ''} ${t.ages.map((a) => AGE_LABELS[a]).join('·')}` : '과목 판별 못함')}
                              className={`rounded-md px-2 py-1 text-[12px] ${t.excluded ? 'bg-surface-2 text-ink-3 line-through' : highlight ? 'bg-accent-soft text-ink' : 'bg-surface-2'}`}
                            >
                              {t.course} <b className="font-semibold">{won(t.price)}</b>
                            </li>
                          );
                        })}
                        {its.length > 14 && <li className="px-1 py-1 text-[12px] text-ink-3">외 {its.length - 14}개</li>}
                      </ul>
                      <p className="mt-2 text-[12px] text-ink-3">{r.address}</p>
                    </li>
                  );
                })}
              </ul>
              {listAcademies.length > 60 && <p className="mt-2 text-[12px] text-ink-3">앞의 60곳만 보여요. 과목을 골라 범위를 좁혀 보세요.</p>}
            </Section>
          )}

          <p className="mt-4 text-[12px] text-ink-3">
            교습비는 교육청 신고 기준이며 실제 수강 전 학원에 게시된 교습비 표를 확인하세요. 줄 그은 항목은 특강·재료비처럼 월 교습비가 아니라고 보고 비교에서 뺀 것이에요.{' '}
            <a href="https://open.neis.go.kr" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-accent">
              나이스 교육정보 개방 포털 <ExternalLink aria-hidden="true" className="h-3 w-3" />
            </a>
          </p>
        </>
      )}
    </div>
  );
}
