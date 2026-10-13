// public/data/manifest.json 의 모양. scripts/update-data.ts 가 만들고 앱이 읽는다.

export interface DataManifest {
  version: 1;
  /** ISO 시각 */
  updatedAt: string;
  /** 인증키 없이 받은 일부 표본(동작 확인용)인지 */
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
}
