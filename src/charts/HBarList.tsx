import type { ReactNode } from 'react';

export interface HBarItem {
  key: string;
  label: ReactNode;
  value: number;
  sub?: string;
  highlight?: boolean;
  onClick?: () => void;
}

/** 가로 막대 목록 (구별 시세 등). 값은 막대 끝에 직접 표시한다. */
export function HBarList({ items, format, max }: { items: HBarItem[]; format: (v: number) => string; max?: number }) {
  const top = max ?? Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item) => {
        const pct = Math.max(2, (item.value / top) * 100);
        const Row = item.onClick ? 'button' : 'div';
        return (
          <li key={item.key}>
            <Row
              type={item.onClick ? 'button' : undefined}
              onClick={item.onClick}
              className={`grid w-full grid-cols-[5.5rem_1fr] items-center gap-2 rounded-lg px-1 py-1 text-left ${item.onClick ? 'hover:bg-surface-2' : ''}`}
            >
              <span className={`truncate text-[13px] ${item.highlight ? 'font-bold text-ink' : 'text-ink-2'}`}>{item.label}</span>
              <span className="flex min-w-0 items-center gap-2">
                <span className="relative h-4 flex-1">
                  <span
                    className={`absolute inset-y-0 left-0 rounded-r ${item.highlight ? 'bg-accent' : 'bg-accent/30'}`}
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="num w-[5.5rem] shrink-0 text-right text-[12px]">
                  <b className="font-semibold text-ink">{format(item.value)}</b>
                  {item.sub && <span className="block text-[10px] leading-tight text-ink-3">{item.sub}</span>}
                </span>
              </span>
            </Row>
          </li>
        );
      })}
    </ul>
  );
}
