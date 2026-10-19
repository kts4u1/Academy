import { ChevronDown, LayoutGrid } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { GROUPS, SUBJECT_MAP, subjectsOf } from '../data/categories';
import { useManifest } from '../hooks';
import type { CategoryGroup } from '../types';
import { SubjectIcon } from './SubjectIcon';
import { Sheet, SubjectTile } from './ui';

const ICON_COLOR: Record<CategoryGroup, string> = { academic: 'text-academic', sports: 'text-sports', arts: 'text-arts' };

function Chip({ id, pressed, onClick }: { id: string | null; pressed: boolean; onClick: () => void }) {
  const s = id ? SUBJECT_MAP[id] : null;
  return (
    <button type="button" className="chip shrink-0" aria-pressed={pressed} onClick={onClick}>
      {s && <SubjectIcon subjectId={s.id} className={`h-4 w-4 ${pressed ? '' : ICON_COLOR[s.group]}`} />}
      {s ? s.name : '전체 과목'}
    </button>
  );
}

/**
 * 검색 화면의 과목 고르기.
 * 넓은 화면: 교과·예술 과목을 줄바꿈해서 모두 보여 준다.
 * 휴대폰: 한 줄로 밀어서 보고, '전체 과목' 버튼으로 모든 과목을 아이콘 격자로 연다.
 */
export function SubjectPicker({ value, onChange }: { value: string; onChange: (subject: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const { manifest } = useManifest();
  const groups = GROUPS.filter((g) => g.id !== 'sports');
  const rowRef = useRef<HTMLDivElement>(null);
  // 양쪽 끝에 더 있으면 흐리게 표시한다
  const [edges, setEdges] = useState({ start: false, end: true });
  const updateEdges = () => {
    const row = rowRef.current;
    if (!row) return;
    const start = row.scrollLeft > 4;
    const end = row.scrollLeft + row.clientWidth < row.scrollWidth - 4;
    setEdges((e) => (e.start === start && e.end === end ? e : { start, end }));
  };
  // 고른 과목이 한 줄 목록 밖에 있으면 보이게 옮긴다 (홈에서 '연기'를 눌러 들어온 경우 등)
  useEffect(() => {
    const row = rowRef.current;
    const chip = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!row || !chip) return;
    row.scrollTo?.({ left: Math.max(0, chip.offsetLeft - row.clientWidth / 2 + chip.clientWidth / 2), behavior: 'smooth' });
  }, [value]);
  const current = value ? SUBJECT_MAP[value] : null;

  return (
    <div>
      {/* 넓은 화면 */}
      <div className="hidden flex-col gap-2 md:flex" role="group" aria-label="과목">
        <div className="flex flex-wrap gap-1.5">
          <Chip id={null} pressed={!value} onClick={() => onChange(null)} />
        </div>
        {groups.map((g) => (
          <div key={g.id} className="flex items-start gap-2">
            <span className="mt-1.5 w-9 shrink-0 text-[12px] font-semibold text-ink-3">{g.name}</span>
            <div className="flex min-w-0 flex-wrap gap-1.5">
              {subjectsOf(g.id).map((s) => (
                <Chip key={s.id} id={s.id} pressed={value === s.id} onClick={() => onChange(s.id)} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 휴대폰 */}
      <div className="md:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-ink px-3.5 text-[13px] font-semibold text-bg"
            aria-haspopup="dialog"
          >
            <LayoutGrid aria-hidden="true" className="h-4 w-4" />
            {current ? current.name : '전체 과목'}
            <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
          <div className="relative min-w-0 flex-1">
            <div ref={rowRef} onScroll={updateEdges} className="scroll-x relative mx-0 px-0 pr-6" role="group" aria-label="과목 빠르게 고르기">
              {groups.flatMap((g) => subjectsOf(g.id)).map((s) => (
                <Chip key={s.id} id={s.id} pressed={value === s.id} onClick={() => onChange(value === s.id ? null : s.id)} />
              ))}
            </div>
            {/* 더 있다는 표시 */}
            {edges.start && <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-bg to-transparent" />}
            {edges.end && <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-bg to-transparent" />}
          </div>
        </div>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="과목 고르기">
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setOpen(false);
          }}
          className={`mb-4 w-full rounded-xl border px-4 py-3 text-left text-[15px] font-semibold ${!value ? 'border-accent bg-accent-soft text-accent' : 'border-line'}`}
        >
          전체 과목
        </button>
        {[...GROUPS].sort((a, b) => Number(a.id === 'sports') - Number(b.id === 'sports')).map((g) => (
          <section key={g.id} className="mb-5">
            <h3 className="mb-2 flex items-center gap-2 text-[13px] font-bold text-ink-2">
              {g.name}
              {g.id === 'sports' && (
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-3">{manifest?.sports ? '바우처 등록 금액' : '자료 준비 중'}</span>
              )}
            </h3>
            <ul className="grid grid-cols-4 gap-x-1 gap-y-3">
              {subjectsOf(g.id).map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(s.id);
                      setOpen(false);
                    }}
                    aria-pressed={value === s.id}
                    className={`flex w-full flex-col items-center gap-1.5 rounded-2xl py-2 ${value === s.id ? 'bg-accent-soft' : 'active:bg-surface-2'}`}
                  >
                    <SubjectTile subjectId={s.id} size="lg" />
                    <span className={`text-center text-[12px] leading-tight ${value === s.id ? 'font-bold text-accent' : 'font-medium text-ink-2'}`}>{s.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </Sheet>
    </div>
  );
}
