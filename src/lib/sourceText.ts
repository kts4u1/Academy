// 자료 출처(교육청 학원교습소정보 / 스포츠강좌이용권 / 전국체육시설)에 따라 화면에 쓰는 말.
// 체육시설 금액은 학원 교습비와 성격이 달라(바우처 가맹 시설이 등록한 강좌 결제금액) 같은 말로 부르지 않는다.

import type { Course, RealAcademy } from './realData';

type Source = RealAcademy['source'];

export function isSports(a: Pick<RealAcademy, 'source'>): boolean {
  return a.source === 'voucher' || a.source === 'facility';
}

export function sourceName(source: Source): string {
  return source === 'voucher' ? '국민체육진흥공단 스포츠강좌이용권' : source === 'facility' ? '국민체육진흥공단 전국체육시설 정보' : '교육청 학원교습소정보';
}

/** 짧은 출처 이름 (갱신일 옆 괄호 등) */
export function sourceShort(source: Source): string {
  return source ? '국민체육진흥공단' : '교육청';
}

/** 금액을 부르는 말: '신고 교습비' / '바우처 등록 금액' */
export function priceName(source: Source): string {
  return source ? '바우처 등록 금액' : '신고 교습비';
}

/** 큰 금액 옆에 붙는 말 */
export function priceUnit(source: Source): string {
  return source ? '/ 월 · 바우처 등록 금액' : '/ 월 신고 교습비';
}

/** 금액이 없을 때 카드에 쓰는 말 */
export function noPriceText(a: Pick<RealAcademy, 'source' | 'courses'>): string {
  if (a.source === 'facility') return '금액 정보가 없어요 · 시·군·구에 신고된 체육시설 목록';
  if (a.source === 'voucher') return '비교할 수 있는 월 수강료가 없어요 (체험·회차권·1:1 등만 등록)';
  return a.courses.length === 0 ? '교육청 자료에 교습비가 공개되지 않았어요' : '비교할 수 있는 월 교습비가 없어요 (특강·1:1·재료비 등만 신고)';
}

/** 바우처 한도와 같은 금액이라 시세 비교에서 뺐다는 설명 */
export const VOUCHER_CAP_NOTE = '바우처 월 지원 한도와 같은 금액이라 시세 비교에서 뺐어요';

export function courseNote(c: Pick<Course, 'voucherCap'>): string | null {
  return c.voucherCap ? VOUCHER_CAP_NOTE : null;
}

/** 체육 종목을 고르면 결과 위에 보여 주는 안내 */
export const SPORTS_SOURCE_NOTE =
  '체육시설은 교육청이 아니라 국민체육진흥공단 자료예요. 금액은 스포츠강좌이용권(저소득층 유·청소년 바우처) 가맹 시설이 등록한 강좌 결제금액이라 일반 회원가와 다를 수 있어요. 금액이 없는 곳은 시·군·구에 신고된 체육시설 목록이에요.';
