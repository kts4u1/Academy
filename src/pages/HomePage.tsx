import { ChevronRight, Database, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AcademyCard } from '../components/AcademyCard';
import { Section, SubjectTile } from '../components/ui';
import { AGE_LABELS, CLASS_TYPE_LABELS, GROUPS, SUBJECT_MAP, subjectsOf } from '../data/categories';
import { useAcademies, useOrigin } from '../hooks';
import { manwon, unitPrice } from '../lib/format';
import { marketPoints } from '../lib/market';
import { EMPTY_FILTERS, searchAcademies } from '../lib/search';
import { summarize } from '../lib/stats';
import { useApp } from '../store/AppContext';
import type { AgeGroup, ClassType } from '../types';

const QUICK_MARKETS: { subjectId: string; age: AgeGroup; classType: ClassType }[] = [
  { subjectId: 'math', age: 'elementary', classType: 'group' },
  { subjectId: 'english', age: 'elementary', classType: 'group' },
  { subjectId: 'math', age: 'high', classType: 'group' },
  { subjectId: 'swim', age: 'elementary', classType: 'group' },
  { subjectId: 'taekwondo', age: 'elementary', classType: 'group' },
  { subjectId: 'piano', age: 'elementary', classType: 'small' },
  { subjectId: 'boxing', age: 'adult', classType: 'group' },
  { subjectId: 'jiujitsu', age: 'adult', classType: 'group' },
];

const POPULAR = ['대치동 수학', '키즈 수영', '주짓수', '복싱 3개월', '초등 영어', '태권도 차량'];

export function HomePage() {
  const navigate = useNavigate();
  const academies = useAcademies();
  const origin = useOrigin();
  const { settings } = useApp();
  const home = settings.home;
  const [q, setQ] = useState('');

  const markets = useMemo(
    () =>
      QUICK_MARKETS.map((m) => {
        const base = { subjectId: m.subjectId, ages: [m.age], classTypes: [m.classType], excludePublic: true };
        let scope = home ? `${home.sigungu}` : '전국';
        let pts = home ? marketPoints(academies, { ...base, sido: home.sido, sigungu: home.sigungu }) : [];
        if (pts.length < 4 && home) {
          pts = marketPoints(academies, { ...base, sido: home.sido });
          scope = home.sido;
        }
        if (pts.length < 4) {
          pts = marketPoints(academies, base);
          scope = '전국';
        }
        return {
          ...m,
          scope,
          monthly: summarize(pts.map((p) => p.cost.monthlyTuition)),
          perHour: summarize(pts.map((p) => p.cost.pricePerHour)),
        };
      }),
    [academies, home],
  );

  const valuePicks = useMemo(() => {
    const filters = { ...EMPTY_FILTERS, sido: home?.sido ?? '', sigungu: home?.sigungu ?? '', minRating: 4.3 };
    return searchAcademies(academies, filters, 'value', settings.metric, { origin }).slice(0, 4);
  }, [academies, home, settings.metric, origin]);

  return (
    <div>
      <section className="pb-2 pt-4 md:pt-8">
        <p className="eyebrow">교과 · 체육 · 예술 34개 과목</p>
        <h1 className="mt-2 text-[28px] font-bold leading-[1.2] tracking-tight md:text-[36px]">
          학원비, 월 금액만 보면
          <br className="hidden sm:block" /> 손해 봅니다
        </h1>
        <p className="mt-3 max-w-xl text-[15px] text-ink-2">
          수업 시간이 다르면 시간당 단가로, 교재·도복·심사비가 붙으면 실질 월 부담으로. 같은 기준으로 바꿔서 우리 동네 시세와 비교해 드려요.
        </p>
        <form
          className="mt-5 flex max-w-xl gap-2"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(`/search?q=${encodeURIComponent(q.trim())}`);
          }}
        >
          <label htmlFor="home-search" className="sr-only">
            학원 검색
          </label>
          <div className="relative flex-1">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-3" />
            <input
              id="home-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="field h-12 pl-10 text-[15px]"
              placeholder="과목, 동네, 학원 이름 (예: 목동 영어)"
            />
          </div>
          <button type="submit" className="btn-primary h-12 px-5">
            검색
          </button>
        </form>
        <div className="scroll-x mt-3">
          {POPULAR.map((p) => (
            <Link key={p} to={`/search?q=${encodeURIComponent(p)}`} className="chip">
              {p}
            </Link>
          ))}
        </div>
      </section>

      {GROUPS.map((g) => (
        <Section key={g.id} title={g.name} desc={g.desc}>
          <ul className="grid grid-cols-5 gap-x-1 gap-y-2 sm:grid-cols-6 lg:grid-cols-9">
            {subjectsOf(g.id).map((s) => (
              <li key={s.id}>
                <Link to={`/search?subject=${s.id}`} className="flex flex-col items-center gap-1 rounded-xl py-1.5 hover:bg-surface">
                  <SubjectTile subjectId={s.id} size="md" />
                  <span className="text-center text-[12px] font-medium leading-tight text-ink-2">{s.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ))}

      <Section
        title={`${home ? home.sigungu : '전국'} 학원비 시세`}
        desc="같은 연령·수업형태끼리 비교한 월 수강료 중앙값"
        action={
          <Link to="/market" className="inline-flex shrink-0 items-center text-[13px] font-semibold text-accent">
            시세 더보기 <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        }
      >
        <ul className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {markets.map((m) => (
            <li key={`${m.subjectId}-${m.age}-${m.classType}`}>
              <Link
                to={`/market?subject=${m.subjectId}&age=${m.age}&ct=${m.classType}`}
                className="card flex h-full flex-col gap-1 p-3 transition-shadow hover:shadow-md"
              >
                <span className="flex items-center gap-2">
                  <SubjectTile subjectId={m.subjectId} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-bold">{SUBJECT_MAP[m.subjectId].name}</span>
                    <span className="block text-[11px] text-ink-3">
                      {AGE_LABELS[m.age]} · {CLASS_TYPE_LABELS[m.classType]}
                    </span>
                  </span>
                </span>
                {m.monthly ? (
                  <>
                    <span className="mt-1 text-[20px] font-bold tracking-tight">{manwon(m.monthly.median)}</span>
                    <span className="num text-[11px] text-ink-3">
                      {manwon(m.monthly.min)} ~ {manwon(m.monthly.max)}
                    </span>
                    <span className="num text-[11px] text-ink-2">
                      시간당 {unitPrice(m.perHour!.median)} · {m.scope} {m.monthly.n}개
                    </span>
                  </>
                ) : (
                  <span className="text-[12px] text-ink-3">데이터 부족</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="시세보다 저렴한데 평점도 좋은 곳"
        desc={`${home ? home.sigungu : '전국'} · 평점 4.3 이상 · 같은 조건 중앙값보다 저렴한 순`}
        action={
          <Link
            to={`/search?sort=value&rating=4.3${home ? `&sido=${encodeURIComponent(home.sido)}&gu=${encodeURIComponent(home.sigungu)}` : ''}`}
            className="inline-flex shrink-0 items-center text-[13px] font-semibold text-accent"
          >
            전체 보기 <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          {valuePicks.map((r) => (
            <AcademyCard key={r.academy.id} result={r} metric={settings.metric} />
          ))}
        </div>
      </Section>

      <Section title="가격은 이렇게 비교해요">
        <ol className="grid gap-2 md:grid-cols-3">
          {[
            ['같은 단위로 환산', '3개월권, 10회권, 회당 요금도 월 수강료·회당·시간당 단가로 바꿔 나란히 놓습니다.'],
            ['숨은 비용까지 합산', '교재비, 차량비, 도복·호구, 승급심사비, 보험료를 주기별로 계산해 1년 기준 실질 월 부담을 보여줍니다.'],
            ['같은 조건끼리 시세 비교', '같은 과목·연령·수업형태(그룹/소수/1:1) 학원들 사이에서 몇 번째로 저렴한지 알려줍니다.'],
          ].map(([title, body], i) => (
            <li key={title} className="card p-4">
              <span className="num text-[12px] font-bold text-accent">STEP {i + 1}</span>
              <h3 className="mt-1 text-[15px] font-bold">{title}</h3>
              <p className="mt-1 text-[13px] text-ink-2">{body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Link to="/neis" className="card mt-7 flex items-center gap-3 p-4 transition-shadow hover:shadow-md">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <Database aria-hidden="true" className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold">교육청 신고 교습비 실데이터 조회</span>
          <span className="block text-[13px] text-ink-2">나이스(NEIS) 공개 API로 실제 등록 학원의 과정별 수강료를 찾아봅니다.</span>
        </span>
        <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-ink-3" />
      </Link>
    </div>
  );
}
