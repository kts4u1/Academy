// 교육청 실데이터 ↔ 예시 데이터 비교
// 교육청 교습비(과정별 1인 교습비, 대부분 월 단위)를 과목·연령별로 모아 분포를 만들고,
// 같은 지역·과목·연령의 예시 데이터 월 수강료와 나란히 놓는다.

import type { Academy, AgeGroup } from '../types';
import { marketPoints } from './market';
import type { NeisAcademy } from './neis';
import { classifyCourse, type ClassifiedCourse } from './neisClassify';
import { summarize, type Stats } from './stats';

export interface ClassifiedItem extends ClassifiedCourse {
  academy: NeisAcademy;
}

/** 1:1·개인 레슨은 그룹 수업과 가격대가 달라서 비교에서 뺀다 (예시 데이터도 1:1 요금제는 뺀다) */
const PRIVATE_RE = /1\s*(:|대)\s*1|개인|과외|프라이빗|private/i;

export function classifyRows(rows: NeisAcademy[]): ClassifiedItem[] {
  return rows.flatMap((academy) => {
    // 같은 학원에 똑같은 과정·금액이 두 번 적힌 경우가 있어 한 번만 센다
    const seen = new Set<string>();
    const unique = academy.tuitions.filter((t) => {
      const k = `${t.course}|${t.price}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return unique.map((t) => ({
      ...classifyCourse(t.course, t.price, {
        academyName: academy.name,
        realm: academy.realm,
        courseCategory: academy.courseCategory,
        courseList: academy.courseList,
      }),
      academy,
    }));
  });
}

/** 비교 통계에 쓸 수 있는 항목: 과목을 알고, 월 교습비로 보이며, 1:1 이 아닌 것 */
export function isComparable(item: ClassifiedCourse): boolean {
  return item.subjectId !== null && !item.excluded && !PRIVATE_RE.test(item.course);
}

export interface ComparisonRow {
  subjectId: string;
  /** null = 연령 무관 전체 */
  age: AgeGroup | null;
  real: Stats;
  realAcademies: number;
  sample: Stats | null;
  sampleScope: string;
  /** 예시 중앙값이 실제보다 몇 % 높은지 (+0.2 = 예시가 20% 비쌈) */
  diff: number | null;
}

export interface CompareScope {
  sido: string;
  sigungu?: string;
}

export function sampleStats(academies: Academy[], subjectId: string, age: AgeGroup | null, scope: CompareScope): { stats: Stats | null; label: string } {
  const base = { subjectId, ages: age ? [age] : undefined, classTypes: ['group' as const, 'small' as const], excludePublic: true };
  if (scope.sigungu) {
    const local = marketPoints(academies, { ...base, sido: scope.sido, sigungu: scope.sigungu }).map((p) => p.cost.monthlyTuition);
    if (local.length >= 3) return { stats: summarize(local), label: scope.sigungu };
  }
  const wide = marketPoints(academies, { ...base, sido: scope.sido }).map((p) => p.cost.monthlyTuition);
  return { stats: wide.length >= 3 ? summarize(wide) : null, label: scope.sido };
}

const AGE_ORDER: AgeGroup[] = ['preschool', 'elementary', 'middle', 'high', 'adult'];

/** 과목별(연령 전체) + 과목×연령별 비교표. 실데이터 표본이 minN 미만인 칸은 뺀다. */
export function compareWithSample(items: ClassifiedItem[], academies: Academy[], scope: CompareScope, minN = 3): ComparisonRow[] {
  const comparable = items.filter(isComparable);
  const bySubject = new Map<string, ClassifiedItem[]>();
  for (const item of comparable) {
    const list = bySubject.get(item.subjectId!);
    if (list) list.push(item);
    else bySubject.set(item.subjectId!, [item]);
  }
  const rows: ComparisonRow[] = [];
  const build = (subjectId: string, age: AgeGroup | null, list: ClassifiedItem[]) => {
    if (list.length < minN) return;
    const real = summarize(list.map((i) => i.price))!;
    const sample = sampleStats(academies, subjectId, age, scope);
    rows.push({
      subjectId,
      age,
      real,
      realAcademies: new Set(list.map((i) => i.academy.id)).size,
      sample: sample.stats,
      sampleScope: sample.label,
      diff: sample.stats ? sample.stats.median / real.median - 1 : null,
    });
  };
  const subjects = Array.from(bySubject.entries()).sort((a, b) => b[1].length - a[1].length);
  for (const [subjectId, list] of subjects) {
    build(subjectId, null, list);
    for (const age of AGE_ORDER) build(subjectId, age, list.filter((i) => i.ages.includes(age)));
  }
  return rows;
}

/** 학원·교습소별로 교습비가 공개된 곳 수. 교육청 자료는 교습소만 과정별 교습비가 채워진 경우가 많다. */
export function pricedByKind(rows: NeisAcademy[]): { kind: string; total: number; priced: number }[] {
  const map = new Map<string, { total: number; priced: number }>();
  for (const r of rows) {
    const k = r.kind || '기타';
    const v = map.get(k) ?? { total: 0, priced: 0 };
    v.total++;
    if (r.tuitions.length > 0) v.priced++;
    map.set(k, v);
  }
  return Array.from(map.entries())
    .map(([kind, v]) => ({ kind, ...v }))
    .sort((a, b) => b.total - a.total);
}

export interface ClassificationCoverage {
  total: number;
  comparable: number;
  noSubject: number;
  excluded: number;
  privateLessons: number;
  withAge: number;
}

export function coverage(items: ClassifiedItem[]): ClassificationCoverage {
  return {
    total: items.length,
    comparable: items.filter(isComparable).length,
    noSubject: items.filter((i) => i.subjectId === null).length,
    excluded: items.filter((i) => i.excluded).length,
    privateLessons: items.filter((i) => !i.excluded && i.subjectId !== null && PRIVATE_RE.test(i.course)).length,
    withAge: items.filter((i) => isComparable(i) && i.ages.length > 0).length,
  };
}
