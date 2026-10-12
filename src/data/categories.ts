import type { AgeGroup, Billing, CategoryGroup, ClassType, FeeFrequency } from '../types';

export const GROUPS: { id: CategoryGroup; name: string; desc: string }[] = [
  { id: 'academic', name: '교과', desc: '국어 · 영어 · 수학 · 과학 · 코딩' },
  { id: 'sports', name: '체육', desc: '수영 · 태권도 · 복싱 · 주짓수 · 구기' },
  { id: 'arts', name: '예술', desc: '피아노 · 미술 · 발레 · 댄스' },
];

export const AGE_LABELS: Record<AgeGroup, string> = {
  preschool: '유아',
  elementary: '초등',
  middle: '중등',
  high: '고등',
  adult: '성인',
};

export const AGE_ORDER: AgeGroup[] = ['preschool', 'elementary', 'middle', 'high', 'adult'];

export const CLASS_TYPE_LABELS: Record<ClassType, string> = {
  group: '그룹',
  small: '소수정예',
  private: '1:1 개인',
};

/** 샘플 데이터 생성용 요금제 틀. 가격 범위는 2026년 서울 평균 지역 기준(원). */
export interface PlanTemplate {
  label: string;
  ages: AgeGroup[];
  classType: ClassType;
  maxStudents: number;
  billing: Billing;
  sessionsPerWeek: number;
  minutes: number;
  range: [number, number];
  months?: number;
  totalSessions?: number;
  unlimited?: boolean;
}

export interface ExtraTemplate {
  name: string;
  range: [number, number];
  frequency: FeeFrequency;
  timesPerYear?: number;
  required: boolean;
  /** 이 비용을 받는 학원의 비율 */
  probability: number;
  note?: string;
  /** 특정 연령 요금제가 있을 때만 */
  ages?: AgeGroup[];
}

export interface Subject {
  id: string;
  name: string;
  /** 타일에 쓰는 1~2자 약칭 */
  short: string;
  group: CategoryGroup;
  keywords: string[];
  nameSuffixes: string[];
  templates: PlanTemplate[];
  extras: ExtraTemplate[];
  /** 지역 물가 반영 정도 (0~1). 교과는 지역차가 크고 체육은 작다. */
  regionSensitivity: number;
  /** 구립·시립 공공 시설이 흔한 종목 */
  hasPublic?: boolean;
}

const t = (
  label: string,
  ages: AgeGroup[],
  classType: ClassType,
  maxStudents: number,
  billing: Billing,
  sessionsPerWeek: number,
  minutes: number,
  range: [number, number],
  extra: Partial<PlanTemplate> = {},
): PlanTemplate => ({ label, ages, classType, maxStudents, billing, sessionsPerWeek, minutes, range, ...extra });

const textbookQuarterly: ExtraTemplate = {
  name: '교재비',
  range: [20000, 50000],
  frequency: 'quarterly',
  required: true,
  probability: 0.9,
  note: '3개월마다 교재 교체',
};
const shuttle: ExtraTemplate = {
  name: '차량비',
  range: [20000, 40000],
  frequency: 'monthly',
  required: false,
  probability: 0.3,
  note: '차량 이용 시',
};

export const SUBJECTS: Subject[] = [
  // ───────────── 교과 ─────────────
  {
    id: 'korean',
    name: '국어',
    short: '국',
    group: 'academic',
    keywords: ['국어', '문학', '비문학', '독해', '수능국어'],
    nameSuffixes: ['국어학원', '국어전문학원', '국어교습소'],
    regionSensitivity: 1,
    templates: [
      t('주2회 그룹반', ['elementary'], 'group', 12, 'monthly', 2, 90, [180000, 260000]),
      t('주2회 내신반', ['middle'], 'group', 12, 'monthly', 2, 120, [280000, 400000]),
      t('주2회 수능반', ['high'], 'group', 15, 'monthly', 2, 150, [380000, 550000]),
      t('소수정예 주2회', ['high'], 'small', 6, 'monthly', 2, 150, [500000, 700000]),
      t('1:1 과외식 수업', ['middle', 'high'], 'private', 1, 'per_session', 1, 90, [70000, 100000]),
    ],
    extras: [
      textbookQuarterly,
      { name: '모의고사비', range: [10000, 20000], frequency: 'monthly', required: true, probability: 0.5, ages: ['high'] },
      shuttle,
    ],
  },
  {
    id: 'english',
    name: '영어',
    short: '영',
    group: 'academic',
    keywords: ['영어', '회화', '문법', '리딩', '토익', '수능영어', '원어민'],
    nameSuffixes: ['어학원', '영어학원', '잉글리시', '영어교습소'],
    regionSensitivity: 1,
    templates: [
      t('주3회 놀이영어', ['preschool'], 'group', 8, 'monthly', 3, 60, [220000, 320000]),
      t('주3회 정규반', ['elementary'], 'group', 10, 'monthly', 3, 90, [250000, 380000]),
      t('원어민 소수반 주2회', ['elementary'], 'small', 4, 'monthly', 2, 60, [250000, 350000]),
      t('주3회 내신반', ['middle'], 'group', 12, 'monthly', 3, 120, [320000, 460000]),
      t('주2회 수능반', ['high'], 'group', 15, 'monthly', 2, 150, [400000, 580000]),
      t('성인 회화 주2회', ['adult'], 'small', 6, 'monthly', 2, 60, [150000, 240000]),
      t('1:1 개인 수업', ['elementary', 'middle', 'high', 'adult'], 'private', 1, 'per_session', 1, 60, [50000, 80000]),
    ],
    extras: [
      textbookQuarterly,
      { name: '레벨테스트비', range: [10000, 20000], frequency: 'once', required: true, probability: 0.3 },
      shuttle,
    ],
  },
  {
    id: 'math',
    name: '수학',
    short: '수',
    group: 'academic',
    keywords: ['수학', '선행', '내신', '수능수학', '사고력', '연산'],
    nameSuffixes: ['수학학원', '수학전문학원', '매쓰', '수학교습소'],
    regionSensitivity: 1,
    templates: [
      t('주2회 기본반', ['elementary'], 'group', 10, 'monthly', 2, 90, [200000, 300000]),
      t('주3회 심화반', ['elementary'], 'group', 10, 'monthly', 3, 90, [260000, 380000]),
      t('주3회 내신·선행반', ['middle'], 'group', 12, 'monthly', 3, 120, [340000, 500000]),
      t('1:1 관리반 월4회', ['middle'], 'private', 1, 'monthly', 1, 90, [320000, 450000]),
      t('주3회 수능반', ['high'], 'group', 15, 'monthly', 3, 150, [450000, 680000]),
      t('소수정예 주2회', ['high'], 'small', 6, 'monthly', 2, 180, [550000, 800000]),
      t('1:1 개인 수업', ['middle', 'high'], 'private', 1, 'per_session', 1, 90, [80000, 120000]),
    ],
    extras: [
      textbookQuarterly,
      { name: '테스트·클리닉비', range: [10000, 20000], frequency: 'monthly', required: true, probability: 0.3 },
      shuttle,
    ],
  },
  {
    id: 'science',
    name: '과학',
    short: '과',
    group: 'academic',
    keywords: ['과학', '물리', '화학', '생명과학', '지구과학', '실험'],
    nameSuffixes: ['과학학원', '사이언스', '과학교습소'],
    regionSensitivity: 1,
    templates: [
      t('주1회 실험반', ['elementary'], 'group', 10, 'monthly', 1, 120, [140000, 220000]),
      t('주2회 내신반', ['middle'], 'group', 12, 'monthly', 2, 120, [280000, 400000]),
      t('주2회 과탐반', ['high'], 'group', 15, 'monthly', 2, 150, [400000, 600000]),
      t('소수정예 주1회', ['high'], 'small', 6, 'monthly', 1, 180, [350000, 500000]),
    ],
    extras: [
      { name: '실험재료비', range: [10000, 30000], frequency: 'monthly', required: true, probability: 0.5 },
      textbookQuarterly,
    ],
  },
  {
    id: 'social',
    name: '사회',
    short: '사',
    group: 'academic',
    keywords: ['사회', '한국사', '역사', '사탐', '윤리', '지리'],
    nameSuffixes: ['사회탐구학원', '역사학원', '사회교습소'],
    regionSensitivity: 1,
    templates: [
      t('주1회 내신반', ['middle'], 'group', 15, 'monthly', 1, 120, [160000, 250000]),
      t('주1회 사탐반', ['high'], 'group', 20, 'monthly', 1, 150, [220000, 350000]),
      t('주2회 사탐 집중반', ['high'], 'group', 20, 'monthly', 2, 150, [350000, 500000]),
    ],
    extras: [textbookQuarterly],
  },
  {
    id: 'essay',
    name: '논술·독서',
    short: '논',
    group: 'academic',
    keywords: ['논술', '독서', '글쓰기', '토론', '대입논술'],
    nameSuffixes: ['논술학원', '독서논술', '책읽기교실'],
    regionSensitivity: 1,
    templates: [
      t('주1회 독서논술', ['elementary'], 'group', 8, 'monthly', 1, 100, [150000, 240000]),
      t('주1회 토론논술', ['middle'], 'group', 8, 'monthly', 1, 120, [200000, 300000]),
      t('대입논술 소수반', ['high'], 'small', 6, 'monthly', 1, 180, [350000, 550000]),
    ],
    extras: [{ name: '도서·교재비', range: [10000, 30000], frequency: 'monthly', required: true, probability: 0.8 }],
  },
  {
    id: 'coding',
    name: '코딩',
    short: '코',
    group: 'academic',
    keywords: ['코딩', '프로그래밍', '파이썬', '스크래치', '로봇', '정보올림피아드'],
    nameSuffixes: ['코딩학원', '코딩스쿨', '로봇코딩'],
    regionSensitivity: 0.8,
    templates: [
      t('주1회 블록코딩', ['elementary'], 'group', 8, 'monthly', 1, 90, [130000, 200000]),
      t('주2회 로봇코딩', ['elementary'], 'group', 8, 'monthly', 2, 90, [200000, 300000]),
      t('주2회 파이썬', ['middle', 'high'], 'group', 8, 'monthly', 2, 120, [240000, 340000]),
      t('성인 주2회 실무반', ['adult'], 'group', 10, 'monthly', 2, 120, [250000, 400000]),
    ],
    extras: [
      { name: '교구·키트비', range: [50000, 150000], frequency: 'once', required: false, probability: 0.4, note: '로봇 키트 구매' },
      { name: '자격증 응시료', range: [20000, 40000], frequency: 'per_event', timesPerYear: 2, required: false, probability: 0.4 },
    ],
  },
  {
    id: 'lang2',
    name: '제2외국어',
    short: '외',
    group: 'academic',
    keywords: ['중국어', '일본어', '스페인어', 'HSK', 'JLPT', '제2외국어'],
    nameSuffixes: ['외국어학원', '중국어학원', '일본어학원'],
    regionSensitivity: 0.8,
    templates: [
      t('주2회 기초반', ['elementary'], 'group', 8, 'monthly', 2, 60, [120000, 200000]),
      t('주2회 시험대비반', ['middle', 'high'], 'group', 10, 'monthly', 2, 90, [180000, 280000]),
      t('성인 주2회', ['adult'], 'group', 8, 'monthly', 2, 60, [150000, 250000]),
      t('1:1 개인 수업', ['elementary', 'middle', 'high', 'adult'], 'private', 1, 'per_session', 1, 60, [40000, 60000]),
    ],
    extras: [
      textbookQuarterly,
      { name: '시험 응시료', range: [30000, 50000], frequency: 'per_event', timesPerYear: 1, required: false, probability: 0.4 },
    ],
  },
  {
    id: 'allsubj',
    name: '종합(전과목)',
    short: '종',
    group: 'academic',
    keywords: ['종합', '전과목', '보습', '국영수', '공부방'],
    nameSuffixes: ['보습학원', '종합학원', '공부방'],
    regionSensitivity: 1,
    templates: [
      t('주5회 전과목', ['elementary'], 'group', 12, 'monthly', 5, 120, [200000, 320000]),
      t('주5회 국영수사과', ['middle'], 'group', 15, 'monthly', 5, 180, [380000, 580000]),
    ],
    extras: [
      { name: '교재비', range: [20000, 40000], frequency: 'monthly', required: true, probability: 0.9 },
      shuttle,
    ],
  },

  // ───────────── 체육 ─────────────
  {
    id: 'swim',
    name: '수영',
    short: '수영',
    group: 'sports',
    keywords: ['수영', '생존수영', '자유형', '접영', '아쿠아', '스윔'],
    nameSuffixes: ['수영클럽', '스윔', '아쿠아스쿨', '수영교실'],
    regionSensitivity: 0.4,
    hasPublic: true,
    templates: [
      t('키즈 주2회', ['preschool', 'elementary'], 'group', 8, 'monthly', 2, 50, [110000, 150000]),
      t('키즈 주3회', ['preschool', 'elementary'], 'group', 8, 'monthly', 3, 50, [140000, 190000]),
      t('성인 주3회 (월수금)', ['adult'], 'group', 15, 'monthly', 3, 50, [100000, 150000]),
      t('성인 주5회 (매일)', ['adult'], 'group', 15, 'monthly', 5, 50, [130000, 180000]),
      t('1:2 소그룹 주2회', ['elementary', 'adult'], 'small', 2, 'monthly', 2, 50, [220000, 300000]),
      t('1:1 개인레슨 10회권', ['elementary', 'middle', 'adult'], 'private', 1, 'package', 2, 30, [450000, 700000], {
        totalSessions: 10,
      }),
    ],
    extras: [
      { name: '등록비', range: [10000, 30000], frequency: 'once', required: true, probability: 0.5 },
      { name: '수영용품(수영복·수모·수경)', range: [50000, 90000], frequency: 'once', required: false, probability: 0.6 },
      { name: '셔틀 이용료', range: [20000, 30000], frequency: 'monthly', required: false, probability: 0.4 },
    ],
  },
  {
    id: 'taekwondo',
    name: '태권도',
    short: '태권',
    group: 'sports',
    keywords: ['태권도', '품새', '겨루기', '시범단'],
    nameSuffixes: ['태권도', '태권도장', '태권도 체육관'],
    regionSensitivity: 0.4,
    templates: [
      t('유아 주5회', ['preschool'], 'group', 20, 'monthly', 5, 50, [140000, 180000]),
      t('초등 주5회', ['elementary'], 'group', 20, 'monthly', 5, 60, [150000, 190000]),
      t('초등 주3회', ['elementary'], 'group', 20, 'monthly', 3, 60, [120000, 150000]),
      t('성인 주3회', ['adult'], 'group', 15, 'monthly', 3, 60, [130000, 170000]),
    ],
    extras: [
      { name: '도복비', range: [40000, 60000], frequency: 'once', required: true, probability: 0.95 },
      { name: '승급심사비', range: [30000, 50000], frequency: 'per_event', timesPerYear: 4, required: true, probability: 0.9 },
      { name: '특별활동비', range: [10000, 20000], frequency: 'monthly', required: true, probability: 0.3, note: '체험학습·행사' },
    ],
  },
  {
    id: 'boxing',
    name: '복싱',
    short: '복싱',
    group: 'sports',
    keywords: ['복싱', '권투', '다이어트복싱', '생활체육'],
    nameSuffixes: ['복싱클럽', '복싱짐', '복싱 체육관'],
    regionSensitivity: 0.4,
    templates: [
      t('자유이용 1개월', ['adult'], 'group', 20, 'monthly', 5, 60, [130000, 200000], { unlimited: true }),
      t('자유이용 3개월권', ['adult'], 'group', 20, 'package', 5, 60, [330000, 480000], { months: 3, unlimited: true }),
      t('청소년 주3회', ['elementary', 'middle', 'high'], 'group', 12, 'monthly', 3, 60, [120000, 160000]),
      t('1:1 PT 10회', ['adult'], 'private', 1, 'package', 2, 50, [450000, 650000], { totalSessions: 10 }),
    ],
    extras: [
      { name: '입관비', range: [30000, 50000], frequency: 'once', required: true, probability: 0.6 },
      { name: '글러브·핸드랩', range: [40000, 80000], frequency: 'once', required: false, probability: 0.7 },
      { name: '운동복 대여', range: [10000, 10000], frequency: 'monthly', required: false, probability: 0.3 },
    ],
  },
  {
    id: 'kickboxing',
    name: '킥복싱',
    short: '킥',
    group: 'sports',
    keywords: ['킥복싱', '무에타이', '입식타격'],
    nameSuffixes: ['킥복싱', '무에타이짐', '킥복싱클럽'],
    regionSensitivity: 0.4,
    templates: [
      t('자유이용 1개월', ['adult'], 'group', 20, 'monthly', 5, 60, [140000, 220000], { unlimited: true }),
      t('자유이용 3개월권', ['adult'], 'group', 20, 'package', 5, 60, [360000, 550000], { months: 3, unlimited: true }),
      t('주3회 정규반', ['middle', 'high', 'adult'], 'group', 15, 'monthly', 3, 60, [120000, 170000]),
      t('1:1 PT 10회', ['adult'], 'private', 1, 'package', 2, 50, [500000, 700000], { totalSessions: 10 }),
    ],
    extras: [
      { name: '입관비', range: [20000, 50000], frequency: 'once', required: true, probability: 0.5 },
      { name: '글러브·정강이보호대', range: [60000, 100000], frequency: 'once', required: false, probability: 0.7 },
      { name: '대회 참가비', range: [50000, 100000], frequency: 'per_event', timesPerYear: 1, required: false, probability: 0.3 },
    ],
  },
  {
    id: 'kendo',
    name: '검도',
    short: '검도',
    group: 'sports',
    keywords: ['검도', '죽도', '호구', '검술'],
    nameSuffixes: ['검도관', '검도장', '검도클럽'],
    regionSensitivity: 0.4,
    templates: [
      t('초등 주3회', ['elementary'], 'group', 15, 'monthly', 3, 60, [130000, 160000]),
      t('초등 주5회', ['elementary'], 'group', 15, 'monthly', 5, 60, [150000, 180000]),
      t('중고등 주3회', ['middle', 'high'], 'group', 15, 'monthly', 3, 60, [130000, 170000]),
      t('성인 주5회', ['adult'], 'group', 15, 'monthly', 5, 60, [150000, 190000]),
    ],
    extras: [
      { name: '도복', range: [60000, 100000], frequency: 'once', required: true, probability: 0.95 },
      { name: '죽도', range: [40000, 60000], frequency: 'once', required: true, probability: 0.6 },
      { name: '호구', range: [350000, 700000], frequency: 'once', required: false, probability: 0.9, note: '입문 3~6개월 후 구매' },
      { name: '승급·승단 심사비', range: [50000, 100000], frequency: 'per_event', timesPerYear: 2, required: true, probability: 0.8 },
    ],
  },
  {
    id: 'jiujitsu',
    name: '주짓수',
    short: '주짓',
    group: 'sports',
    keywords: ['주짓수', '브라질리언주짓수', 'BJJ', '노기', '그래플링'],
    nameSuffixes: ['주짓수', '주짓수 아카데미', '주짓수 클럽'],
    regionSensitivity: 0.4,
    templates: [
      t('자유이용 1개월', ['adult'], 'group', 25, 'monthly', 5, 90, [160000, 250000], { unlimited: true }),
      t('자유이용 3개월권', ['adult'], 'group', 25, 'package', 5, 90, [420000, 650000], { months: 3, unlimited: true }),
      t('키즈 주2회', ['elementary'], 'group', 12, 'monthly', 2, 60, [130000, 180000]),
      t('1:1 PT 10회', ['adult'], 'private', 1, 'package', 2, 60, [600000, 800000], { totalSessions: 10 }),
    ],
    extras: [
      { name: '도복', range: [120000, 200000], frequency: 'once', required: true, probability: 0.9 },
      { name: '입관비', range: [30000, 50000], frequency: 'once', required: true, probability: 0.4 },
      { name: '래시가드', range: [50000, 80000], frequency: 'once', required: false, probability: 0.5 },
      { name: '벨트 승급비', range: [30000, 50000], frequency: 'per_event', timesPerYear: 1, required: false, probability: 0.4 },
    ],
  },
  {
    id: 'basketball',
    name: '농구',
    short: '농구',
    group: 'sports',
    keywords: ['농구', '바스켓볼', '스킬트레이닝'],
    nameSuffixes: ['농구교실', '바스켓볼클럽', '농구 아카데미'],
    regionSensitivity: 0.4,
    templates: [
      t('초등 주1회', ['elementary'], 'group', 12, 'monthly', 1, 90, [100000, 140000]),
      t('초등 주2회', ['elementary'], 'group', 12, 'monthly', 2, 90, [170000, 230000]),
      t('중등 주1회', ['middle'], 'group', 12, 'monthly', 1, 90, [110000, 150000]),
      t('성인 주1회', ['adult'], 'group', 15, 'monthly', 1, 120, [80000, 120000]),
      t('1:1 스킬 트레이닝', ['elementary', 'middle', 'high'], 'private', 1, 'per_session', 1, 60, [50000, 80000]),
    ],
    extras: [
      { name: '유니폼', range: [60000, 90000], frequency: 'once', required: true, probability: 0.8 },
      { name: '대회 참가비', range: [30000, 60000], frequency: 'per_event', timesPerYear: 2, required: false, probability: 0.5 },
      { name: '상해보험료', range: [10000, 30000], frequency: 'yearly', required: true, probability: 0.4 },
      { name: '차량비', range: [20000, 30000], frequency: 'monthly', required: false, probability: 0.4 },
    ],
  },
  {
    id: 'soccer',
    name: '축구',
    short: '축구',
    group: 'sports',
    keywords: ['축구', '풋살', 'FC', '유소년축구'],
    nameSuffixes: ['FC', '축구교실', '유소년 축구클럽'],
    regionSensitivity: 0.4,
    templates: [
      t('유아 주1회', ['preschool'], 'group', 12, 'monthly', 1, 60, [90000, 120000]),
      t('초등 주1회', ['elementary'], 'group', 15, 'monthly', 1, 90, [100000, 140000]),
      t('초등 주2회', ['elementary'], 'group', 15, 'monthly', 2, 90, [150000, 200000]),
      t('엘리트반 주3회', ['elementary', 'middle'], 'group', 20, 'monthly', 3, 120, [250000, 350000]),
      t('성인 주1회', ['adult'], 'group', 20, 'monthly', 1, 120, [80000, 120000]),
    ],
    extras: [
      { name: '유니폼', range: [60000, 80000], frequency: 'once', required: true, probability: 0.9 },
      { name: '상해보험료', range: [10000, 30000], frequency: 'yearly', required: true, probability: 0.5 },
      { name: '대회 참가비', range: [30000, 50000], frequency: 'per_event', timesPerYear: 2, required: false, probability: 0.6 },
      { name: '차량비', range: [20000, 30000], frequency: 'monthly', required: false, probability: 0.4 },
    ],
  },
  {
    id: 'baseball',
    name: '야구',
    short: '야구',
    group: 'sports',
    keywords: ['야구', '리틀야구', '베이스볼', '타격', '피칭'],
    nameSuffixes: ['베이스볼 아카데미', '야구교실', '리틀야구단'],
    regionSensitivity: 0.4,
    templates: [
      t('초등 주1회', ['elementary'], 'group', 15, 'monthly', 1, 120, [150000, 200000]),
      t('초등 주2회', ['elementary'], 'group', 15, 'monthly', 2, 120, [220000, 300000]),
      t('리틀야구단 주3회', ['elementary', 'middle'], 'group', 20, 'monthly', 3, 180, [280000, 380000]),
      t('성인 주1회', ['adult'], 'group', 15, 'monthly', 1, 120, [130000, 180000]),
      t('1:1 타격·피칭 레슨', ['elementary', 'middle', 'high', 'adult'], 'private', 1, 'per_session', 1, 60, [70000, 100000]),
    ],
    extras: [
      { name: '유니폼', range: [80000, 120000], frequency: 'once', required: true, probability: 0.9 },
      { name: '글러브·배트', range: [150000, 400000], frequency: 'once', required: false, probability: 0.8 },
      { name: '대회 참가비', range: [50000, 100000], frequency: 'per_event', timesPerYear: 2, required: false, probability: 0.6 },
      { name: '상해보험료', range: [10000, 30000], frequency: 'yearly', required: true, probability: 0.5 },
    ],
  },
  {
    id: 'jumprope',
    name: '줄넘기',
    short: '줄',
    group: 'sports',
    keywords: ['줄넘기', '음악줄넘기', '키즈체육'],
    nameSuffixes: ['줄넘기교실', '줄넘기 스쿨', '키즈스포츠'],
    regionSensitivity: 0.3,
    templates: [
      t('주1회', ['preschool', 'elementary'], 'group', 15, 'monthly', 1, 50, [60000, 90000]),
      t('주2회', ['elementary'], 'group', 15, 'monthly', 2, 50, [90000, 130000]),
    ],
    extras: [
      { name: '줄넘기 구매', range: [10000, 30000], frequency: 'once', required: true, probability: 0.7 },
      { name: '급수 심사비', range: [10000, 20000], frequency: 'per_event', timesPerYear: 4, required: false, probability: 0.5 },
    ],
  },
  {
    id: 'climbing',
    name: '클라이밍',
    short: '클라',
    group: 'sports',
    keywords: ['클라이밍', '볼더링', '암벽', '리드'],
    nameSuffixes: ['클라이밍', '클라이밍짐', '볼더링 센터'],
    regionSensitivity: 0.4,
    templates: [
      t('강습 주2회', ['adult'], 'group', 6, 'monthly', 2, 90, [180000, 250000]),
      t('자유이용 월권', ['adult'], 'group', 30, 'monthly', 3, 120, [130000, 180000], { unlimited: true }),
      t('키즈 주1회', ['elementary'], 'group', 6, 'monthly', 1, 60, [120000, 160000]),
    ],
    extras: [
      { name: '등록비', range: [10000, 20000], frequency: 'once', required: true, probability: 0.5 },
      { name: '암벽화', range: [100000, 180000], frequency: 'once', required: false, probability: 0.8, note: '대여 가능' },
    ],
  },
  {
    id: 'tennis',
    name: '테니스',
    short: '테니',
    group: 'sports',
    keywords: ['테니스', '레슨', '실내테니스'],
    nameSuffixes: ['테니스아카데미', '테니스클럽', '실내테니스'],
    regionSensitivity: 0.5,
    templates: [
      t('1:1 레슨 주2회 (20분)', ['adult'], 'private', 1, 'monthly', 2, 20, [220000, 320000]),
      t('그룹 레슨 주1회', ['adult'], 'small', 4, 'monthly', 1, 60, [150000, 220000]),
      t('주니어 주2회', ['elementary', 'middle'], 'small', 4, 'monthly', 2, 50, [180000, 260000]),
    ],
    extras: [
      { name: '볼·코트 관리비', range: [10000, 20000], frequency: 'monthly', required: true, probability: 0.3 },
      { name: '라켓', range: [150000, 300000], frequency: 'once', required: false, probability: 0.7 },
    ],
  },
  {
    id: 'golf',
    name: '골프',
    short: '골프',
    group: 'sports',
    keywords: ['골프', '스크린골프', '골프레슨', '스윙'],
    nameSuffixes: ['골프아카데미', '골프스튜디오', '골프레슨'],
    regionSensitivity: 0.5,
    templates: [
      t('레슨 주3회 + 연습 무제한', ['adult'], 'private', 1, 'monthly', 3, 20, [200000, 320000]),
      t('레슨 주2회', ['adult'], 'private', 1, 'monthly', 2, 20, [160000, 250000]),
      t('주니어 주2회', ['elementary', 'middle', 'high'], 'small', 4, 'monthly', 2, 50, [250000, 350000]),
    ],
    extras: [
      { name: '등록비', range: [0, 50000], frequency: 'once', required: true, probability: 0.4 },
      { name: '락커 이용료', range: [10000, 20000], frequency: 'monthly', required: false, probability: 0.5 },
    ],
  },
  {
    id: 'badminton',
    name: '배드민턴',
    short: '배드',
    group: 'sports',
    keywords: ['배드민턴', '셔틀콕', '생활체육'],
    nameSuffixes: ['배드민턴클럽', '배드민턴 아카데미', '배드민턴교실'],
    regionSensitivity: 0.3,
    hasPublic: true,
    templates: [
      t('성인 주2회', ['adult'], 'group', 12, 'monthly', 2, 60, [100000, 150000]),
      t('성인 주3회', ['adult'], 'group', 12, 'monthly', 3, 60, [130000, 180000]),
      t('초등 주2회', ['elementary'], 'group', 10, 'monthly', 2, 60, [110000, 150000]),
      t('1:1 레슨 주2회 (20분)', ['adult', 'middle', 'high'], 'private', 1, 'monthly', 2, 20, [120000, 180000]),
    ],
    extras: [
      { name: '셔틀콕 비용', range: [10000, 20000], frequency: 'monthly', required: true, probability: 0.5 },
      { name: '라켓', range: [80000, 200000], frequency: 'once', required: false, probability: 0.6 },
    ],
  },
  {
    id: 'tabletennis',
    name: '탁구',
    short: '탁구',
    group: 'sports',
    keywords: ['탁구', '핑퐁', '생활체육'],
    nameSuffixes: ['탁구클럽', '탁구장', '탁구교실'],
    regionSensitivity: 0.3,
    hasPublic: true,
    templates: [
      t('레슨 주2회 (20분) + 자유 이용', ['adult'], 'private', 1, 'monthly', 2, 20, [120000, 180000]),
      t('자유이용 월권', ['adult'], 'group', 30, 'monthly', 3, 120, [50000, 80000], { unlimited: true }),
      t('초등 주2회', ['elementary'], 'group', 8, 'monthly', 2, 60, [100000, 140000]),
    ],
    extras: [{ name: '라켓', range: [50000, 150000], frequency: 'once', required: false, probability: 0.6 }],
  },
  {
    id: 'pilates',
    name: '필라테스',
    short: '필라',
    group: 'sports',
    keywords: ['필라테스', '기구필라테스', '자세교정', '요가'],
    nameSuffixes: ['필라테스', '필라테스 스튜디오', '바디랩'],
    regionSensitivity: 0.6,
    templates: [
      t('그룹 주2회', ['adult'], 'group', 8, 'monthly', 2, 50, [130000, 200000]),
      t('그룹 3개월 24회', ['adult'], 'group', 8, 'package', 2, 50, [330000, 500000], { months: 3 }),
      t('2:1 듀엣 10회', ['adult'], 'small', 2, 'package', 2, 50, [380000, 550000], { totalSessions: 10 }),
      t('1:1 개인 10회', ['adult'], 'private', 1, 'package', 2, 50, [550000, 800000], { totalSessions: 10 }),
    ],
    extras: [
      { name: '등록비', range: [0, 30000], frequency: 'once', required: true, probability: 0.4 },
      { name: '락커 이용료', range: [10000, 10000], frequency: 'monthly', required: false, probability: 0.5 },
    ],
  },

  // ───────────── 예술 ─────────────
  {
    id: 'piano',
    name: '피아노',
    short: '피아',
    group: 'arts',
    keywords: ['피아노', '바이엘', '체르니', '음악학원', '입시피아노'],
    nameSuffixes: ['피아노학원', '음악학원', '피아노교습소'],
    regionSensitivity: 0.6,
    templates: [
      t('주5회 개별지도', ['preschool', 'elementary'], 'small', 6, 'monthly', 5, 50, [130000, 180000]),
      t('주3회 개별지도', ['elementary'], 'small', 6, 'monthly', 3, 50, [110000, 150000]),
      t('성인 1:1 주1회', ['adult'], 'private', 1, 'monthly', 1, 60, [160000, 240000]),
      t('입시반 1:1 주2회', ['high'], 'private', 1, 'monthly', 2, 60, [400000, 600000]),
    ],
    extras: [
      { name: '교재비', range: [10000, 30000], frequency: 'quarterly', required: true, probability: 0.8 },
      { name: '연주회비', range: [50000, 150000], frequency: 'per_event', timesPerYear: 1, required: false, probability: 0.6 },
    ],
  },
  {
    id: 'violin',
    name: '바이올린',
    short: '바이',
    group: 'arts',
    keywords: ['바이올린', '현악', '첼로', '오케스트라'],
    nameSuffixes: ['현악학원', '바이올린교습소', '스트링스'],
    regionSensitivity: 0.6,
    templates: [
      t('초등 1:1 주1회', ['elementary'], 'private', 1, 'monthly', 1, 40, [180000, 260000]),
      t('초등 그룹 주2회', ['elementary'], 'group', 8, 'monthly', 2, 60, [120000, 170000]),
      t('성인 1:1 주1회', ['adult'], 'private', 1, 'monthly', 1, 60, [220000, 320000]),
    ],
    extras: [
      { name: '악기 대여', range: [20000, 30000], frequency: 'monthly', required: false, probability: 0.5 },
      { name: '연주회비', range: [50000, 150000], frequency: 'per_event', timesPerYear: 1, required: false, probability: 0.5 },
    ],
  },
  {
    id: 'guitar',
    name: '기타',
    short: '기타',
    group: 'arts',
    keywords: ['기타', '통기타', '일렉기타', '우쿨렐레'],
    nameSuffixes: ['기타학원', '기타스쿨', '실용음악'],
    regionSensitivity: 0.5,
    templates: [
      t('성인 소그룹 주1회', ['adult'], 'small', 4, 'monthly', 1, 60, [140000, 200000]),
      t('1:1 주1회', ['middle', 'high', 'adult'], 'private', 1, 'monthly', 1, 60, [180000, 260000]),
      t('청소년 소그룹 주1회', ['elementary', 'middle'], 'small', 4, 'monthly', 1, 60, [120000, 170000]),
    ],
    extras: [
      { name: '악기 대여', range: [10000, 20000], frequency: 'monthly', required: false, probability: 0.4 },
      { name: '교재비', range: [10000, 20000], frequency: 'once', required: true, probability: 0.5 },
    ],
  },
  {
    id: 'drum',
    name: '드럼',
    short: '드럼',
    group: 'arts',
    keywords: ['드럼', '타악기', '실용음악'],
    nameSuffixes: ['드럼학원', '드럼스튜디오', '실용음악학원'],
    regionSensitivity: 0.5,
    templates: [
      t('1:1 주1회', ['middle', 'high', 'adult'], 'private', 1, 'monthly', 1, 60, [180000, 260000]),
      t('초등 소그룹 주1회', ['elementary'], 'small', 3, 'monthly', 1, 50, [140000, 200000]),
    ],
    extras: [{ name: '스틱·교재', range: [20000, 40000], frequency: 'once', required: true, probability: 0.6 }],
  },
  {
    id: 'vocal',
    name: '보컬',
    short: '보컬',
    group: 'arts',
    keywords: ['보컬', '노래', '발성', '실용음악', '입시보컬'],
    nameSuffixes: ['보컬학원', '보컬스튜디오', '실용음악학원'],
    regionSensitivity: 0.5,
    templates: [
      t('1:1 주1회', ['middle', 'high', 'adult'], 'private', 1, 'monthly', 1, 60, [200000, 300000]),
      t('입시 1:1 주2회', ['high'], 'private', 1, 'monthly', 2, 60, [500000, 700000]),
      t('그룹 주1회', ['adult'], 'group', 6, 'monthly', 1, 90, [120000, 180000]),
    ],
    extras: [{ name: '녹음비', range: [50000, 100000], frequency: 'per_event', timesPerYear: 1, required: false, probability: 0.4 }],
  },
  {
    id: 'art',
    name: '미술',
    short: '미술',
    group: 'arts',
    keywords: ['미술', '드로잉', '창의미술', '입시미술', '웹툰'],
    nameSuffixes: ['미술학원', '아틀리에', '미술교습소'],
    regionSensitivity: 0.7,
    templates: [
      t('유아 주2회', ['preschool'], 'group', 8, 'monthly', 2, 60, [130000, 170000]),
      t('초등 주2회', ['elementary'], 'group', 10, 'monthly', 2, 90, [140000, 190000]),
      t('초등 주5회', ['elementary'], 'group', 10, 'monthly', 5, 60, [180000, 250000]),
      t('입시미술 주5회', ['high'], 'group', 15, 'monthly', 5, 240, [600000, 950000]),
      t('성인 취미 주1회', ['adult'], 'group', 8, 'monthly', 1, 120, [150000, 220000]),
    ],
    extras: [{ name: '재료비', range: [10000, 30000], frequency: 'monthly', required: true, probability: 0.9 }],
  },
  {
    id: 'ballet',
    name: '발레',
    short: '발레',
    group: 'arts',
    keywords: ['발레', '취미발레', '전공발레', '무용'],
    nameSuffixes: ['발레학원', '발레스튜디오', '무용학원'],
    regionSensitivity: 0.6,
    templates: [
      t('유아 주2회', ['preschool'], 'group', 10, 'monthly', 2, 50, [120000, 170000]),
      t('초등 주2회', ['elementary'], 'group', 10, 'monthly', 2, 60, [130000, 180000]),
      t('성인 취미 주2회', ['adult'], 'group', 12, 'monthly', 2, 60, [130000, 200000]),
      t('전공·입시 주5회', ['middle', 'high'], 'group', 10, 'monthly', 5, 120, [500000, 700000]),
    ],
    extras: [
      { name: '발레복·슈즈', range: [50000, 90000], frequency: 'once', required: true, probability: 0.8 },
      { name: '정기공연비', range: [100000, 200000], frequency: 'per_event', timesPerYear: 1, required: false, probability: 0.6 },
    ],
  },
  {
    id: 'dance',
    name: '방송댄스',
    short: '댄스',
    group: 'arts',
    keywords: ['방송댄스', 'K-POP', '케이팝', '스트릿댄스', '힙합', '댄스'],
    nameSuffixes: ['댄스학원', '댄스스튜디오', '댄스아카데미'],
    regionSensitivity: 0.5,
    templates: [
      t('초등 주2회', ['elementary'], 'group', 12, 'monthly', 2, 60, [110000, 150000]),
      t('중고등 주2회', ['middle', 'high'], 'group', 15, 'monthly', 2, 90, [140000, 190000]),
      t('성인 주2회', ['adult'], 'group', 15, 'monthly', 2, 60, [120000, 180000]),
      t('입시반 주3회', ['high'], 'group', 10, 'monthly', 3, 120, [350000, 550000]),
    ],
    extras: [{ name: '공연·촬영비', range: [30000, 80000], frequency: 'per_event', timesPerYear: 2, required: false, probability: 0.5 }],
  },
  {
    id: 'acting',
    name: '연기',
    short: '연기',
    group: 'arts',
    keywords: ['연기', '뮤지컬', '입시연기', '스피치'],
    nameSuffixes: ['연기학원', '액팅스쿨', '연기아카데미'],
    regionSensitivity: 0.6,
    templates: [
      t('키즈 주1회', ['elementary'], 'group', 8, 'monthly', 1, 90, [150000, 200000]),
      t('입시 주3회', ['high'], 'group', 10, 'monthly', 3, 180, [450000, 700000]),
      t('성인 취미 주1회', ['adult'], 'group', 10, 'monthly', 1, 120, [150000, 220000]),
    ],
    extras: [{ name: '프로필 촬영비', range: [100000, 200000], frequency: 'per_event', timesPerYear: 1, required: false, probability: 0.5 }],
  },
];

export const SUBJECT_MAP: Record<string, Subject> = Object.fromEntries(SUBJECTS.map((s) => [s.id, s]));

export function subjectsOf(group: CategoryGroup): Subject[] {
  return SUBJECTS.filter((s) => s.group === group);
}

export function subjectName(id: string): string {
  return SUBJECT_MAP[id]?.name ?? id;
}

/** 같은 학원에서 함께 운영하는 경우가 많은 과목 조합 */
export const SUBJECT_PAIRS: Record<string, string[]> = {
  math: ['science', 'english'],
  english: ['math', 'korean'],
  korean: ['essay', 'social'],
  science: ['math'],
  social: ['korean'],
  essay: ['korean'],
  allsubj: ['math', 'english'],
  taekwondo: ['jumprope'],
  boxing: ['kickboxing'],
  kickboxing: ['boxing'],
  jiujitsu: ['kickboxing'],
  soccer: ['basketball'],
  basketball: ['soccer'],
  piano: ['violin'],
  violin: ['piano'],
  guitar: ['drum', 'vocal'],
  drum: ['guitar', 'vocal'],
  vocal: ['guitar'],
  ballet: ['dance'],
  dance: ['acting'],
  pilates: [],
  swim: [],
};
