import { describe, expect, it } from 'vitest';
import { histogram, niceStep, niceTicks, percentileRank, quantile, summarize } from './stats';

describe('stats', () => {
  it('quantile 선형 보간', () => {
    const s = [10, 20, 30, 40];
    expect(quantile(s, 0)).toBe(10);
    expect(quantile(s, 1)).toBe(40);
    expect(quantile(s, 0.5)).toBe(25);
  });

  it('summarize', () => {
    const st = summarize([30, 10, 20, 40, 50])!;
    expect(st).toMatchObject({ n: 5, min: 10, max: 50, median: 30, mean: 30, p25: 20, p75: 40 });
    expect(summarize([])).toBeNull();
  });

  it('percentileRank: 가장 싼 값은 0에 가깝고 비싼 값은 100에 가깝다', () => {
    const s = [10, 20, 30, 40];
    expect(percentileRank(s, 5)).toBe(0);
    expect(percentileRank(s, 45)).toBe(100);
    expect(percentileRank(s, 20)).toBe(37.5);
  });

  it('niceStep / niceTicks', () => {
    expect(niceStep(18000)).toBe(20000);
    expect(niceStep(23000)).toBe(25000);
    expect(niceTicks(430000, 4)).toEqual([0, 100000, 200000, 300000, 400000, 500000]);
    expect(niceTicks(150000, 4)).toEqual([0, 50000, 100000, 150000]);
  });

  it('histogram 은 모든 값을 정확히 한 번씩 센다', () => {
    const values = [110000, 125000, 130000, 150000, 180000, 240000];
    const bins = histogram(values, 6);
    expect(bins.reduce((s, b) => s + b.count, 0)).toBe(values.length);
    expect(bins[0].x0).toBeLessThanOrEqual(110000);
    expect(bins[bins.length - 1].x1).toBeGreaterThan(240000);
  });
});
