// 학원비교 도메인 모델
// 가격 비교의 핵심은 "서로 다른 요금 체계를 같은 단위로 환산"하는 것이다.
// 그래서 요금제(PricePlan)는 원래 청구 방식(월/패키지/회당)을 그대로 보관하고,
// 환산은 lib/pricing.ts 에서 일관되게 수행한다.

export type CategoryGroup = 'academic' | 'sports' | 'arts';

export type AgeGroup = 'preschool' | 'elementary' | 'middle' | 'high' | 'adult';

/** group: 일반 그룹반, small: 소수정예(대략 6명 이하), private: 1:1 개인 레슨 */
export type ClassType = 'group' | 'small' | 'private';

/**
 * monthly     : 월 수강료 (예: 주 2회 월 28만원)
 * package     : 기간권 또는 횟수권 (예: 3개월 39만원, 10회 55만원)
 * per_session : 회당 요금 (예: 개인 레슨 회당 6만원)
 */
export type Billing = 'monthly' | 'package' | 'per_session';

export interface PricePlan {
  id: string;
  subjectId: string;
  name: string;
  targets: AgeGroup[];
  classType: ClassType;
  maxStudents: number;
  billing: Billing;
  /** 청구 단위 가격(원). monthly=월, package=패키지 총액, per_session=1회 */
  price: number;
  /** 주당 수업 횟수. 자유 이용권(복싱 등)은 일반적인 이용 횟수로 기록 */
  sessionsPerWeek: number;
  /** 1회 수업 시간(분) */
  minutesPerSession: number;
  /** package: 기간권의 개월 수 */
  months?: number;
  /** package: 횟수권의 총 횟수 */
  totalSessions?: number;
  /** 자유 이용(오픈 체육관 등) 여부 – 표시용 */
  unlimited?: boolean;
}

export type FeeFrequency = 'once' | 'monthly' | 'quarterly' | 'yearly' | 'per_event';

export interface ExtraFee {
  id: string;
  name: string;
  amount: number;
  frequency: FeeFrequency;
  /** per_event 의 연간 발생 횟수 (예: 승급심사 연 4회) */
  timesPerYear?: number;
  /** false 이면 선택 비용(호구, 개인 장비, 대회 참가 등) */
  required: boolean;
  note?: string;
}

export type DiscountType = 'sibling' | 'prepay' | 'multi_subject' | 'first_month' | 'card';

export interface Discount {
  id: string;
  type: DiscountType;
  label: string;
  /** 수강료에 적용되는 할인율(%) */
  percent?: number;
  /** 월 정액 할인(원) */
  amount?: number;
  /** 선납 할인의 선납 개월 수 */
  months?: number;
}

export type PriceSource = 'education_office' | 'academy' | 'user_report';

export interface PriceHistoryEntry {
  date: string; // YYYY-MM
  planId: string;
  price: number;
}

export interface Review {
  id: string;
  author: string;
  rating: number;
  priceSatisfaction: number;
  date: string;
  text: string;
}

export interface Region {
  sido: string;
  sigungu: string;
  dong: string;
}

export interface Academy {
  id: string;
  name: string;
  group: CategoryGroup;
  /** 첫 번째가 주력 과목 */
  subjectIds: string[];
  region: Region;
  address: string;
  lat: number;
  lng: number;
  phone: string;
  description: string;
  targets: AgeGroup[];
  features: string[];
  shuttle: boolean;
  parking: boolean;
  trialClass: { available: boolean; price: number };
  /** 구립·시립 등 공공시설 */
  isPublic: boolean;
  plans: PricePlan[];
  extraFees: ExtraFee[];
  discounts: Discount[];
  rating: number;
  reviewCount: number;
  priceSatisfaction: number;
  reviews: Review[];
  priceSource: PriceSource;
  priceUpdatedAt: string; // YYYY-MM-DD
  priceHistory: PriceHistoryEntry[];
  teacherCount: number;
  establishedYear: number;
  hours: string;
}

/** 사용자가 제보한 가격 (로컬 저장) */
export interface PriceReport {
  id: string;
  academyId: string;
  planName: string;
  price: number;
  billing: Billing;
  sessionsPerWeek: number;
  minutesPerSession: number;
  months?: number;
  totalSessions?: number;
  memo?: string;
  createdAt: string;
}
