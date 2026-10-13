import { ChevronLeft, X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { SUBJECT_MAP } from '../data/categories';
import { SubjectIcon } from './SubjectIcon';
import { PRICE_LEVEL_META, type PriceLevel } from '../lib/realData';
import { signedPercent } from '../lib/format';
import type { CategoryGroup } from '../types';

const GROUP_TILE: Record<CategoryGroup, string> = {
  academic: 'bg-academic-soft text-academic',
  sports: 'bg-sports-soft text-sports',
  arts: 'bg-arts-soft text-arts',
};

/** 과목 아이콘 타일. muted: 교육청 자료가 없는 과목(체육)처럼 흐리게 */
export function SubjectTile({ subjectId, size = 'md', muted = false }: { subjectId: string; size?: 'sm' | 'md' | 'lg' | 'xl'; muted?: boolean }) {
  const subject = SUBJECT_MAP[subjectId];
  if (!subject) return null;
  const sizes = {
    sm: ['h-8 w-8 rounded-[10px]', 'h-4 w-4'],
    md: ['h-11 w-11 rounded-xl', 'h-[22px] w-[22px]'],
    lg: ['h-14 w-14 rounded-2xl', 'h-7 w-7'],
    xl: ['h-[60px] w-[60px] rounded-[20px]', 'h-[30px] w-[30px]'],
  } as const;
  const [box, icon] = sizes[size];
  return (
    <span aria-hidden="true" className={`subject-tile subject-tile--${subject.group} ${muted ? 'subject-tile--muted' : ''} ${box}`}>
      <SubjectIcon subjectId={subjectId} className={icon} strokeWidth={size === 'sm' ? 2.2 : 2} />
    </span>
  );
}

export function GroupDot({ group }: { group: CategoryGroup }) {
  const color = { academic: 'bg-academic', sports: 'bg-sports', arts: 'bg-arts' }[group];
  return <span aria-hidden="true" className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

export function SubjectChips({ subjectIds }: { subjectIds: string[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {subjectIds.map((id) => {
        const s = SUBJECT_MAP[id];
        if (!s) return null;
        return (
          <span key={id} className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${GROUP_TILE[s.group]}`}>
            {s.name}
          </span>
        );
      })}
    </span>
  );
}

export function PriceLevelBadge({ level, diff, compact = false }: { level: PriceLevel; diff?: number; compact?: boolean }) {
  const meta = PRICE_LEVEL_META[level];
  const tone =
    meta.tone === 'cheap' ? 'bg-cheap-soft text-cheap' : meta.tone === 'pricey' ? 'bg-pricey-soft text-pricey' : 'bg-surface-2 text-ink-2';
  const arrow = meta.tone === 'cheap' ? '▼' : meta.tone === 'pricey' ? '▲' : '●';
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-bold ${tone}`}>
      <span aria-hidden="true" className="text-[8px]">
        {arrow}
      </span>
      {compact || diff === undefined ? meta.label : `시세 ${signedPercent(diff)} · ${meta.label}`}
    </span>
  );
}

/** 학원 · 교습소 구분 */
export function KindBadge({ kind }: { kind: string }) {
  if (!kind) return null;
  return <span className="inline-flex items-center rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold text-ink-2">{kind}</span>;
}

/** 뒤로 가기. 링크로 바로 열어 앞 화면이 없으면(홈 화면 앱에는 브라우저 뒤로 버튼이 없다) fallback 으로 */
function useGoBack(fallback = '/') {
  const navigate = useNavigate();
  return () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  };
}

export function PageHeader({ title, subtitle, back = false, action }: { title: string; subtitle?: string; back?: boolean; action?: ReactNode }) {
  const goBack = useGoBack();
  return (
    <div className="flex items-start gap-2 pb-4 pt-2">
      {back && (
        <button type="button" onClick={goBack} className="-ml-2 mt-0.5 rounded-lg p-2 text-ink-2 hover:bg-surface-2" aria-label="뒤로">
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-[22px] font-bold leading-tight tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function BackButton({ fallback = '/' }: { fallback?: string }) {
  const goBack = useGoBack(fallback);
  return (
    <button type="button" onClick={goBack} className="-ml-2 rounded-lg p-2 text-ink-2 hover:bg-surface-2" aria-label="뒤로">
      <ChevronLeft className="h-5 w-5" />
    </button>
  );
}

export function Section({ title, desc, action, children, className = '', id }: { title: string; desc?: string; action?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`mt-7 scroll-mt-20 ${className}`}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[17px] font-bold tracking-tight">{title}</h2>
          {desc && <p className="mt-0.5 text-[13px] text-ink-3">{desc}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * 아래에서 올라오는 시트 (넓은 화면은 가운데 창).
 * body 로 portal 해서, backdrop-filter 가 있는 머리글 안에서 열어도 화면 전체를 덮는다.
 */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  const safeBottom = 'env(safe-area-inset-bottom, 0px)';
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="닫기" className="sheet-scrim absolute inset-0" onClick={onClose} />
      <div className="relative flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-2xl bg-surface shadow-xl md:rounded-2xl">
        <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 rounded-full bg-line md:hidden" />
        <div className="flex items-center justify-between border-b border-line py-1.5 pl-5 pr-2">
          <h2 className="text-base font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2.5 text-ink-2 hover:bg-surface-2" aria-label="닫기">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pt-4" style={{ paddingBottom: footer ? '1rem' : `calc(1rem + ${safeBottom})` }}>
          {children}
        </div>
        {footer && <div className="border-t border-line px-5 py-3" style={{ paddingBottom: `calc(0.75rem + ${safeBottom})` }}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ChipToggle({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick} className="chip">
      {children}
    </button>
  );
}

export function EmptyState({ title, desc, action }: { title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-10 text-center">
      <p className="text-base font-semibold">{title}</p>
      {desc && <p className="max-w-sm text-sm text-ink-2">{desc}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Toggle({ id, checked, onChange, label, desc }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-3 py-2">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {desc && <span className="block text-[12px] text-ink-3">{desc}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input id={id} type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-6 w-10 rounded-full bg-ink-3/40 transition-colors peer-checked:bg-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
      </span>
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange, ariaLabel }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; ariaLabel: string }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="scroll-x mx-0 px-0">
      <div className="inline-flex rounded-xl border border-line bg-surface-2 p-0.5">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            onClick={() => onChange(o.id)}
            className={`min-h-[38px] whitespace-nowrap rounded-[10px] px-3 py-1.5 text-[13px] font-semibold transition-colors ${
              value === o.id ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink-2'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
