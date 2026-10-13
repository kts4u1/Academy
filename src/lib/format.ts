// 금액 표기: 한국 학원비는 "만원" 단위로 말하는 게 자연스럽다.

/** 185000 → "185,000원" */
export function won(value: number): string {
  return `${Math.round(value).toLocaleString('ko-KR')}원`;
}

/** 185000 → "18.5만원", 1200000 → "120만원", 8500 → "8,500원" */
export function manwon(value: number, digits = 1): string {
  const v = Math.round(value);
  if (Math.abs(v) < 10000) return won(v);
  const man = v / 10000;
  if (Math.abs(man) >= 100) return `${Math.round(man).toLocaleString('ko-KR')}만원`;
  return `${man.toFixed(digits).replace(/\.0+$/, '')}만원`;
}

/** 단가처럼 작은 금액: 백원 단위 반올림. 23333 → "23,300원" */
export function unitPrice(value: number): string {
  return won(Math.round(value / 100) * 100);
}

/** -0.123 → "-12%" , 0.05 → "+5%" */
export function signedPercent(ratio: number): string {
  const pct = Math.round(ratio * 100);
  if (pct === 0) return '±0%';
  return `${pct > 0 ? '+' : ''}${pct}%`;
}

/** 축 눈금용 짧은 표기: 150000 → "15만", 8000 → "8천" */
export function shortMan(value: number): string {
  if (value === 0) return '0';
  if (Math.abs(value) >= 10000) {
    const man = value / 10000;
    return `${Number.isInteger(man) ? man : man.toFixed(1)}만`;
  }
  if (Math.abs(value) >= 1000) return `${Math.round(value / 1000)}천`;
  return String(Math.round(value));
}

export function hoursLabel(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}시간`;
}

export function km(value: number): string {
  return value < 1 ? `${Math.round(value * 1000)}m` : `${value.toFixed(1)}km`;
}

/** ISO 시각 → 한국 시간 날짜 "2026.10.13" (자동 업데이트는 한국 시간 월요일 새벽, UTC 로는 일요일이다) */
export function kstDate(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return dotDate(iso.slice(0, 10));
  return dotDate(new Date(t + 9 * 60 * 60 * 1000).toISOString().slice(0, 10));
}

/** "2026-09-14" → "2026.09.14" */
export function dotDate(iso: string): string {
  return iso.replaceAll('-', '.');
}

/** 비교 기준에 맞는 표기: 단가는 원 단위, 나머지는 만원 단위 */
export function formatMetric(metric: string, value: number): string {
  return metric === 'pricePerHour' || metric === 'pricePerSession' ? unitPrice(value) : manwon(value);
}

/** 받침에 맞는 조사: withJosa('수학학원', '이', '가') → '수학학원이' */
export function withJosa(word: string, withBatchim: string, withoutBatchim: string): string {
  const last = word.trim().charCodeAt(word.trim().length - 1);
  if (last >= 0xac00 && last <= 0xd7a3) {
    return word + ((last - 0xac00) % 28 > 0 ? withBatchim : withoutBatchim);
  }
  return `${word}${withBatchim}(${withoutBatchim})`;
}
