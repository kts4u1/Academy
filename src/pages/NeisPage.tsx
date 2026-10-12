import { ChevronLeft, ChevronRight, ExternalLink, KeyRound, Search } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Histogram } from '../charts/Histogram';
import { EmptyState, PageHeader, Section } from '../components/ui';
import { districtsOf, EDU_OFFICES } from '../data/regions';
import { manwon, shortMan, won } from '../lib/format';
import { fetchNeisAcademies, NEIS_REALMS, neisErrorMessage, type NeisAcademy, type NeisQuery } from '../lib/neis';
import { summarize } from '../lib/stats';
import { useApp } from '../store/AppContext';

type SortMode = 'min_asc' | 'min_desc' | 'name';

export function NeisPage() {
  const { settings } = useApp();
  const [officeSido, setOfficeSido] = useState(settings.home?.sido && EDU_OFFICES.some((o) => o.sido === settings.home!.sido) ? settings.home.sido : '서울');
  const [sigungu, setSigungu] = useState(settings.home?.sigungu ?? '');
  const [realm, setRealm] = useState('입시.검정 및 보습');
  const [name, setName] = useState('');
  const [page, setPage] = useState(1);
  const [state, setState] = useState<{ loading: boolean; error: string; rows: NeisAcademy[]; total: number; sampleMode: boolean; searched: boolean }>({
    loading: false,
    error: '',
    rows: [],
    total: 0,
    sampleMode: false,
    searched: false,
  });
  const [sort, setSort] = useState<SortMode>('min_asc');
  const [onlyPriced, setOnlyPriced] = useState(true);

  const office = EDU_OFFICES.find((o) => o.sido === officeSido)!;
  const pageSize = 100;

  const run = async (nextPage = 1) => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    const q: NeisQuery = { key: settings.neisKey, officeCode: office.code, sigungu: sigungu.trim() || undefined, realm: realm || undefined, name: name.trim() || undefined, page: nextPage, pageSize };
    try {
      const r = await fetchNeisAcademies(q);
      setPage(nextPage);
      setState({ loading: false, error: '', rows: r.rows, total: r.total, sampleMode: r.sampleMode, searched: true });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: neisErrorMessage(err), searched: true }));
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void run(1);
  };

  const rows = useMemo(() => {
    const list = state.rows.filter((r) => !onlyPriced || r.tuitions.length > 0);
    const minOf = (r: NeisAcademy) => (r.tuitions.length ? Math.min(...r.tuitions.map((t) => t.price)) : Infinity);
    return [...list].sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name, 'ko') : sort === 'min_asc' ? minOf(a) - minOf(b) : minOf(b) - minOf(a)));
  }, [state.rows, sort, onlyPriced]);

  const allPrices = state.rows.flatMap((r) => r.tuitions.map((t) => t.price)).filter((p) => p >= 10000 && p <= 5000000);
  const stats = summarize(allPrices);
  const lastPage = Math.max(1, Math.ceil(state.total / pageSize));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="교육청 실데이터" subtitle="교육청에 등록된 학원·교습소의 과정별 교습비를 조회해요" back />

      <div className="card p-4 text-[13px] text-ink-2">
        <p>
          나이스 교육정보 개방 포털의 <b className="text-ink">학원교습소정보</b>를 바로 불러옵니다. 학원이 교육청에 신고한 1인당 교습비라서 실제 안내 가격의 기준이 돼요.
        </p>
        <p className="mt-1.5">수영장·태권도장·복싱장 같은 체육시설은 체육시설법 대상이라 이 자료에 없어요. 체육 종목은 학원 제공가·이용자 제보로 비교합니다.</p>
        {__SINGLE_FILE__ && (
          <p className="mt-2 rounded-lg bg-pricey-soft px-3 py-2 font-semibold text-pricey">
            공유용 데모 링크에서는 외부 서버 연결이 막혀 있어 조회가 되지 않을 수 있어요. 저장소의 앱을 직접 실행하면 정상 동작합니다.
          </p>
        )}
        {!settings.neisKey && (
          <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-surface-2 px-3 py-2">
            <KeyRound aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <span>
              인증키가 없어서 샘플 5건만 나와요.{' '}
              <Link to="/settings" className="font-semibold text-accent">
                설정에서 인증키 넣기
              </Link>
            </span>
          </p>
        )}
      </div>

      <form onSubmit={onSubmit} className="card mt-3 grid gap-3 p-4">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="nx-office">
              교육청
            </label>
            <select id="nx-office" className="field" value={officeSido} onChange={(e) => { setOfficeSido(e.target.value); setSigungu(''); }}>
              {EDU_OFFICES.map((o) => (
                <option key={o.code} value={o.sido}>
                  {o.office}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="nx-gu">
              행정구역 (선택)
            </label>
            <input id="nx-gu" className="field" list="nx-gu-list" placeholder="예: 마포구" value={sigungu} onChange={(e) => setSigungu(e.target.value)} />
            <datalist id="nx-gu-list">
              {districtsOf(officeSido).map((d) => (
                <option key={d.sigungu} value={d.sigungu.split(' ')[0]} />
              ))}
            </datalist>
          </div>
        </div>
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
        <button type="submit" className="btn-primary" disabled={state.loading}>
          <Search aria-hidden="true" className="h-4 w-4" />
          {state.loading ? '불러오는 중…' : '교습비 조회'}
        </button>
        <p className="text-[12px] text-ink-3">
          학원명은 일부만 적어도 찾아요. 경기도처럼 시 아래 구가 있는 곳은 시 이름(예: 성남시)으로 적으세요.
        </p>
      </form>

      {state.error && (
        <p role="alert" className="mt-3 rounded-lg bg-pricey-soft px-4 py-3 text-[14px] font-semibold text-pricey">
          {state.error}
        </p>
      )}

      {state.searched && !state.error && (
        <>
          <Section
            title={`조회 결과 ${state.total.toLocaleString()}곳`}
            desc={state.sampleMode ? '인증키 없이 조회해서 샘플 5건만 보여요' : `${page} / ${lastPage} 페이지 · 페이지당 ${pageSize}곳`}
          >
            {stats && stats.n >= 3 && (
              <div className="card mb-3 p-4">
                <p className="text-[13px] text-ink-2">
                  이 페이지 교습비 {stats.n}개 과정 · 중앙값 <b className="text-ink">{manwon(stats.median)}</b> · 중간 50% {manwon(stats.p25)}~{manwon(stats.p75)}
                </p>
                <div className="mt-2">
                  <Histogram values={allPrices} median={stats.median} format={manwon} tickFormat={shortMan} unitLabel="개 과정" />
                </div>
              </div>
            )}
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-[13px] text-ink-2">
                <input type="checkbox" checked={onlyPriced} onChange={(e) => setOnlyPriced(e.target.checked)} className="accent-[rgb(var(--accent))]" />
                교습비 공개된 곳만
              </label>
              <label htmlFor="nx-sort" className="sr-only">
                정렬
              </label>
              <select id="nx-sort" className="field ml-auto w-auto py-1.5 text-[13px]" value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
                <option value="min_asc">최저 교습비 낮은순</option>
                <option value="min_desc">최저 교습비 높은순</option>
                <option value="name">이름순</option>
              </select>
            </div>
            {rows.length === 0 ? (
              <EmptyState title="표시할 학원이 없어요" desc={onlyPriced ? "'교습비 공개된 곳만'을 끄거나 조건을 바꿔 보세요." : '조건을 바꿔 보세요.'} />
            ) : (
              <ul className="flex flex-col gap-2">
                {rows.map((r) => {
                  const prices = r.tuitions.map((t) => t.price);
                  const st = summarize(prices);
                  return (
                    <li key={r.id} className="card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-[15px] font-bold">{r.name}</h3>
                          <p className="text-[12px] text-ink-3">
                            {r.kind} · {r.sigungu} · {r.realm}
                            {r.course && ` · ${r.course}`}
                          </p>
                        </div>
                        {st && (
                          <div className="num shrink-0 text-right">
                            <p className="text-[15px] font-bold">{st.n > 1 ? `${manwon(st.min)}~${manwon(st.max)}` : manwon(st.min)}</p>
                            <p className="text-[11px] text-ink-3">{st.n}개 과정</p>
                          </div>
                        )}
                      </div>
                      {r.tuitions.length > 0 ? (
                        <ul className="num mt-2 flex flex-wrap gap-1.5">
                          {r.tuitions.slice(0, 12).map((t, i) => (
                            <li key={`${t.course}-${i}`} className="rounded-md bg-surface-2 px-2 py-1 text-[12px]">
                              {t.course} <b className="font-semibold">{won(t.price)}</b>
                            </li>
                          ))}
                          {r.tuitions.length > 12 && <li className="px-1 py-1 text-[12px] text-ink-3">외 {r.tuitions.length - 12}개</li>}
                        </ul>
                      ) : (
                        <p className="mt-2 text-[12px] text-ink-3">교습비 정보가 등록되지 않았어요.</p>
                      )}
                      <p className="mt-2 text-[12px] text-ink-3">
                        {r.address}
                        {r.capacity ? ` · 정원 ${r.capacity}명` : ''}
                        {r.establishedAt && ` · ${r.establishedAt.slice(0, 4)}년 설립`}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
            {!state.sampleMode && lastPage > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <button type="button" className="btn-ghost" disabled={page <= 1 || state.loading} onClick={() => run(page - 1)}>
                  <ChevronLeft aria-hidden="true" className="h-4 w-4" /> 이전
                </button>
                <span className="num text-[13px] text-ink-2">
                  {page} / {lastPage}
                </span>
                <button type="button" className="btn-ghost" disabled={page >= lastPage || state.loading} onClick={() => run(page + 1)}>
                  다음 <ChevronRight aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            )}
          </Section>
          <p className="mt-4 text-[12px] text-ink-3">
            교습비는 교육청 신고 기준이며 교습 기간·시간은 과정마다 달라요. 실제 수강 전 학원에 게시된 교습비 표를 확인하세요.{' '}
            <a href="https://open.neis.go.kr" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-accent">
              나이스 교육정보 개방 포털 <ExternalLink aria-hidden="true" className="h-3 w-3" />
            </a>
          </p>
        </>
      )}
    </div>
  );
}
