import { describe, expect, it } from 'vitest';
import { formatMetric, manwon, shortMan, signedPercent, unitPrice, withJosa, won } from './format';

describe('format', () => {
  it('만원 단위', () => {
    expect(manwon(185000)).toBe('18.5만원');
    expect(manwon(1200000)).toBe('120만원');
    expect(manwon(10060000)).toBe('1,006만원');
    expect(manwon(8500)).toBe('8,500원');
    expect(manwon(-52000)).toBe('-5.2만원');
  });

  it('단가와 비율', () => {
    expect(unitPrice(23333)).toBe('23,300원');
    expect(won(1520000)).toBe('1,520,000원');
    expect(signedPercent(-0.123)).toBe('-12%');
    expect(signedPercent(0.05)).toBe('+5%');
    expect(signedPercent(0.001)).toBe('±0%');
    expect(shortMan(150000)).toBe('15만');
    expect(formatMetric('pricePerHour', 18120)).toBe('18,100원');
    expect(formatMetric('monthlyTuition', 280000)).toBe('28만원');
  });

  it('조사', () => {
    expect(withJosa('수학학원', '이', '가')).toBe('수학학원이');
    expect(withJosa('아쿠아스쿨', '이', '가')).toBe('아쿠아스쿨이');
    expect(withJosa('한빛 FC', '이', '가')).toBe('한빛 FC이(가)');
    expect(withJosa('강남구', '과', '와')).toBe('강남구와');
  });
});
