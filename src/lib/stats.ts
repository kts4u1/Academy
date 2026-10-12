export interface Stats {
  n: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  p25: number;
  p75: number;
}

/** 정렬된 배열의 분위수 (선형 보간) */
export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * Math.min(1, Math.max(0, q));
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function summarize(values: number[]): Stats | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((s, v) => s + v, 0);
  return {
    n: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: sum / sorted.length,
    median: quantile(sorted, 0.5),
    p25: quantile(sorted, 0.25),
    p75: quantile(sorted, 0.75),
  };
}

/** sorted 안에서 value 보다 작은 값의 비율 (동일 값은 절반으로 계산). 0~100 */
export function percentileRank(sorted: number[], value: number): number {
  if (sorted.length === 0) return 50;
  let below = 0;
  let equal = 0;
  for (const v of sorted) {
    if (v < value) below++;
    else if (v === value) equal++;
  }
  return ((below + equal / 2) / sorted.length) * 100;
}

export interface Bin {
  x0: number;
  x1: number;
  count: number;
}

/** 보기 좋은 경계(niceStep)로 나눈 히스토그램 */
export function histogram(values: number[], targetBins = 12): Bin[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = niceStep((max - min) / targetBins || Math.max(1, max * 0.1));
  const start = Math.floor(min / step) * step;
  const end = Math.max(start + step, Math.ceil((max + 1e-9) / step) * step);
  const bins: Bin[] = [];
  for (let x = start; x < end - 1e-9; x += step) bins.push({ x0: x, x1: x + step, count: 0 });
  for (const v of values) {
    const i = Math.min(bins.length - 1, Math.floor((v - start) / step));
    bins[i].count++;
  }
  return bins;
}

/** 1, 2, 2.5, 5 × 10^n 중 raw 이상인 가장 작은 값 */
export function niceStep(raw: number): number {
  if (raw <= 0 || !Number.isFinite(raw)) return 1;
  const exp = Math.floor(Math.log10(raw));
  const base = 10 ** exp;
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * base >= raw) return m * base;
  }
  return 10 * base;
}

/** 0부터 max 를 덮는 깔끔한 눈금 */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const step = niceStep(max / (count + 1));
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}
