import { Trash, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { HBarList } from '../charts/HBarList';
import { academyPath } from '../components/AcademyCard';
import { LoadingState } from '../components/DataState';
import { EmptyState, PageHeader, PriceLevelBadge, Section, SubjectChips } from '../components/ui';
import { AGE_LABELS, SUBJECT_MAP } from '../data/categories';
import type { DataMode } from '../data/source';
import { useDistricts, useMarket } from '../hooks';
import { dotDate, manwon, unitPrice } from '../lib/format';
import { isComparableCourse, positionOf, pricePerSession, type Course, type RealAcademy } from '../lib/realData';
import { marketForCourse, marketScopeName, type MarketMatch } from '../lib/realSearch';
import { MAX_COMPARE, useApp, type CompareItem } from '../store/AppContext';

interface Column {
  item: CompareItem;
  academy: RealAcademy | null;
  course: Course | null;
  match: MarketMatch | null;
  position: ReturnType<typeof positionOf> | null;
}

function Cell({ children, best }: { children: ReactNode; best?: boolean }) {
  return <td className={`num px-3 py-2.5 align-top text-[13px] ${best ? 'font-bold text-cheap' : ''}`}>{children}</td>;
}

export function ComparePage() {
  const { compare, removeCompare, clearCompare, setCompareCourse } = useApp();
  const { states, loading } = useDistricts(compare.map((c) => c.ref));
  const datas = Array.from(states.values()).map((s) => s.data);
  const market = useMarket(datas);
  const mode: DataMode = market.mode ?? 'static';

  if (compare.length === 0) {
    return (
      <div>
        <PageHeader title="비교함" />
        <EmptyState
          title="비교함이 비어 있어요"
          desc={`학원 카드의 + 버튼이나 상세 화면의 ‘비교함에 담기’로 최대 ${MAX_COMPARE}곳까지 담아 같은 기준으로 비교해 보세요.`}
          action={
            <Link to="/search" className="btn-primary">
              학원 찾으러 가기
            </Link>
          }
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="비교함" />
        <LoadingState />
      </div>
    );
  }

  const columns: Column[] = compare.map((item) => {
    const data = states.get(`${item.ref.sido}|${item.ref.sigungu}`)?.data;
    const academy = data ? ([...data.academies, ...data.unknownDistrict].find((a) => a.id === item.ref.id) ?? null) : null;
    const course = academy?.courses.find((c) => c.name === item.course) ?? null;
    const match = academy && course && isComparableCourse(course) ? marketForCourse(market.rows, academy, course) : null;
    return { item, academy, course, match, position: course && match ? positionOf(course.price, match.row) : null };
  });

  const priced = columns.filter((c) => c.course);
  const minPrice = priced.length > 1 ? Math.min(...priced.map((c) => c.course!.price)) : null;
  const subjects = new Set(priced.map((c) => c.course!.subjectId ?? '?'));
  const ageSets = new Set(priced.map((c) => c.course!.ages.join(',')));

  return (
    <div>
      <PageHeader
        title="비교함"
        subtitle={`${compare.length} / ${MAX_COMPARE}곳 · 교육청 신고 교습비 기준`}
        action={
          <button type="button" className="btn-ghost px-3 py-1.5 text-[13px]" onClick={clearCompare}>
            <Trash aria-hidden="true" className="h-4 w-4" />
            비우기
          </button>
        }
      />

      {(subjects.size > 1 || ageSets.size > 1) && (
        <p className="mb-3 rounded-xl bg-pricey-soft px-3 py-2 text-[13px] text-pricey">
          {subjects.size > 1 ? '과목이 서로 달라요. ' : '대상 연령이 서로 달라요. '}같은 과목·같은 대상끼리 비교해야 정확해요. 각 학원의 과정을 바꿔 보세요.
        </p>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="w-28 px-3 py-3 text-[12px] font-semibold text-ink-3">
                항목
              </th>
              {columns.map((c) => (
                <th key={c.item.ref.id} scope="col" className="px-3 py-3 align-top">
                  <div className="flex items-start justify-between gap-1">
                    <Link to={academyPath(c.item.ref, c.item.course)} className="text-[14px] font-bold leading-snug hover:text-accent">
                      {c.item.ref.name}
                    </Link>
                    <button type="button" onClick={() => removeCompare(c.item.ref.id)} className="-mr-1 rounded p-0.5 text-ink-3 hover:bg-surface-2" aria-label={`${c.item.ref.name} 빼기`}>
                      <X aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </div>
                  {c.academy && c.academy.courses.length > 0 ? (
                    <select
                      className="field mt-2 py-1.5 text-[12px] font-normal"
                      aria-label={`${c.item.ref.name} 비교할 과정`}
                      value={c.course?.name ?? ''}
                      onChange={(e) => setCompareCourse(c.item.ref.id, e.target.value || null)}
                    >
                      {!c.course && <option value="">과정 선택</option>}
                      {c.academy.courses.map((course) => (
                        <option key={`${course.name}|${course.price}`} value={course.name}>
                          {course.name} · {manwon(course.price)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="mt-2 text-[12px] font-normal text-ink-3">{c.academy ? '교습비 미공개' : '이번 자료에서 찾지 못함'}</p>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            <tr>
              <th scope="row" className="px-3 py-2.5 text-[12px] font-semibold text-ink-3">
                월 신고 교습비
              </th>
              {columns.map((c) => (
                <Cell key={c.item.ref.id} best={minPrice !== null && c.course?.price === minPrice}>
                  {c.course ? (
                    <>
                      <span className="text-[16px] font-bold">{manwon(c.course.price)}</span>
                      {minPrice !== null && c.course.price === minPrice && <span className="price-tag ml-1 align-middle">최저</span>}
                    </>
                  ) : (
                    '-'
                  )}
                </Cell>
              ))}
            </tr>
            <tr>
              <th scope="row" className="px-3 py-2.5 text-[12px] font-semibold text-ink-3">
                회당 (주 횟수 기준)
              </th>
              {columns.map((c) => {
                const per = c.course ? pricePerSession(c.course) : null;
                return <Cell key={c.item.ref.id}>{per ? `${unitPrice(per)} · 주 ${c.course!.sessionsPerWeek}회` : <span className="text-ink-3">횟수 정보 없음</span>}</Cell>;
              })}
            </tr>
            <tr>
              <th scope="row" className="px-3 py-2.5 text-[12px] font-semibold text-ink-3">
                시세 대비
              </th>
              {columns.map((c) => (
                <Cell key={c.item.ref.id}>
                  {c.position && c.match ? (
                    <span className="flex flex-col items-start gap-1">
                      <PriceLevelBadge level={c.position.level} diff={c.position.diffFromMedian} />
                      <span className="text-[11px] text-ink-3">
                        {marketScopeName(c.match.row, mode, c.item.ref)} {c.match.row.age ? AGE_LABELS[c.match.row.age] : ''} 중앙값 {manwon(c.match.row.median)} · 하위 {Math.round(c.position.percentile)}%
                      </span>
                    </span>
                  ) : (
                    <span className="text-ink-3">{c.course && !isComparableCourse(c.course) ? '비교 제외 과정' : '시세 없음'}</span>
                  )}
                </Cell>
              ))}
            </tr>
            <tr>
              <th scope="row" className="px-3 py-2.5 text-[12px] font-semibold text-ink-3">
                과목 · 대상
              </th>
              {columns.map((c) => (
                <Cell key={c.item.ref.id}>
                  {c.course?.subjectId ? <SubjectChips subjectIds={[c.course.subjectId]} /> : c.academy?.subjects.length ? <SubjectChips subjectIds={c.academy.subjects} /> : '-'}
                  {c.course && c.course.ages.length > 0 && <span className="mt-1 block text-[12px] text-ink-2">{c.course.ages.map((a) => AGE_LABELS[a]).join(' · ')}</span>}
                </Cell>
              ))}
            </tr>
            <tr>
              <th scope="row" className="px-3 py-2.5 text-[12px] font-semibold text-ink-3">
                종류 · 지역
              </th>
              {columns.map((c) => (
                <Cell key={c.item.ref.id}>
                  {c.academy ? (
                    <>
                      {c.academy.kind} · {c.academy.unassigned ? `${c.academy.sigungu}(구 미상)` : c.academy.sigungu} {c.academy.dong}
                    </>
                  ) : (
                    `${c.item.ref.sigungu}`
                  )}
                </Cell>
              ))}
            </tr>
            <tr>
              <th scope="row" className="px-3 py-2.5 text-[12px] font-semibold text-ink-3">
                정원
              </th>
              {columns.map((c) => (
                <Cell key={c.item.ref.id}>{c.academy?.capacity ? `${c.academy.capacity.toLocaleString()}명` : '-'}</Cell>
              ))}
            </tr>
            <tr>
              <th scope="row" className="px-3 py-2.5 text-[12px] font-semibold text-ink-3">
                설립 · 자료 갱신
              </th>
              {columns.map((c) => (
                <Cell key={c.item.ref.id}>
                  {c.academy ? (
                    <>
                      {c.academy.established ? dotDate(c.academy.established) : '-'}
                      <span className="block text-[11px] text-ink-3">교육청 갱신 {c.academy.loadedAt ? dotDate(c.academy.loadedAt) : '-'}</span>
                    </>
                  ) : (
                    '-'
                  )}
                </Cell>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {priced.length > 1 && (
        <Section title="월 신고 교습비" desc="낮은 순">
          <div className="card p-4">
            <HBarList
              format={manwon}
              items={[...priced]
                .sort((a, b) => a.course!.price - b.course!.price)
                .map((c) => ({
                  key: c.item.ref.id,
                  label: c.item.ref.name,
                  value: c.course!.price,
                  sub: SUBJECT_MAP[c.course!.subjectId ?? '']?.name,
                  highlight: c.course!.price === minPrice,
                }))}
            />
          </div>
        </Section>
      )}

      <p className="mt-6 text-[12px] text-ink-3">신고 교습비는 학원이 교육청에 신고한 1인 월 금액이에요. 교재비·차량비·할인은 포함되지 않아요.</p>
    </div>
  );
}
