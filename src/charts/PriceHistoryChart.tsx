import type { PriceHistoryEntry, PricePlan } from '../types';
import { useWidth } from './useWidth';

const SERIES = ['var(--series-1)', 'var(--series-2)'];

/** 요금제별 가격 변동 (연 단위 몇 개 지점이라 점+선으로 충분) */
export function PriceHistoryChart({ history, plans, format }: { history: PriceHistoryEntry[]; plans: PricePlan[]; format: (v: number) => string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const planIds = Array.from(new Set(history.map((h) => h.planId)));
  const dates = Array.from(new Set(history.map((h) => h.date))).sort();
  if (dates.length < 2) return null;
  const values = history.map((h) => h.price);
  const min = Math.min(...values) * 0.92;
  const max = Math.max(...values) * 1.04;
  const height = 150;
  const pad = { top: 18, right: 62, bottom: 24, left: 12 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const sx = (d: string) => pad.left + (dates.indexOf(d) / (dates.length - 1)) * innerW;
  const sy = (v: number) => pad.top + innerH - ((v - min) / (max - min)) * innerH;

  return (
    <div ref={ref} className="w-full">
      {planIds.length > 1 && (
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-2">
          {planIds.map((id, i) => (
            <li key={id} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block h-0.5 w-4 rounded" style={{ background: SERIES[i] }} />
              {plans.find((p) => p.id === id)?.name ?? id}
            </li>
          ))}
        </ul>
      )}
      <svg width={width} height={height} role="img" aria-label="가격 변동 추이">
        {[0, 0.5, 1].map((t) => (
          <line key={t} x1={pad.left} x2={width - pad.right} y1={pad.top + innerH * t} y2={pad.top + innerH * t} stroke="rgb(var(--line))" strokeWidth={1} />
        ))}
        {planIds.map((id, i) => {
          const pts = history.filter((h) => h.planId === id).sort((a, b) => a.date.localeCompare(b.date));
          const d = pts.map((p, j) => `${j === 0 ? 'M' : 'L'}${sx(p.date)},${sy(p.price)}`).join(' ');
          const last = pts[pts.length - 1];
          return (
            <g key={id}>
              <path d={d} fill="none" stroke={SERIES[i]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {pts.map((p) => (
                <circle key={p.date} cx={sx(p.date)} cy={sy(p.price)} r={4} fill={SERIES[i]} stroke="rgb(var(--surface))" strokeWidth={2}>
                  <title>{`${p.date} ${format(p.price)}`}</title>
                </circle>
              ))}
              <text x={sx(last.date) + 8} y={sy(last.price) + 4} fontSize={11} fontWeight={600} fill="rgb(var(--ink))" className="num">
                {format(last.price)}
              </text>
            </g>
          );
        })}
        {dates.map((d, i) => (
          <text key={d} x={sx(d)} y={height - 6} fontSize={11} fill="rgb(var(--ink-3))" textAnchor={i === 0 ? 'start' : 'middle'} className="num">
            {d.slice(0, 4)}년
          </text>
        ))}
      </svg>
    </div>
  );
}
