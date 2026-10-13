import { Check, Heart, MapPin, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AGE_LABELS } from '../data/categories';
import { manwon } from '../lib/format';
import { courseKey, type RealAcademy } from '../lib/realData';
import { marketScopeName, type SearchHit } from '../lib/realSearch';
import type { DataMode } from '../data/source';
import { useApp } from '../store/AppContext';
import type { AcademyRef } from '../types';
import { KindBadge, PriceLevelBadge, SubjectChips, SubjectTile } from './ui';

export function academyPath(ref: Pick<AcademyRef, 'id' | 'sido' | 'sigungu'>, course?: string | null): string {
  const base = `/academy/${encodeURIComponent(ref.sido)}/${encodeURIComponent(ref.sigungu)}/${encodeURIComponent(ref.id)}`;
  return course ? `${base}?course=${encodeURIComponent(course)}` : base;
}

export function refOf(academy: RealAcademy, region: { sido: string; sigungu: string }): AcademyRef {
  return { id: academy.id, sido: region.sido, sigungu: region.sigungu, name: academy.name };
}

/** 화면에 보여 줄 위치: 구를 정하지 못한 곳은 검색한 구가 아니라 '성남시(구 미상)'로 */
export function placeOf(academy: RealAcademy): string {
  return `${academy.unassigned ? `${academy.sigungu}(구 미상)` : academy.sigungu} ${academy.dong}`.trim();
}

/** 찜·비교 버튼 (카드·상세 공용) */
export function useAcademyActions(academy: RealAcademy, region: { sido: string; sigungu: string }) {
  const { toggleFavorite, isFavorite, addCompare, inCompare, removeCompare, showToast, compare } = useApp();
  const ref = refOf(academy, region);
  return {
    fav: isFavorite(academy.id),
    comparing: inCompare(academy.id),
    onFavorite: () => {
      const item = { ...ref, dong: academy.dong, place: placeOf(academy), kind: academy.kind, subjects: academy.subjects };
      const added = toggleFavorite(item);
      if (added) showToast('찜했어요');
      else showToast('찜을 해제했어요', { label: '되돌리기', onClick: () => toggleFavorite(item) });
    },
    /** course: 과정 키 (courseKey) */
    onCompare: (course: string | null) => {
      const r = addCompare({ ref, course });
      showToast(r === 'full' ? '비교함은 최대 4곳까지 담을 수 있어요' : r === 'updated' ? '비교할 과정을 바꿨어요' : '비교함에 담았어요');
    },
    removeCompare: () => {
      const prev = compare.find((c) => c.ref.id === academy.id);
      removeCompare(academy.id);
      showToast('비교함에서 뺐어요', prev ? { label: '되돌리기', onClick: () => addCompare(prev) } : undefined);
    },
  };
}

export function AcademyCard({ hit, region, mode }: { hit: SearchHit; region: { sido: string; sigungu: string }; mode: DataMode }) {
  const { academy, rep, courses, level, diffFromMedian, market } = hit;
  const actions = useAcademyActions(academy, region);
  const tileSubject = rep?.subjectId ?? academy.subjects[0];

  return (
    <article className="card relative flex flex-col gap-3 p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3">
        {tileSubject ? (
          <SubjectTile subjectId={tileSubject} />
        ) : (
          <span aria-hidden="true" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-[13px] font-bold text-ink-3">
            {academy.kind === '교습소' ? '교습' : '학원'}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="pr-20 text-[16px] font-bold leading-snug">
            <Link to={academyPath(refOf(academy, region), rep ? courseKey(rep) : null)} className="after:absolute after:inset-0 after:rounded-card hover:text-accent">
              {academy.name}
            </Link>
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-3">
            <KindBadge kind={academy.kind} />
            <span className="inline-flex items-center gap-0.5">
              <MapPin aria-hidden="true" className="h-3 w-3" />
              {placeOf(academy)}
            </span>
            {academy.subjects.length > 0 && <SubjectChips subjectIds={academy.subjects.slice(0, 4)} />}
          </div>
        </div>
      </div>

      {rep ? (
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[12px] text-ink-3" title={rep.name}>
              {courses.length > 1 ? '대표 과정 · ' : ''}
              {rep.name}
              {rep.ages.length > 0 && ` · ${rep.ages.map((a) => AGE_LABELS[a]).join('·')}`}
            </p>
            <p className="num text-[20px] font-bold leading-tight tracking-tight">
              {manwon(rep.price)}
              <span className="ml-1 text-[12px] font-medium text-ink-3">/ 월 신고 교습비</span>
            </p>
            {courses.length > 1 && (
              <p className="num text-[12px] text-ink-3">
                맞는 과정 {courses.length}개 · {manwon(courses[0].price)} ~ {manwon(courses[courses.length - 1].price)}
              </p>
            )}
          </div>
          {level && diffFromMedian !== null && market && (
            <div className="flex flex-col items-start gap-0.5 sm:items-end">
              <PriceLevelBadge level={level} diff={diffFromMedian} />
              <span className="text-[11px] text-ink-3">
                {marketScopeName(market.row, mode)}{market.row.age ? ` ${AGE_LABELS[market.row.age]}` : ''} 중앙값 {manwon(market.row.median)}
              </span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-[13px] text-ink-3">
          {academy.courses.length === 0 ? '교육청 자료에 교습비가 공개되지 않았어요' : '비교할 수 있는 월 교습비가 없어요 (특강·1:1·재료비 등만 신고)'}
        </p>
      )}

      <div className="absolute right-1.5 top-1.5 z-10 flex">
        <button
          type="button"
          onClick={actions.onFavorite}
          aria-pressed={actions.fav}
          aria-label={actions.fav ? `${academy.name} 찜 해제` : `${academy.name} 찜하기`}
          className="rounded-xl p-2.5 text-ink-3 hover:bg-surface-2 active:bg-surface-2"
        >
          <Heart aria-hidden="true" className={`h-5 w-5 ${actions.fav ? 'fill-pricey text-pricey' : ''}`} />
        </button>
        <button
          type="button"
          onClick={() => (actions.comparing ? actions.removeCompare() : actions.onCompare(rep ? courseKey(rep) : null))}
          aria-pressed={actions.comparing}
          aria-label={actions.comparing ? `${academy.name} 비교함에서 빼기` : `${academy.name} 비교함에 담기`}
          className={`rounded-xl p-2.5 hover:bg-surface-2 active:bg-surface-2 ${actions.comparing ? 'text-accent' : 'text-ink-3'}`}
        >
          {actions.comparing ? <Check aria-hidden="true" className="h-5 w-5" /> : <Plus aria-hidden="true" className="h-5 w-5" />}
        </button>
      </div>
    </article>
  );
}
