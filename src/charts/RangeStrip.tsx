import type { Stats } from '../lib/stats';

interface Props {
  stats: Stats;
  value?: number;
  valueLabel?: string;
  format: (v: number) => string;
}

/** 시세 범위 막대: 최저–(하위25%~상위25%)–최고, 중앙값 눈금, 현재 값 마커 */
export function RangeStrip({ stats, value, valueLabel = '이 학원', format }: Props) {
  const span = stats.max - stats.min || 1;
  const pos = (v: number) => `${Math.min(100, Math.max(0, ((v - stats.min) / span) * 100))}%`;
  const valuePos = value !== undefined ? Math.min(100, Math.max(0, ((value - stats.min) / span) * 100)) : null;
  // 마커 라벨이 양 끝에서 잘리지 않도록 정렬 기준을 바꾼다
  const labelAlign = valuePos === null ? '' : valuePos < 18 ? 'left-0' : valuePos > 82 ? 'right-0' : '-translate-x-1/2';

  return (
    <div className="w-full">
      {valuePos !== null && value !== undefined && (
        <div className="relative mb-1 h-5">
          <div
            className={`absolute top-0 whitespace-nowrap text-[12px] font-bold text-ink ${labelAlign}`}
            style={valuePos >= 18 && valuePos <= 82 ? { left: `${valuePos}%` } : undefined}
          >
            {valueLabel} {format(value)}
          </div>
        </div>
      )}
      <div className="relative h-3">
        <div className="absolute inset-y-1 left-0 right-0 rounded-full bg-surface-2" />
        <div className="absolute inset-y-0.5 rounded-full bg-accent/25" style={{ left: pos(stats.p25), width: `calc(${pos(stats.p75)} - ${pos(stats.p25)})` }} />
        <div className="absolute -inset-y-0.5 w-0.5 -translate-x-1/2 rounded bg-ink-3" style={{ left: pos(stats.median) }} />
        {valuePos !== null && (
          <div
            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent shadow"
            style={{ left: `${valuePos}%` }}
            aria-hidden="true"
          />
        )}
      </div>
      <div className="num mt-2 flex justify-between gap-2 text-[11px] text-ink-3">
        <span>
          최저 <b className="font-semibold text-ink-2">{format(stats.min)}</b>
        </span>
        <span>
          중앙값 <b className="font-semibold text-ink-2">{format(stats.median)}</b>
        </span>
        <span>
          최고 <b className="font-semibold text-ink-2">{format(stats.max)}</b>
        </span>
      </div>
    </div>
  );
}
