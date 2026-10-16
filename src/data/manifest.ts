// public/data/manifest.json 의 모양. scripts/update-data.ts 가 만들고 앱이 읽는다.

import type { SportsSummary } from './sports';

export const MANIFEST_VERSION = 2;

export interface DataManifest {
  version: 2;
  /** 교육청에서 받은 시각 (ISO) */
  updatedAt: string;
  /** api: 인증키로 Open API 에서 받음(매주 최신) · file: 교육청이 매달 올리는 전국 파일 · sample: 개발용 표본 */
  sourceKind: 'api' | 'file' | 'sample';
  /** 전국 파일의 기준일 YYYY-MM-DD */
  baseDate?: string;
  /** 일부 학원만 담은 개발용 표본인지 */
  sampleMode: boolean;
  source: string;
  totals: {
    academies: number;
    priced: number;
    courses: number;
    /** 주소로 구를 정하지 못한 학원 */
    unassigned: number;
    /** 휴원·폐원이라 뺀 곳 */
    skippedClosed: number;
  };
  offices: { code: string; sido: string; total: number; fetched: number; kept: number }[];
  /** academies·priced 는 교육청 학원·교습소, sports·sportsPriced 는 체육시설 (체육 자료가 있을 때만) */
  districts: { sido: string; sigungu: string; code: string; file: string | null; academies: number; priced: number; sports?: number; sportsPriced?: number }[];
  buckets: { sido: string; name: string; file: string; academies: number; priced: number; sports?: number; sportsPriced?: number }[];
  /** 국민체육진흥공단 체육시설 자료 (스포츠강좌이용권 강좌 금액 · 전국체육시설 목록). 받지 못했으면 없다 */
  sports?: SportsSummary;
  /** 파일별 내용 해시 (주소의 ?v= 에 쓴다). 없으면 갱신 시각을 쓴다 */
  versions?: Record<string, string>;
}
