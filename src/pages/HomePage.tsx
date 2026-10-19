import { ChevronRight, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ErrorState, LoadingState, NoDataState } from '../components/DataState';
import { InstallBanner } from '../components/InstallPrompt';
import { RegionPicker } from '../components/RegionPicker';
import { Section, SubjectTile } from '../components/ui';
import { GROUPS, SUBJECT_MAP, subjectsOf } from '../data/categories';
import { useAvailability, useDistrictData, useManifest, useMarket } from '../hooks';
import { manwon, withJosa } from '../lib/format';
import { marketScopeName, parseQuery } from '../lib/realSearch';
import { useApp } from '../store/AppContext';

const EXAMPLES = ['목동 영어', '분당 수학', '광산구 피아노', '해운대 미술', '대치동 국어', '세종 논술'];

export function searchPath(p: { sido?: string; sigungu?: string; subject?: string; q?: string; age?: string }): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v) params.set(k, v);
  const qs = params.toString();
  return qs ? `/search?${qs}` : '/search';
}

function HomeMarket({ sido, sigungu }: { sido: string; sigungu: string }) {
  const { loading, mode, manifest, error, retry } = useAvailability();
  // 정적 데이터면 전국 시세 파일만 있으면 되고, 브라우저에서 받는 경우에만 지역 데이터를 받는다
  const district = useDistrictData(mode === 'live' ? sido : '', mode === 'live' ? sigungu : '');
  const market = useMarket([district.data]);
  const entry = manifest?.districts.find((d) => d.sido === sido && d.sigungu === sigungu);

  const tiles = useMemo(() => {
    // 교습비 시세만 (체육은 바우처 등록 금액이라 과목 화면에서 따로 본다)
    const neis = market.rows.filter((r) => SUBJECT_MAP[r.subjectId]?.inNeis);
    const local = neis.filter((r) => r.sido === sido && r.sigungu === sigungu && r.age === null);
    const wide = neis.filter((r) => r.sido === sido && r.sigungu === '' && r.age === null);
    const rows = local.length >= 3 ? local : wide;
    return rows.sort((a, b) => b.academies - a.academies || b.n - a.n).slice(0, 8);
  }, [market.rows, sido, sigungu]);

  if (loading) return <LoadingState />;
  if (mode === 'error') return <ErrorState message={error ?? '데이터를 불러오지 못했어요.'} onRetry={retry} />;
  if (mode === 'none') return <NoDataState compact />;
  if (mode === 'live' && district.status === 'loading') return <LoadingState message={district.progress} />;
  if (mode === 'live' && district.status === 'error') return <ErrorState message={district.error ?? '데이터를 불러오지 못했어요.'} onRetry={district.reload} />;
  if (market.error) return <ErrorState message={market.error} onRetry={() => window.location.reload()} />;
  if (market.loading) return <LoadingState />;

  return (
    <div>
      {entry && (
        <p className="mb-3 text-sm text-ink-2">
          {sigungu}에 교육청에 등록된 학원·교습소 <b className="text-ink">{entry.academies.toLocaleString()}곳</b> · 교습비 공개{' '}
          <b className="text-ink">{entry.priced.toLocaleString()}곳</b>
          {entry.sports ? (
            <>
              {' '}
              · 체육시설 <b className="text-ink">{entry.sports.toLocaleString()}곳</b>
            </>
          ) : null}
        </p>
      )}
      {tiles.length === 0 ? (
        <p className="card p-4 text-sm text-ink-2">이 지역은 비교할 만큼 공개된 교습비가 아직 없어요 (과목별로 교습비를 공개한 곳이 3곳 이상일 때 시세를 보여 드려요).</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tiles.map((r) => (
            <li key={`${r.subjectId}|${r.sigungu}`}>
              <Link to={`/market?sido=${encodeURIComponent(sido)}&sigungu=${encodeURIComponent(sigungu)}&subject=${r.subjectId}`} className="card flex h-full flex-col gap-1 p-3 hover:shadow-md">
                <span className="flex items-center gap-2">
                  <SubjectTile subjectId={r.subjectId} size="sm" />
                  <span className="text-[14px] font-semibold">{SUBJECT_MAP[r.subjectId]?.name ?? r.subjectId}</span>
                </span>
                <span className="num mt-1 text-[18px] font-bold">{manwon(r.median)}</span>
                <span className="num text-[11px] text-ink-3">
                  보통 {manwon(r.p25)}~{manwon(r.p75)} · {r.academies}곳
                </span>
                <span className="text-[11px] text-ink-3">{marketScopeName(r, market.mode ?? 'static')} 월 교습비 중앙값</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function HomePage() {
  const { manifest } = useManifest();
  const hasSports = Boolean(manifest?.sports);
  const navigate = useNavigate();
  const { settings, updateSettings } = useApp();
  const home = settings.home;
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState({ sido: '서울', sigungu: '강남구' });

  const go = (text: string) => {
    const parsed = parseQuery(text, home);
    navigate(searchPath({ sido: parsed.sido ?? home?.sido, sigungu: parsed.sigungu ?? home?.sigungu, subject: parsed.subject, age: parsed.age, q: parsed.text }));
  };

  return (
    <div>
      <div className="pt-2">
        <InstallBanner />
      </div>
      <section className="pb-2 pt-4 md:pt-8">
        <p className="eyebrow">공공데이터 · 전국 256개 시·군·구</p>
        <h1 className={`mt-2 font-bold leading-[1.2] tracking-tight md:text-[36px] ${home ? 'text-[23px]' : 'text-[28px]'}`}>
          우리 동네 학원비,
          <br className="hidden sm:block" /> 공식 자료로 비교하세요
        </h1>
        {/* 내 동네를 정한 뒤에는 휴대폰에서 설명을 줄여 우리 동네 시세가 첫 화면에 보이게 */}
        <p className={`mt-3 max-w-xl text-[15px] text-ink-2 ${home ? 'hidden md:block' : ''}`}>
          교육청에 신고된 학원·교습소 교습비와 국민체육진흥공단의 체육시설 강좌 금액을 매주 받아서 같은 과목·같은 연령끼리 비교해 드려요. 예시 데이터 없이 실제 자료만
          보여 줍니다.
        </p>
      </section>

      <Section
        title={home ? `${home.sigungu} 교습비 시세` : '우리 동네 교습비 시세'}
        desc="교육청에 신고된 월 교습비 · 교습비를 공개한 곳이 많은 과목 순"
        action={
          home && (
            <Link to={`/market?sido=${encodeURIComponent(home.sido)}&sigungu=${encodeURIComponent(home.sigungu)}`} className="inline-flex shrink-0 items-center whitespace-nowrap py-2 text-[13px] font-semibold text-accent">
              시세 더 보기 <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          )
        }
      >
        {home ? (
          <HomeMarket sido={home.sido} sigungu={home.sigungu} />
        ) : (
          <div className="card p-4">
            <p className="mb-3 text-sm text-ink-2">내 동네를 고르면 그 지역 학원과 과목별 교습비 시세를 바로 보여 드려요.</p>
            <RegionPicker idPrefix="home-pick" sido={draft.sido} sigungu={draft.sigungu} allowAll={false} onChange={(sido, sigungu) => setDraft({ sido, sigungu })} />
            <button type="button" className="btn-primary mt-3 w-full sm:w-auto" onClick={() => updateSettings({ home: draft })}>
              {withJosa(draft.sigungu, '으로', '로')} 설정
            </button>
          </div>
        )}
      </Section>

      {/* 동네를 먼저 정하고, 그다음 직접 검색 */}
      <Section title="직접 검색" desc="동네와 과목을 함께 적어 보세요">
        <form
          className="flex max-w-xl gap-2"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            go(q);
          }}
        >
          <label htmlFor="home-search" className="sr-only">
            학원 검색
          </label>
          <div className="relative flex-1">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-3" />
            <input id="home-search" type="search" enterKeyHint="search" value={q} onChange={(e) => setQ(e.target.value)} className="field h-12 pl-10" placeholder="동네 + 과목 (예: 목동 영어)" />
          </div>
          <button type="submit" className="btn-primary h-12 px-5">
            검색
          </button>
        </form>
        <div className="scroll-x mt-3">
          {EXAMPLES.map((p) => (
            <button key={p} type="button" className="chip" onClick={() => go(p)}>
              {p}
            </button>
          ))}
        </div>
      </Section>

      {/* 교육청 자료인 교과·예술을 먼저, 국민체육진흥공단 자료인 체육은 뒤에 */}
      {[...GROUPS].sort((a, b) => Number(a.id === 'sports') - Number(b.id === 'sports')).map((g) => {
        const sports = g.id === 'sports';
        return (
          <Section
            key={g.id}
            title={g.name}
            desc={sports ? '수영 · 태권도 · 복싱 · 주짓수 · 구기' : g.desc}
            action={
              sports ? (
                <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-3">{hasSports ? '바우처 등록 금액' : '자료 준비 중'}</span>
              ) : undefined
            }
          >
            <ul className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-6 lg:grid-cols-9">
              {subjectsOf(g.id).map((s) => (
                <li key={s.id}>
                  <Link
                    to={searchPath({ sido: home?.sido, sigungu: home?.sigungu, subject: s.id })}
                    className="group flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2 transition-colors hover:bg-surface active:bg-surface-2"
                  >
                    <span className="transition-transform duration-150 group-hover:-translate-y-0.5 group-active:scale-95">
                      <SubjectTile subjectId={s.id} size="lg" />
                    </span>
                    <span className="text-center text-[12px] font-medium leading-tight text-ink-2">{s.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        );
      })}

      <Section title="데이터는 이렇게 만들어요">
        <ul className="card flex flex-col gap-2 p-4 text-sm text-ink-2">
          <li>· 나이스 교육정보 개방 포털의 <b className="text-ink">학원교습소정보</b>를 매주 월요일 새벽 전국 17개 교육청에서 모두 받아요.</li>
          <li>· 과정 이름으로 과목·대상 연령을 나누고, 특강·교재비·1:1 레슨은 시세 비교에서 빼요.</li>
          <li>· 교습비는 교육청에 신고된 금액이라 실제 받는 금액(할인·교재비 등)과 다를 수 있어요.</li>
          <li>
            · 수영·태권도 같은 체육시설은 교육청 관할이 아니라, 국민체육진흥공단의 스포츠강좌이용권 강좌 금액과 전국체육시설 목록으로 보여 드려요.{' '}
            <Link to="/data" className="font-semibold text-accent hover:underline">
              자세히
            </Link>
          </li>
        </ul>
      </Section>
    </div>
  );
}
