import type { AgeGroup } from '../types';
import snapshot from './neisSnapshot.json';

// scripts/neis-compare.ts 가 교육청 실데이터를 받아 만든 요약 통계 (학원 이름·주소 없음).
// 공유용 데모처럼 외부 API 를 부를 수 없는 곳에서도 실제 시세를 보여주기 위해 빌드에 넣는다.

export interface SnapshotRow {
  sido: string;
  sigungu: string;
  subjectId: string;
  age: AgeGroup | null;
  n: number;
  academies: number;
  p25: number;
  median: number;
  p75: number;
}

const data = snapshot as { fetchedAt: string | null; rows: SnapshotRow[] };

export const SNAPSHOT_DATE = data.fetchedAt;

export function snapshotFor(sido: string, sigungu: string | undefined, subjectId: string, age: AgeGroup | null): SnapshotRow | undefined {
  return data.rows.find((r) => r.sido === sido && (!sigungu || r.sigungu === sigungu) && r.subjectId === subjectId && r.age === age);
}
