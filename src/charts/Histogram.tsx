import { useState } from 'react';
import { histogram } from '../lib/stats';
import { useWidth } from './useWidth';

interface Props {
  values: number[];
  marker?: { value: number; label: string } | null;
  median?: number;
  format: (v: number) => string;
  tickFormat: (v: number) => string;
  bins?: number;
  height?: number;
  unitLabel?: string;
}

/** 가격 분포 히스토그램. 막대 위에 마우스를 올리거나 포커스하면 구간과 곳 수를 보여준다. */
export function Histogram({ values, marker, median, format, tickFormat, bins = 14, height = 170, unitLabel = '곳' }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const data = histogram(values, bins);
  if (data.length === 0) return null;

  const pad = { top: 22, right: 8, bottom: 26, left: 8 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const x0 = data[0].x0;
  const x1 = data[data.length - 1].x1;
  const maxCount = Math.max(...data.map((b) => b.count));
  const sx = (v: number) => pad.left + ((v - x0) / (x1 - x0)) * innerW;
  const sy = (c: number) => pad.top + innerH - (c / maxCount) * innerH;
  const barW = innerW / data.length;
  const gap = 2;
  const tickEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(innerW / 70))));
  const hovered = hover !== null ? data[hover] : null;

  return (
    <div ref={ref} className="relative w-full">
      <div className="num mb-1 h-5 text-[12px] text-ink-2" aria-live="polite">
        {hovered ? (
          <>
            <b className="text-ink">{hovered.count}{unitLabel}</b> · {format(hovered.x0)} ~ {format(hovered.x1)}
          </>
        ) : (
          <span className="text-ink-3">막대를 누르면 구간별 곳 수를 볼 수 있어요</span>
        )}
      </div>
      <svg width={width} height={height} role="img" aria-label="가격 분포">
        <line x1={pad.left} x2={width - pad.right} y1={pad.top + innerH} y2={pad.top + innerH} stroke="rgb(var(--line))" strokeWidth={1} />
        {data.map((b, i) => {
          const h = pad.top + innerH - sy(b.count);
          const isMarkerBin = marker && marker.value >= b.x0 && marker.value < b.x1;
          const x = pad.left + i * barW + gap / 2;
          const w = Math.max(1, barW - gap);
          const r = Math.min(4, w / 2, h);
          return (
            <g key={b.x0}>
              {b.count > 0 && (
                <path
                  d={`M${x},${pad.top + innerH} V${sy(b.count) + r} Q${x},${sy(b.count)} ${x + r},${sy(b.count)} H${x + w - r} Q${x + w},${sy(b.count)} ${x + w},${sy(b.count) + r} V${pad.top + innerH} Z`}
                  fill={isMarkerBin ? 'rgb(var(--accent))' : 'rgb(var(--accent) / 0.32)'}
                  opacity={hover === null || hover === i ? 1 : 0.55}
                />
              )}
              <rect
                x={pad.left + i * barW}
                y={pad.top}
                width={barW}
                height={innerH}
                fill="transparent"
                tabIndex={0}
                aria-label={`${format(b.x0)}~${format(b.x1)} ${b.count}${unitLabel}`}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                onClick={() => setHover(i)}
                style={{ outline: 'none' }}
              />
            </g>
          );
        })}
        {median !== undefined && median >= x0 && median <= x1 && (
          <g pointerEvents="none">
            <line x1={sx(median)} x2={sx(median)} y1={pad.top - 4} y2={pad.top + innerH} stroke="rgb(var(--ink-3))" strokeWidth={1} strokeDasharray="0" />
            <text x={sx(median)} y={pad.top - 8} textAnchor={sx(median) > width - 60 ? 'end' : sx(median) < 60 ? 'start' : 'middle'} fontSize={11} fill="rgb(var(--ink-3))">
              중앙값
            </text>
          </g>
        )}
        {marker && marker.value >= x0 && marker.value <= x1 && (
          <g pointerEvents="none">
            <line x1={sx(marker.value)} x2={sx(marker.value)} y1={pad.top - 4} y2={pad.top + innerH} stroke="rgb(var(--ink))" strokeWidth={2} />
            <text
              x={sx(marker.value)}
              y={pad.top - 8}
              textAnchor={sx(marker.value) > width - 70 ? 'end' : sx(marker.value) < 70 ? 'start' : 'middle'}
              fontSize={11}
              fontWeight={700}
              fill="rgb(var(--ink))"
            >
              {marker.label}
            </text>
          </g>
        )}
        {data.map((b, i) =>
          i % tickEvery === 0 ? (
            <text key={`t${b.x0}`} x={pad.left + i * barW} y={height - 8} fontSize={11} fill="rgb(var(--ink-3))" textAnchor={i === 0 ? 'start' : 'middle'} className="num">
              {tickFormat(b.x0)}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}
