import { Check, ExternalLink, Heart, MapPin, Phone, Plus, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Histogram } from '../charts/Histogram';
import { RangeStrip } from '../charts/RangeStrip';
import { academyPath, refOf, useAcademyActions } from '../components/AcademyCard';
import { DataStamp, DistrictGate, ErrorState, LoadingState } from '../components/DataState';
import { BackButton, EmptyState, KindBadge, PriceLevelBadge, Section, Sheet, SubjectChips, SubjectTile } from '../components/ui';
import { AGE_LABELS, SUBJECT_MAP } from '../data/categories';
import type { DataMode, DistrictData } from '../data/source';
import { useDistrictData, useMarket } from '../hooks';
import { dotDate, manwon, shortMan, signedPercent, unitPrice } from '../lib/format';
import { academyPrices, courseKey, findCourse, isComparableCourse, positionOf, pricePerSession, type Course, type MarketRow, type RealAcademy } from '../lib/realData';
import { cheaperAlternatives, marketForCourse, marketScopeName } from '../lib/realSearch';
import { useApp } from '../store/AppContext';

/** 익명 처리된 번호(02-0000-0000 등)는 전화 걸기를 숨긴다 */
export function callablePhone(phone: string): boolean {
  return /\d/.test(phone) && !/0000-0000$/.test(phone);
}

function marketLabel(row: MarketRow, mode: DataMode): string {
  return `${marketScopeName(row, mode)} ${row.age ? AGE_LABELS[row.age] + ' ' : ''}${SUBJECT_MAP[row.subjectId]?.name ?? ''}`;
}

function CourseRow({ course, selected, onSelect, rows, academy }: { course: Course; selected: boolean; onSelect: () => void; rows: MarketRow[]; academy: RealAcademy }) {
  const comparable = isComparableCourse(course);
  const market = comparable ? marketForCourse(rows, academy, course) : null;
  const pos = market ? positionOf(course.price, market.row) : null;
  const perSession = pricePerSession(course);
  return (
    <li>
      <label className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 ${selected ? 'border-accent bg-accent-soft/40' : 'border-line'} ${comparable ? '' : 'opacity-75'}`}>
        <input type="radio" name="course" className="peer sr-only" checked={selected} onChange={onSelect} />
        <span
          aria-hidden="true"
          className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${selected ? 'border-accent' : 'border-ink-3/50'}`}
        >
          {selected && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-medium leading-snug">{course.name}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-ink-3">
            {course.subjectId && <SubjectChips subjectIds={[course.subjectId]} />}
            {course.ages.map((a) => (
              <span key={a} className="rounded-md bg-surface-2 px-1.5 py-0.5 font-semibold text-ink-2">
                {AGE_LABELS[a]}
              </span>
            ))}
            {course.sessionsPerWeek && <span>주 {course.sessionsPerWeek}회</span>}
            {course.private && <span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-semibold text-ink-2">1:1 · 비교 제외</span>}
            {course.excluded && <span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-semibold text-ink-2">비교 제외 · {course.excluded}</span>}
            {!course.subjectId && !course.excluded && !course.private && <span>과목 미분류</span>}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1 text-right">
          <span className="num text-[16px] font-bold">{manwon(course.price)}</span>
          {perSession && <span className="num text-[11px] text-ink-3">회당 약 {unitPrice(perSession)}</span>}
          {pos && <PriceLevelBadge level={pos.level} diff={pos.diffFromMedian} />}
        </span>
      </label>
    </li>
  );
}

function AddToBudget({ open, onClose, academy, course, data }: { open: boolean; onClose: () => void; academy: RealAcademy; course: Course | null; data: DistrictData }) {
  const { addCalc, calc, showToast } = useApp();
  const people = Array.from(new Set(calc.map((c) => c.person)));
  const [person, setPerson] = useState(people[0] ?? '첫째');
  const [amount, setAmount] = useState(course ? String(course.price / 10000) : '');
  const monthly = Math.round(Number(amount) * 10000);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="내 학원비에 추가"
      footer={
        <button
          type="button"
          className="btn-primary w-full"
          disabled={!(monthly > 0) || !person.trim()}
          onClick={() => {
            addCalc({
              person: person.trim(),
              name: academy.name + (course ? ` · ${course.name}` : ''),
              monthly,
              subjectId: course?.subjectId ?? academy.subjects[0] ?? null,
              age: course && course.ages.length === 1 ? course.ages[0] : null,
              sido: academy.sido,
              sigungu: academy.unassigned ? data.sigungu : academy.sigungu,
              ref: refOf(academy, data),
              course: course ? courseKey(course) : undefined,
              reportedPrice: course?.price,
              ...(course && !isComparableCourse(course) ? { noMarket: true } : {}),
            });
            onClose();
            showToast('내 학원비에 추가했어요');
          }}
        >
          추가하기
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="rounded-xl bg-surface-2 px-3 py-2 text-[13px]">
          <b className="block">{academy.name}</b>
          <span className="text-ink-3">{course ? `${course.name} · 신고 ${manwon(course.price)}` : '교습비 미공개'}</span>
        </p>
        <div>
          <label className="label" htmlFor="budget-person">
            누구의 학원비인가요?
          </label>
          <input id="budget-person" className="field" value={person} onChange={(e) => setPerson(e.target.value)} list="budget-people" />
          <datalist id="budget-people">
            {people.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="label" htmlFor="budget-amount">
            실제로 내는 월 금액 (만원)
          </label>
          <input id="budget-amount" className="field num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="예: 32" />
          <p className="mt-1 text-[12px] text-ink-3">
            {course ? `교육청 신고 교습비는 ${manwon(course.price)}이에요. 할인·교재비 등으로 다르면 실제 금액을 넣어 주세요.` : '교육청에 교습비가 공개되지 않은 곳이에요. 실제로 내는 금액을 넣어 주세요.'}
          </p>
        </div>
      </div>
    </Sheet>
  );
}

function Detail({ data, id, courseParam }: { data: DistrictData; id: string; courseParam: string | null }) {
  const academy = useMemo(() => [...data.academies, ...data.unknownDistrict].find((a) => a.id === id), [data, id]);
  if (!academy) {
    return (
      <EmptyState
        title="이번 교육청 자료에서 이 학원을 찾지 못했어요"
        desc="폐원·휴원했거나 등록 정보가 바뀌었을 수 있어요. 같은 지역에서 다시 검색해 보세요."
        action={
          <Link to={`/search?sido=${encodeURIComponent(data.sido)}&sigungu=${encodeURIComponent(data.sigungu)}`} className="btn-ghost">
            {data.sigungu} 학원 찾기
          </Link>
        }
      />
    );
  }
  return <AcademyView data={data} academy={academy} courseParam={courseParam} />;
}

function AcademyView({ data, academy, courseParam }: { data: DistrictData; academy: RealAcademy; courseParam: string | null }) {
  const market = useMarket([data]);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const sortedCourses = useMemo(
    () => [...academy.courses].sort((x, y) => Number(!isComparableCourse(x)) - Number(!isComparableCourse(y)) || (x.subjectId ?? 'zz').localeCompare(y.subjectId ?? 'zz') || x.price - y.price),
    [academy],
  );
  // 같은 이름의 과정이 금액만 다르게 여러 개일 수 있어 이름|금액 키로 고른다
  const defaultCourse = findCourse(sortedCourses, courseParam) ?? sortedCourses.find(isComparableCourse) ?? sortedCourses[0] ?? null;
  const [selectedKey, setSelectedKey] = useState<string | null>(defaultCourse ? courseKey(defaultCourse) : null);
  const selected = findCourse(sortedCourses, selectedKey) ?? defaultCourse;
  const region = { sido: data.sido, sigungu: data.sigungu };
  const actions = useAcademyActions(academy, region);

  const comparable = selected && isComparableCourse(selected) ? selected : null;
  const match = comparable ? marketForCourse(market.rows, academy, comparable) : null;
  const pos = comparable && match ? positionOf(comparable.price, match.row) : null;
  const rawAge = match?.row.age ?? null;
  const localPrices = comparable && match && !match.widened ? academyPrices(data.academies, comparable.subjectId!, rawAge) : [];
  const alternatives = comparable ? cheaperAlternatives(data, academy, comparable) : [];
  const mode = market.mode ?? data.mode;
  const phoneOk = callablePhone(academy.phone);
  const [showAllCourses, setShowAllCourses] = useState(false);
  const COURSE_PREVIEW = 6;
  // 접힌 목록에도 고른 과정은 보이게 한다
  const visibleCourses =
    showAllCourses || sortedCourses.length <= COURSE_PREVIEW + 1
      ? sortedCourses
      : Array.from(new Set([...sortedCourses.slice(0, COURSE_PREVIEW), ...(selected ? [selected] : [])]));

  return (
    <div>
      <div className="flex items-start gap-3">
        {academy.subjects[0] && <SubjectTile subjectId={academy.subjects[0]} size="lg" />}
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-bold leading-tight tracking-tight">{academy.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-3">
            <KindBadge kind={academy.kind} />
            {academy.realm && <span>{academy.realm}</span>}
            {academy.category && <span>· {academy.category}</span>}
            {academy.subjects.length > 0 && <SubjectChips subjectIds={academy.subjects} />}
          </div>
        </div>
      </div>

      {/* 휴대폰에서 엄지로 누르기 쉬운 같은 크기의 버튼들 */}
      <div className={`mt-4 grid gap-2 ${phoneOk ? 'grid-cols-4' : 'grid-cols-3'} sm:flex sm:flex-wrap`}>
        {phoneOk && (
          <a href={`tel:${academy.phone}`} className="action-btn">
            <Phone aria-hidden="true" className="h-5 w-5 text-accent sm:h-4 sm:w-4" />
            전화
          </a>
        )}
        <button type="button" className="action-btn" onClick={actions.onFavorite} aria-pressed={actions.fav}>
          <Heart aria-hidden="true" className={`h-5 w-5 sm:h-4 sm:w-4 ${actions.fav ? 'fill-pricey text-pricey' : ''}`} />
          {actions.fav ? '찜함' : '찜하기'}
        </button>
        <button type="button" className="action-btn" onClick={() => actions.onCompare(selected ? courseKey(selected) : null)}>
          {actions.comparing ? <Check aria-hidden="true" className="h-5 w-5 text-accent sm:h-4 sm:w-4" /> : <Plus aria-hidden="true" className="h-5 w-5 sm:h-4 sm:w-4" />}
          {actions.comparing ? '과정 바꾸기' : '비교함'}
        </button>
        <button type="button" className="action-btn" onClick={() => setBudgetOpen(true)}>
          <Wallet aria-hidden="true" className="h-5 w-5 sm:h-4 sm:w-4" />
          내 학원비
        </button>
      </div>

      {/* 고른 과정의 시세 요약: 과정이 많아도 첫 화면에서 답이 보이게 */}
      {comparable && (
        <button
          type="button"
          onClick={() => document.getElementById('market')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="card mt-3 flex w-full items-center justify-between gap-3 p-3.5 text-left sm:hidden"
        >
          <span className="min-w-0">
            <span className="block truncate text-[12px] text-ink-3">{comparable.name}</span>
            <span className="num text-[20px] font-bold">{manwon(comparable.price)}</span>
          </span>
          {market.loading ? (
            <span className="text-[12px] text-ink-3">시세 확인 중…</span>
          ) : pos && match ? (
            <span className="flex shrink-0 flex-col items-end gap-1">
              <PriceLevelBadge level={pos.level} diff={pos.diffFromMedian} />
              <span className="text-[11px] text-ink-3">중앙값 {manwon(match.row.median)} · 자세히 ↓</span>
            </span>
          ) : (
            <span className="text-[12px] text-ink-3">시세 없음</span>
          )}
        </button>
      )}

      <dl className="card mt-4 grid gap-x-6 gap-y-2 p-4 text-sm sm:grid-cols-2">
        <div className="flex gap-2 sm:col-span-2">
          <dt className="w-16 shrink-0 text-ink-3">주소</dt>
          <dd className="min-w-0">
            {academy.address || '-'}
            {academy.unassigned && <span className="block text-[12px] text-ink-3">교육청 자료에 구가 없어 {academy.sigungu}의 어느 구인지 확인하지 못했어요.</span>}
            {academy.address && (
              <a
                href={`https://map.naver.com/p/search/${encodeURIComponent(academy.address.replace(/\s*\(.*$/, '').replace(/,.*$/, ''))}`}
                target="_blank"
                rel="noreferrer"
                className="ml-1 inline-flex items-center gap-0.5 text-[12px] font-semibold text-accent hover:underline"
              >
                <MapPin aria-hidden="true" className="h-3 w-3" />
                지도 <ExternalLink aria-hidden="true" className="h-3 w-3" />
              </a>
            )}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-ink-3">전화</dt>
          <dd>
            {callablePhone(academy.phone) ? (
              <a href={`tel:${academy.phone}`} className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">
                <Phone aria-hidden="true" className="h-3.5 w-3.5" />
                {academy.phone}
              </a>
            ) : (
              <span className="text-ink-3">공개되지 않음</span>
            )}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-ink-3">정원</dt>
          <dd>{academy.capacity ? `${academy.capacity.toLocaleString()}명` : '-'}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-ink-3">설립</dt>
          <dd>{academy.established ? dotDate(academy.established) : '-'}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-ink-3">자료 갱신</dt>
          <dd>{academy.loadedAt ? dotDate(academy.loadedAt) : '-'} (교육청)</dd>
        </div>
      </dl>

      <Section title="교습과정별 신고 교습비" desc="학원이 교육청에 신고한 1인 월 교습비예요. 과정을 고르면 아래에서 시세와 비교해요.">
        {sortedCourses.length === 0 ? (
          <p className="card p-4 text-sm text-ink-2">
            교육청 자료에 교습비가 공개되지 않았어요. 학원(교습소가 아닌 곳)은 공개 자료에 교습비가 비어 있는 경우가 많아요. 전화로 문의한 금액은 ‘내 학원비’에 넣어 관리할 수 있어요.
          </p>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {visibleCourses.map((c) => (
                <CourseRow key={courseKey(c)} course={c} selected={selected === c} onSelect={() => setSelectedKey(courseKey(c))} rows={market.rows} academy={academy} />
              ))}
            </ul>
            {visibleCourses.length < sortedCourses.length && (
              <button type="button" className="btn-ghost mt-2 w-full" onClick={() => setShowAllCourses(true)}>
                전체 {sortedCourses.length}개 과정 보기
              </button>
            )}
          </>
        )}
      </Section>

      {comparable && (
        <Section id="market" title="시세와 비교" desc={match ? `${marketLabel(match.row, mode)} ${match.row.academies}곳 기준 (학원마다 대표 금액 하나)` : undefined}>
          {market.loading ? (
            <LoadingState message="교습비 시세를 불러오는 중…" />
          ) : market.error ? (
            <ErrorState message={market.error} />
          ) : match && pos ? (
            <div className="card flex flex-col gap-4 p-4">
              <p className="text-[15px]">
                <b>{comparable.name}</b> {manwon(comparable.price)}은(는) 중앙값 {manwon(match.row.median)}보다{' '}
                <b className={pos.diffFromMedian < -0.005 ? 'text-cheap' : pos.diffFromMedian > 0.005 ? 'text-pricey' : ''}>
                  {Math.abs(pos.diffFromMedian) < 0.005 ? '거의 같아요' : `${signedPercent(pos.diffFromMedian)} (${manwon(Math.abs(comparable.price - match.row.median))} ${pos.diffFromMedian < 0 ? '저렴' : '비쌈'})`}
                </b>
                <span className="block text-[13px] text-ink-3">저렴한 쪽부터 {Math.round(pos.percentile)}% 위치</span>
              </p>
              <RangeStrip stats={{ n: match.row.n, min: match.row.min, max: match.row.max, mean: match.row.median, median: match.row.median, p25: match.row.p25, p75: match.row.p75 }} value={comparable.price} format={manwon} />
              {match.widened && (
                <p className="text-[12px] text-ink-3">
                  {academy.unassigned
                    ? `주소로 구를 정하지 못한 곳이라 ${marketScopeName(match.row, mode)}와 비교했어요.`
                    : `${academy.sigungu}에 같은 조건으로 교습비를 공개한 곳이 3곳 미만이라 범위를 넓혀 비교했어요.`}
                </p>
              )}
              {localPrices.length >= 5 && (
                <Histogram values={localPrices} median={match.row.median} marker={{ value: comparable.price, label: '이 과정' }} format={manwon} tickFormat={shortMan} unitLabel="곳" />
              )}
            </div>
          ) : (
            <p className="card p-4 text-sm text-ink-2">같은 과목·대상으로 교습비를 공개한 곳이 3곳 미만이라 아직 시세를 낼 수 없어요.</p>
          )}
        </Section>
      )}

      {alternatives.length > 0 && comparable && (
        <Section title="같은 동네에서 더 저렴한 곳" desc={`${SUBJECT_MAP[comparable.subjectId!]?.name ?? ''}${comparable.ages.length === 1 ? ` · ${AGE_LABELS[comparable.ages[0]]}` : ''} 과정 신고 교습비 기준`}>
          <ul className="card divide-y divide-line">
            {alternatives.map(({ academy: a, course }) => (
              <li key={a.id}>
                <Link to={academyPath(refOf(a, region), course.name)} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2">
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold">{a.name}</span>
                    <span className="block truncate text-[12px] text-ink-3">
                      {a.kind} · {a.dong || a.sigungu} · {course.name}
                    </span>
                  </span>
                  <span className="num shrink-0 text-right">
                    <b className="block text-[15px]">{manwon(course.price)}</b>
                    <span className="text-[11px] text-cheap">-{manwon(comparable.price - course.price)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div className="mt-6">
        <DataStamp data={data} />
        <p className="mt-1 text-[12px] text-ink-3">신고 교습비는 실제 받는 금액(할인·교재비·차량비 등)과 다를 수 있어요. 등록 전 학원에 꼭 확인하세요.</p>
      </div>

      {budgetOpen && <AddToBudget open onClose={() => setBudgetOpen(false)} academy={academy} course={comparable ?? selected} data={data} />}
    </div>
  );
}

export function AcademyPage() {
  const { sido = '', sigungu = '', id = '' } = useParams();
  const [params] = useSearchParams();
  const district = useDistrictData(sido, sigungu);
  return (
    <div>
      <div className="pb-2 pt-2">
        <BackButton fallback={`/search?sido=${encodeURIComponent(sido)}&sigungu=${encodeURIComponent(sigungu)}`} />
      </div>
      <div>
        <DistrictGate state={district} onRetry={district.reload}>
          {(data) => <Detail key={id} data={data} id={id} courseParam={params.get('course')} />}
        </DistrictGate>
      </div>
    </div>
  );
}
