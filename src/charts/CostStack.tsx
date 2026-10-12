import { useState } from 'react';

export interface StackRow {
  key: string;
  label: string;
  segments: number[];
  best?: boolean;
}

const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)'];

/** 비용 구성 누적 막대 (수강료 / 매월 부대비용 / 정기 비용 / 초기 비용) */
export function CostStack({ rows, segmentLabels, format }: { rows: StackRow[]; segmentLabels: string[]; format: (v: number) => string }) {
  const [hover, setHover] = useState<{ row: number; seg: number } | null>(null);
  const totals = rows.map((r) => r.segments.reduce((s, v) => s + v, 0));
  const max = Math.max(...totals, 1);
  const hovered = hover ? { row: rows[hover.row], seg: hover.seg } : null;

  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-2" aria-label="범례">
        {segmentLabels.map((label, i) => (
          <li key={label} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: SERIES[i] }} />
            {label}
          </li>
        ))}
      </ul>
      <div className="num mb-2 h-5 text-[12px] text-ink-2" aria-live="polite">
        {hovered ? (
          <>
            {hovered.row.label} · {segmentLabels[hovered.seg]} <b className="text-ink">{format(hovered.row.segments[hovered.seg])}</b>
          </>
        ) : (
          <span className="text-ink-3">막대를 누르면 항목별 금액을 볼 수 있어요</span>
        )}
      </div>
      <ul className="flex flex-col gap-3">
        {rows.map((row, ri) => (
          <li key={row.key}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
              <span className="min-w-0 truncate font-medium">
                {row.label}
                {row.best && <span className="price-tag ml-1.5 align-middle">최저</span>}
              </span>
              <span className="num shrink-0 font-bold">{format(totals[ri])}</span>
            </div>
            <div className="flex h-5 gap-[2px]" style={{ width: `${Math.max(4, (totals[ri] / max) * 100)}%` }}>
              {row.segments.map((v, si) =>
                v > 0 ? (
                  <button
                    key={si}
                    type="button"
                    aria-label={`${row.label} ${segmentLabels[si]} ${format(v)}`}
                    onPointerEnter={() => setHover({ row: ri, seg: si })}
                    onPointerLeave={() => setHover(null)}
                    onFocus={() => setHover({ row: ri, seg: si })}
                    onBlur={() => setHover(null)}
                    onClick={() => setHover({ row: ri, seg: si })}
                    className="h-full first:rounded-l last:rounded-r"
                    style={{
                      flexGrow: v,
                      flexBasis: 0,
                      minWidth: 3,
                      background: SERIES[si],
                      opacity: hover && (hover.row !== ri || hover.seg !== si) ? 0.55 : 1,
                    }}
                  />
                ) : null,
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
