// public/data/manifest.json 의 모양. scripts/update-data.ts 가 만들고 앱이 읽는다.

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
  districts: { sido: string; sigungu: string; code: string; file: string | null; academies: number; priced: number }[];
  buckets: { sido: string; name: string; file: string; academies: number; priced: number }[];
  /** 파일별 내용 해시 (주소의 ?v= 에 쓴다). 없으면 갱신 시각을 쓴다 */
  versions?: Record<string, string>;
}
