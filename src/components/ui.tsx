import { ChevronLeft, X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { SUBJECT_MAP } from '../data/categories';
import { PRICE_LEVEL_META, type PriceLevel } from '../lib/realData';
import { signedPercent } from '../lib/format';
import type { CategoryGroup } from '../types';

const GROUP_TILE: Record<CategoryGroup, string> = {
  academic: 'bg-academic-soft text-academic',
  sports: 'bg-sports-soft text-sports',
  arts: 'bg-arts-soft text-arts',
};

export function SubjectTile({ subjectId, size = 'md' }: { subjectId: string; size?: 'sm' | 'md' | 'lg' }) {
  const subject = SUBJECT_MAP[subjectId];
  if (!subject) return null;
  const sizes = { sm: 'h-8 w-8 text-[12px] rounded-lg', md: 'h-11 w-11 text-[15px] rounded-xl', lg: 'h-14 w-14 text-lg rounded-2xl' };
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center font-bold tracking-tight ${sizes[size]} ${GROUP_TILE[subject.group]}`}
    >
      {subject.short}
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

export function PageHeader({ title, subtitle, back = false, action }: { title: string; subtitle?: string; back?: boolean; action?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="flex items-start gap-2 pb-4 pt-2">
      {back && (
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="-ml-2 mt-0.5 rounded-lg p-1.5 text-ink-2 hover:bg-surface-2"
          aria-label="뒤로"
        >
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

export function BackButton() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(-1)} className="-ml-2 rounded-lg p-1.5 text-ink-2 hover:bg-surface-2" aria-label="뒤로">
      <ChevronLeft className="h-5 w-5" />
    </button>
  );
}

export function Section({ title, desc, action, children, className = '' }: { title: string; desc?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`mt-7 ${className}`}>
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
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="닫기" className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="relative flex max-h-[88vh] w-full max-w-lg flex-col rounded-t-2xl bg-surface shadow-xl md:rounded-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-base font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-ink-2 hover:bg-surface-2" aria-label="닫기">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-line px-5 py-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>{footer}</div>}
      </div>
    </div>
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
        <span className="h-6 w-10 rounded-full bg-line transition-colors peer-checked:bg-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-transform peer-checked:translate-x-4" />
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
            className={`whitespace-nowrap rounded-[10px] px-3 py-1.5 text-[13px] font-semibold transition-colors ${
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
