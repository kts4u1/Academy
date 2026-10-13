import { Check, ExternalLink, Heart, MapPin, Phone, Plus, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Histogram } from '../charts/Histogram';
import { RangeStrip } from '../charts/RangeStrip';
import { academyPath, refOf, useAcademyActions } from '../components/AcademyCard';
import { DataStamp, DistrictGate } from '../components/DataState';
import { BackButton, EmptyState, KindBadge, PriceLevelBadge, Section, Sheet, SubjectChips, SubjectTile } from '../components/ui';
import { AGE_LABELS, SUBJECT_MAP } from '../data/categories';
import type { DataMode, DistrictData } from '../data/source';
import { useDistrictData, useMarket } from '../hooks';
import { dotDate, manwon, shortMan, signedPercent, unitPrice } from '../lib/format';
import { academyPrices, isComparableCourse, positionOf, pricePerSession, type Course, type MarketRow, type RealAcademy } from '../lib/realData';
import { cheaperAlternatives, marketForCourse, marketScopeName } from '../lib/realSearch';
import { useApp } from '../store/AppContext';

/** 익명 처리된 번호(02-0000-0000 등)는 전화 걸기를 숨긴다 */
export function callablePhone(phone: string): boolean {
  return /\d/.test(phone) && !/0000-0000$/.test(phone);
}

function marketLabel(row: MarketRow, mode: DataMode, data: DistrictData): string {
  return `${marketScopeName(row, mode, data)} ${row.age ? AGE_LABELS[row.age] + ' ' : ''}${SUBJECT_MAP[row.subjectId]?.name ?? ''}`;
}

function CourseRow({ course, selected, onSelect, rows, academy }: { course: Course; selected: boolean; onSelect: () => void; rows: MarketRow[]; academy: RealAcademy }) {
  const comparable = isComparableCourse(course);
  const market = comparable ? marketForCourse(rows, academy, course) : null;
  const pos = market ? positionOf(course.price, market.row) : null;
  const perSession = pricePerSession(course);
  return (
    <li>
      <label className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 ${selected ? 'border-accent bg-accent-soft/40' : 'border-line'} ${comparable ? '' : 'opacity-75'}`}>
        <input type="radio" name="course" className="mt-1 accent-[rgb(var(--accent))]" checked={selected} onChange={onSelect} />
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
              course: course?.name,
              reportedPrice: course?.price,
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
  const defaultCourse = sortedCourses.find((c) => c.name === courseParam) ?? sortedCourses.find(isComparableCourse) ?? sortedCourses[0] ?? null;
  const [selectedName, setSelectedName] = useState<string | null>(defaultCourse?.name ?? null);
  const selected = sortedCourses.find((c) => c.name === selectedName) ?? defaultCourse;
  const region = { sido: data.sido, sigungu: data.sigungu };
  const actions = useAcademyActions(academy, region);

  const comparable = selected && isComparableCourse(selected) ? selected : null;
  const match = comparable ? marketForCourse(market.rows, academy, comparable) : null;
  const pos = comparable && match ? positionOf(comparable.price, match.row) : null;
  const rawAge = match?.row.age ?? null;
  const localPrices = comparable && match && !match.widened ? academyPrices(data.academies, comparable.subjectId!, rawAge) : [];
  const alternatives = comparable ? cheaperAlternatives(data, academy, comparable) : [];
  const mode = market.mode ?? data.mode;

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

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn-ghost" onClick={actions.onFavorite} aria-pressed={actions.fav}>
          <Heart aria-hidden="true" className={`h-4 w-4 ${actions.fav ? 'fill-pricey text-pricey' : ''}`} />
          {actions.fav ? '찜함' : '찜하기'}
        </button>
        <button type="button" className="btn-ghost" onClick={() => actions.onCompare(selected?.name ?? null)}>
          {actions.comparing ? <Check aria-hidden="true" className="h-4 w-4 text-accent" /> : <Plus aria-hidden="true" className="h-4 w-4" />}
          {actions.comparing ? '비교함 과정 바꾸기' : '비교함에 담기'}
        </button>
        <button type="button" className="btn-ghost" onClick={() => setBudgetOpen(true)}>
          <Wallet aria-hidden="true" className="h-4 w-4" />내 학원비에 추가
        </button>
      </div>

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
          <ul className="flex flex-col gap-2">
            {sortedCourses.map((c) => (
              <CourseRow key={`${c.name}|${c.price}`} course={c} selected={selected === c} onSelect={() => setSelectedName(c.name)} rows={market.rows} academy={academy} />
            ))}
          </ul>
        )}
      </Section>

      {comparable && (
        <Section title="시세와 비교" desc={match ? `${marketLabel(match.row, mode, data)} ${match.row.academies}곳 기준 (학원마다 대표 금액 하나)` : undefined}>
          {match && pos ? (
            <div className="card flex flex-col gap-4 p-4">
              <p className="text-[15px]">
                <b>{comparable.name}</b> {manwon(comparable.price)}은(는) 중앙값 {manwon(match.row.median)}보다{' '}
                <b className={pos.diffFromMedian < -0.005 ? 'text-cheap' : pos.diffFromMedian > 0.005 ? 'text-pricey' : ''}>
                  {Math.abs(pos.diffFromMedian) < 0.005 ? '거의 같아요' : `${signedPercent(pos.diffFromMedian)} (${manwon(Math.abs(comparable.price - match.row.median))} ${pos.diffFromMedian < 0 ? '저렴' : '비쌈'})`}
                </b>
                <span className="block text-[13px] text-ink-3">저렴한 쪽부터 {Math.round(pos.percentile)}% 위치</span>
              </p>
              <RangeStrip stats={{ n: match.row.n, min: match.row.min, max: match.row.max, mean: match.row.median, median: match.row.median, p25: match.row.p25, p75: match.row.p75 }} value={comparable.price} format={manwon} />
              {match.widened && <p className="text-[12px] text-ink-3">{data.sigungu}에 같은 조건으로 교습비를 공개한 곳이 3곳 미만이라 범위를 넓혀 비교했어요.</p>}
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
        <BackButton />
      </div>
      <div>
        <DistrictGate state={district} onRetry={district.reload}>
          {(data) => <Detail key={id} data={data} id={id} courseParam={params.get('course')} />}
        </DistrictGate>
      </div>
    </div>
  );
}
