import { Plus, Trash } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { HBarList } from '../charts/HBarList';
import { academyPath } from '../components/AcademyCard';
import { RegionPicker } from '../components/RegionPicker';
import { EmptyState, PageHeader, Section, SubjectChips } from '../components/ui';
import { AGE_LABELS, AGE_ORDER, GROUPS, SUBJECT_MAP, subjectsOf } from '../data/categories';
import { useAvailability, useDistricts, useMarket } from '../hooks';
import { manwon, signedPercent, won } from '../lib/format';
import { marketForCourse, marketScopeName } from '../lib/realSearch';
import type { MarketRow } from '../lib/realData';
import { useApp, type CalcItem } from '../store/AppContext';
import type { AgeGroup } from '../types';

function itemMarket(rows: MarketRow[], item: CalcItem) {
  if (item.noMarket || !item.subjectId || !SUBJECT_MAP[item.subjectId]?.inNeis || !item.sido) return null;
  return marketForCourse(rows, { sido: item.sido, sigungu: item.sigungu }, { subjectId: item.subjectId, ages: item.age ? [item.age] : [] });
}

function CustomForm({ onAdd, people }: { onAdd: (item: Omit<CalcItem, 'id'>) => void; people: string[] }) {
  const { settings } = useApp();
  const [name, setName] = useState('');
  const [person, setPerson] = useState(people[0] ?? '첫째');
  const [monthly, setMonthly] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [age, setAge] = useState<AgeGroup | ''>('');
  const [region, setRegion] = useState(settings.home ?? { sido: '서울', sigungu: '강남구' });
  const [error, setError] = useState('');
  const amount = Math.round(Number(monthly.replace(/,/g, '')) * 10000);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !(amount > 0) || !person.trim()) return setError('이름, 누구, 월 금액을 입력해 주세요.');
    setError('');
    onAdd({ person: person.trim(), name: name.trim(), monthly: amount, subjectId: subjectId || null, age: age || null, sido: region.sido, sigungu: region.sigungu });
    setName('');
    setMonthly('');
  };
  return (
    <form onSubmit={submit} className="card grid gap-3 p-4" noValidate>
      <div className="grid grid-cols-[1fr_6.5rem] gap-2">
        <div>
          <label className="label" htmlFor="cf-name">
            학원·수업 이름
          </label>
          <input id="cf-name" className="field" placeholder="예: 동네 수영장, 과외" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="cf-person">
            누구
          </label>
          <input id="cf-person" className="field" list="people" value={person} onChange={(e) => setPerson(e.target.value)} />
          <datalist id="people">
            {people.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="cf-monthly">
            월 금액(만원)
          </label>
          <input id="cf-monthly" className="field num" inputMode="decimal" placeholder="예: 25" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
        </div>
        <div className="order-last col-span-2 sm:order-none sm:col-span-1">
          <label className="label" htmlFor="cf-subject">
            과목
          </label>
          <select id="cf-subject" className="field" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">선택 안 함</option>
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
        </div>
        <div>
          <label className="label" htmlFor="cf-age">
            대상
          </label>
          <select id="cf-age" className="field" value={age} onChange={(e) => setAge(e.target.value as AgeGroup | '')}>
            <option value="">선택 안 함</option>
            {AGE_ORDER.map((a) => (
              <option key={a} value={a}>
                {AGE_LABELS[a]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <RegionPicker idPrefix="cf" sido={region.sido} sigungu={region.sigungu} allowAll={false} onChange={(sido, sigungu) => setRegion({ sido, sigungu })} />
      {error && (
        <p role="alert" className="text-[13px] font-semibold text-pricey">
          {error}
        </p>
      )}
      <button type="submit" className="btn-ghost">
        <Plus aria-hidden="true" className="h-4 w-4" /> 직접 추가
      </button>
    </form>
  );
}

export function BudgetPage() {
  const { calc, addCalc, updateCalc, removeCalc, showToast } = useApp();
  const availability = useAvailability();
  // 정적 데이터면 시세 파일만 쓰고, 브라우저에서 받는 경우에만 항목 지역 데이터를 받는다
  const { states } = useDistricts(availability.mode === 'live' ? calc.filter((c) => c.sido && c.subjectId).map((c) => ({ sido: c.sido, sigungu: c.sigungu })) : []);
  const market = useMarket(Array.from(states.values()).map((s) => s.data));
  const people = Array.from(new Set(calc.map((c) => c.person)));
  const total = calc.reduce((s, c) => s + c.monthly, 0);
  const byPerson = people.map((p) => ({ person: p, total: calc.filter((c) => c.person === p).reduce((s, c) => s + c.monthly, 0) }));
  const compared = calc.map((c) => ({ item: c, match: itemMarket(market.rows, c) }));
  const overMedian = compared.reduce((s, { item, match }) => s + (match ? item.monthly - match.row.median : 0), 0);
  const comparedCount = compared.filter((c) => c.match).length;

  return (
    <div>
      <PageHeader title="내 학원비" subtitle="다니는 학원비를 모아 보고 우리 동네 신고 교습비 시세와 비교해요" />

      {calc.length === 0 ? (
        <EmptyState title="아직 추가한 학원비가 없어요" desc="학원 상세 화면의 ‘내 학원비에 추가’를 누르거나, 아래에서 직접 입력하세요. 체육시설·과외처럼 교육청 자료에 없는 곳도 넣을 수 있어요." />
      ) : (
        <>
          <div className="card grid gap-4 p-4 sm:grid-cols-3">
            <div>
              <p className="text-[13px] text-ink-2">한 달 합계</p>
              <p className="num text-[26px] font-bold">{manwon(total)}</p>
            </div>
            <div>
              <p className="text-[13px] text-ink-2">1년이면</p>
              <p className="num text-[26px] font-bold">{manwon(total * 12)}</p>
            </div>
            <div>
              <p className="text-[13px] text-ink-2">시세 중앙값과 비교 ({comparedCount}개 항목)</p>
              <p className={`num text-[26px] font-bold ${overMedian > 0 ? 'text-pricey' : overMedian < 0 ? 'text-cheap' : ''}`}>
                {comparedCount === 0 ? '-' : `${overMedian >= 0 ? '+' : '-'}${manwon(Math.abs(overMedian))}`}
              </p>
              {comparedCount > 0 && <p className="text-[12px] text-ink-3">월 기준 · {overMedian > 0 ? '시세보다 더 내고 있어요' : overMedian < 0 ? '시세보다 덜 내고 있어요' : '시세와 같아요'}</p>}
            </div>
          </div>

          {people.length > 1 && (
            <Section title="사람별 한 달 합계">
              <div className="card p-4">
                <HBarList format={manwon} items={byPerson.map((p) => ({ key: p.person, label: p.person, value: p.total }))} />
              </div>
            </Section>
          )}

          {people.map((person) => (
            <Section key={person} title={person} desc={`월 ${won(byPerson.find((p) => p.person === person)!.total)}`}>
              <ul className="flex flex-col gap-2">
                {compared
                  .filter(({ item }) => item.person === person)
                  .map(({ item, match }) => {
                    const diff = match ? item.monthly / match.row.median - 1 : null;
                    return (
                      <li key={item.id} className="card flex flex-col gap-2 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            {item.ref ? (
                              <Link to={academyPath(item.ref, item.course)} className="text-[15px] font-semibold hover:text-accent">
                                {item.name}
                              </Link>
                            ) : (
                              <p className="text-[15px] font-semibold">{item.name}</p>
                            )}
                            <div className="mt-1 flex flex-wrap items-center gap-1 text-[12px] text-ink-3">
                              {item.subjectId && <SubjectChips subjectIds={[item.subjectId]} />}
                              {item.age && <span>{AGE_LABELS[item.age]}</span>}
                              {item.sigungu && <span>· {item.sigungu}</span>}
                              {item.reportedPrice && <span>· 교육청 신고 {manwon(item.reportedPrice)}</span>}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              removeCalc(item.id);
                              const { id: _id, ...rest } = item;
                              void _id;
                              showToast('삭제했어요', { label: '되돌리기', onClick: () => addCalc(rest) });
                            }}
                            className="-mr-1 -mt-1 rounded-lg p-2.5 text-ink-3 hover:bg-surface-2"
                            aria-label={`${item.name} 삭제`}
                          >
                            <Trash aria-hidden="true" className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="flex flex-wrap items-end justify-between gap-2">
                          <label className="flex items-center gap-2 text-[13px] text-ink-2">
                            월
                            <input
                              className="field num w-24 py-1.5"
                              inputMode="decimal"
                              aria-label={`${item.name} 월 금액(만원)`}
                              defaultValue={String(item.monthly / 10000)}
                              onBlur={(e) => {
                                const v = Math.round(Number(e.target.value) * 10000);
                                if (v > 0) updateCalc(item.id, { monthly: v });
                                else e.target.value = String(item.monthly / 10000);
                              }}
                            />
                            만원
                          </label>
                          <p className="text-right text-[12px] text-ink-3">
                            {match && diff !== null ? (
                              <>
                                {marketScopeName(match.row, market.mode ?? 'static')} {match.row.age ? AGE_LABELS[match.row.age] : ''} 중앙값 {manwon(match.row.median)} 대비{' '}
                                <b className={diff > 0.005 ? 'text-pricey' : diff < -0.005 ? 'text-cheap' : 'text-ink'}>{signedPercent(diff)}</b>
                              </>
                            ) : market.loading ? (
                              '시세를 불러오는 중…'
                            ) : item.noMarket ? (
                              '특강·1:1 같은 과정이라 월 시세와 비교하지 않아요'
                            ) : item.subjectId && !SUBJECT_MAP[item.subjectId]?.inNeis ? (
                              '체육시설은 교육청 자료가 없어 시세 비교를 못 해요'
                            ) : item.subjectId ? (
                              '이 지역·과목은 시세를 낼 만큼 자료가 없어요'
                            ) : (
                              '과목을 정하지 않아 시세 비교 없음'
                            )}
                          </p>
                        </div>
                      </li>
                    );
                  })}
              </ul>
            </Section>
          ))}
        </>
      )}

      <Section title="직접 입력" desc="교육청 자료에 없는 체육시설·과외나 교습비가 공개되지 않은 학원도 함께 관리할 수 있어요">
        <CustomForm onAdd={addCalc} people={people} />
      </Section>

      <p className="mt-6 text-[12px] text-ink-3">입력한 내용은 이 브라우저에만 저장돼요.</p>
    </div>
  );
}
