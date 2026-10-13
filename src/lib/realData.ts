// 교육청(NEIS) 학원교습소정보 → 앱 데이터
// 매주 자동 업데이트 스크립트(scripts/update-data.ts)와 브라우저의 '내 인증키로 바로 받기'가 같은 규칙을 쓴다.

import { resolveNeisDistrict } from '../data/regions';
import type { AgeGroup } from '../types';
import type { NeisAcademy } from './neis';
import { academySubject, classifyCourse } from './neisClassify';
import { percentileRank, quantile } from './stats';

export interface Course {
  name: string;
  /** 교육청에 신고된 1인 교습비 (대부분 월 단위) */
  price: number;
  subjectId: string | null;
  ages: AgeGroup[];
  /** 과정 이름에 '주2회'처럼 적혀 있으면 */
  sessionsPerWeek?: number;
  /** 비교에서 뺀 이유 (특강·재료비·비정상 금액 등) */
  excluded?: string;
  /** 1:1·개인 레슨 */
  private?: boolean;
}

export interface RealAcademy {
  /** 교육청코드-학원지정번호 */
  id: string;
  name: string;
  /** 학원 · 교습소 */
  kind: string;
  sido: string;
  /** 앱의 시·군·구. 구를 정하지 못했으면 bucket 이름(예: '성남시') */
  sigungu: string;
  /** 구를 정하지 못한 학원 */
  unassigned?: boolean;
  /** 주소 괄호 속 법정동 */
  dong: string;
  address: string;
  phone: string;
  /** 교육청 분야 (입시·검정 및 보습, 예능 등) */
  realm: string;
  /** 교육청 교습과정 분류 (보습, 음악, 미술 …) */
  category: string;
  capacity: number | null;
  established: string;
  /** 교육청 자료 갱신일 */
  loadedAt: string;
  courses: Course[];
  /** 과정·학원 이름으로 알아낸 과목들 */
  subjects: string[];
}

const PRIVATE_RE = /1\s*(:|대)\s*1|개인|과외|프라이빗|private/i;

function dongOf(address: string): string {
  const inParens = address.match(/\(([^),]+?(?:동|읍|면|가|리))[,)]/);
  return inParens ? inParens[1].replace(/\d+(?=동$)/, '') : '';
}

export function toRealAcademy(row: NeisAcademy, sido: string): RealAcademy {
  const res = resolveNeisDistrict(sido, row);
  const seen = new Set<string>();
  const courses: Course[] = [];
  for (const t of row.tuitions) {
    // 같은 과정·금액이 두 번 적힌 경우가 있어 한 번만 쓴다
    const key = `${t.course}|${t.price}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const c = classifyCourse(t.course, t.price, {
      academyName: row.name,
      realm: row.realm,
      courseCategory: row.courseCategory,
      courseList: row.courseList,
    });
    courses.push({
      name: t.course,
      price: t.price,
      subjectId: c.subjectId,
      ages: c.ages,
      ...(c.sessionsPerWeek ? { sessionsPerWeek: c.sessionsPerWeek } : {}),
      ...(c.excluded ? { excluded: c.excluded } : {}),
      ...(PRIVATE_RE.test(t.course) ? { private: true } : {}),
    });
  }
  let subjects = Array.from(new Set(courses.filter((c) => c.subjectId && !c.excluded).map((c) => c.subjectId!)));
  if (subjects.length === 0) {
    // 교습비가 비어 있는 학원도 과목으로 찾을 수 있게 학원 이름·교육청 분류로 짐작한다
    const guess = academySubject({ academyName: row.name, realm: row.realm, courseCategory: row.courseCategory, courseList: row.courseList });
    if (guess) subjects = [guess];
  }
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    sido,
    sigungu: 'sigungu' in res ? res.sigungu : res.bucket,
    ...('bucket' in res ? { unassigned: true } : {}),
    dong: dongOf(row.address),
    address: row.address,
    phone: row.phone,
    realm: row.realm,
    category: row.courseCategory,
    capacity: row.capacity,
    established: row.establishedAt,
    loadedAt: row.loadedAt,
    courses,
    subjects,
  };
}

/** 시세 비교에 쓸 수 있는 과정: 과목을 알고, 월 교습비로 보이며, 1:1 이 아닌 것 */
export function isComparableCourse(c: Course): boolean {
  return c.subjectId !== null && !c.excluded && !c.private;
}

export function courseMatches(c: Course, subjectId?: string | null, age?: AgeGroup | null): boolean {
  if (!isComparableCourse(c)) return false;
  if (subjectId && c.subjectId !== subjectId) return false;
  if (age && !c.ages.includes(age)) return false;
  return true;
}

/** 주당 횟수를 알면 회당 교습비 (한 달 4주 기준) */
export function pricePerSession(c: Course): number | null {
  return c.sessionsPerWeek ? c.price / (c.sessionsPerWeek * 4) : null;
}

// ───────────── 시세 ─────────────

export interface MarketRow {
  sido: string;
  /** '' = 시·도 전체 */
  sigungu: string;
  subjectId: string;
  /** null = 대상 연령 전체 */
  age: AgeGroup | null;
  /** 과정 수 */
  n: number;
  /** 학원·교습소 수 (분위수는 학원마다 한 표씩 계산한다) */
  academies: number;
  min: number;
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  max: number;
}

/** 시세를 내려면 서로 다른 학원·교습소가 이만큼은 있어야 한다 */
export const MIN_MARKET_N = 3;
const AGES: AgeGroup[] = ['preschool', 'elementary', 'middle', 'high', 'adult'];

function median(values: number[]): number {
  return quantile([...values].sort((a, b) => a - b), 0.5);
}

/**
 * 학원 한 곳의 대표 금액: 조건에 맞는 과정 금액의 중앙값.
 * 과정을 수십 개 신고한 학원 한 곳이 시세를 좌우하지 않도록 학원마다 한 표씩만 센다.
 */
function perAcademy(items: { price: number; academyId: string }[]): number[] {
  const byAcademy = new Map<string, number[]>();
  for (const i of items) byAcademy.set(i.academyId, [...(byAcademy.get(i.academyId) ?? []), i.price]);
  return Array.from(byAcademy.values(), median);
}

function statsRow(sido: string, sigungu: string, subjectId: string, age: AgeGroup | null, items: { price: number; academyId: string }[]): MarketRow | null {
  const points = perAcademy(items).sort((a, b) => a - b);
  if (points.length < MIN_MARKET_N) return null;
  const q = (p: number) => Math.round(quantile(points, p));
  return {
    sido,
    sigungu,
    subjectId,
    age,
    n: items.length,
    academies: points.length,
    min: Math.round(points[0]),
    p10: q(0.1),
    p25: q(0.25),
    median: q(0.5),
    p75: q(0.75),
    p90: q(0.9),
    max: Math.round(points[points.length - 1]),
  };
}

/** 학원 목록 → 시·군·구별, 시·도 전체 과목·연령별 시세. 구를 정하지 못한 학원은 시·도 전체에만 넣는다. */
export function buildMarket(academies: RealAcademy[]): MarketRow[] {
  const groups = new Map<string, { sido: string; sigungu: string; subjectId: string; age: AgeGroup | null; items: { price: number; academyId: string }[] }>();
  const add = (sido: string, sigungu: string, subjectId: string, age: AgeGroup | null, price: number, academyId: string) => {
    const key = `${sido}|${sigungu}|${subjectId}|${age ?? ''}`;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { sido, sigungu, subjectId, age, items: [] }));
    g.items.push({ price, academyId });
  };
  for (const a of academies) {
    for (const c of a.courses) {
      if (!isComparableCourse(c)) continue;
      const scopes = a.unassigned ? [''] : [a.sigungu, ''];
      for (const sg of scopes) {
        add(a.sido, sg, c.subjectId!, null, c.price, a.id);
        for (const age of c.ages) add(a.sido, sg, c.subjectId!, age, c.price, a.id);
      }
    }
  }
  const rows: MarketRow[] = [];
  for (const g of groups.values()) {
    const row = statsRow(g.sido, g.sigungu, g.subjectId, g.age, g.items);
    if (row) rows.push(row);
  }
  const ageOrder = (a: AgeGroup | null) => (a === null ? -1 : AGES.indexOf(a));
  return rows.sort((x, y) => x.sido.localeCompare(y.sido) || x.sigungu.localeCompare(y.sigungu) || x.subjectId.localeCompare(y.subjectId) || ageOrder(x.age) - ageOrder(y.age));
}

export function findMarket(rows: MarketRow[], sido: string, sigungu: string, subjectId: string, age: AgeGroup | null): MarketRow | undefined {
  return rows.find((r) => r.sido === sido && r.sigungu === sigungu && r.subjectId === subjectId && r.age === age);
}

/** 구 시세가 없으면(표본 부족) 시·도 전체로 넓힌다 */
export function marketFor(rows: MarketRow[], sido: string, sigungu: string, subjectId: string, age: AgeGroup | null): MarketRow | undefined {
  return findMarket(rows, sido, sigungu, subjectId, age) ?? findMarket(rows, sido, '', subjectId, age);
}

/**
 * 분위수만 있을 때 어떤 금액이 몇 % 위치인지 (0=가장 저렴). 원자료가 있으면 percentileRank 를 쓴다.
 * 최저·10·25·50·75·90%·최고 사이를 직선으로 잇는다.
 */
export function approxPercentile(row: MarketRow, price: number): number {
  const pts: [number, number][] = [
    [row.min, 0],
    [row.p10, 10],
    [row.p25, 25],
    [row.median, 50],
    [row.p75, 75],
    [row.p90, 90],
    [row.max, 100],
  ];
  if (price <= pts[0][0]) return 0;
  if (price >= pts[pts.length - 1][0]) return 100;
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x0, y0] = pts[i - 1];
    if (price <= x1) return x1 === x0 ? y1 : y0 + ((price - x0) / (x1 - x0)) * (y1 - y0);
  }
  return 100;
}

export type PriceLevel = 'very_low' | 'low' | 'avg' | 'high' | 'very_high';

export const PRICE_LEVEL_META: Record<PriceLevel, { label: string; tone: 'cheap' | 'neutral' | 'pricey' }> = {
  very_low: { label: '매우 저렴', tone: 'cheap' },
  low: { label: '저렴', tone: 'cheap' },
  avg: { label: '평균', tone: 'neutral' },
  high: { label: '다소 비쌈', tone: 'pricey' },
  very_high: { label: '비쌈', tone: 'pricey' },
};

/** 백분위(0=가장 저렴, 100=가장 비쌈)를 가격 수준으로 */
export function priceLevel(percentile: number): PriceLevel {
  if (percentile < 20) return 'very_low';
  if (percentile < 40) return 'low';
  if (percentile <= 60) return 'avg';
  if (percentile <= 80) return 'high';
  return 'very_high';
}

/** 같은 지역·과목·연령 과정들 사이에서 이 금액의 위치 */
export function positionOf(price: number, row: MarketRow, rawPrices?: number[]): { percentile: number; level: PriceLevel; diffFromMedian: number } {
  const percentile = rawPrices && rawPrices.length >= MIN_MARKET_N ? percentileRank([...rawPrices].sort((a, b) => a - b), price) : approxPercentile(row, price);
  return { percentile, level: priceLevel(percentile), diffFromMedian: row.median > 0 ? price / row.median - 1 : 0 };
}

/** 학원마다 조건에 맞는 과정 금액의 중앙값 (시세 분포·히스토그램용, 시세와 같은 학원당 한 표) */
export function academyPrices(academies: RealAcademy[], subjectId: string, age: AgeGroup | null): number[] {
  return academies.flatMap((a) => {
    const prices = a.courses.filter((c) => courseMatches(c, subjectId, age)).map((c) => c.price);
    return prices.length ? [median(prices)] : [];
  });
}

/** 과정 금액 목록의 대표값 (학원 한 곳) */
export function representativePrice(courses: Course[]): number | null {
  return courses.length ? median(courses.map((c) => c.price)) : null;
}
