// 교육청(NEIS) 교습과정 분류기
//
// 교육청 자료의 교습비는 "초등국어(주1회반):65000", "중등내신A(과학):140000", "피아노(초급):170000",
// "HSK2:200000"처럼 과정 이름과 금액만 있다. 앱의 과목·연령과 맞춰 비교하려면 과정 이름,
// 학원 이름, 교육청 분류(교습과정명)에서 과목과 대상 연령을 추정해야 한다.
// 확실하지 않으면 추정하지 않는다(null / 빈 배열) – 틀린 비교보다 빠진 비교가 낫다.

import type { AgeGroup } from '../types';

export interface CourseContext {
  academyName: string;
  realm?: string;
  /** LE_CRSE_NM: 보습, 음악, 미술, 무용, 실용외국어, 컴퓨터 등 */
  courseCategory?: string;
  /** LE_CRSE_LIST_NM: 대표 교습과정 이름 (보통 첫 번째 과정) */
  courseList?: string;
}

export interface ClassifiedCourse {
  course: string;
  price: number;
  subjectId: string | null;
  ages: AgeGroup[];
  /** 과정 이름에 "주2회"처럼 적혀 있으면 */
  sessionsPerWeek?: number;
  /** 통계에서 뺀 이유 (특강·재료비·비정상 금액 등) */
  excluded?: string;
}

// 과정 이름에서 과목을 찾는 규칙. 위에서부터 먼저 맞는 것을 쓴다.
// '수학논술'은 수학, '영어독해'는 영어처럼 주요 교과 이름이 논술·독해보다 우선한다.
// 다만 '역사논술·세계사논술'은 독서논술 학원의 주제 논술 상품이라 논술로 본다.
const SUBJECT_RULES: { id: string; re: RegExp }[] = [
  { id: 'essay', re: /(역사|한국사|학국사|세계사|사회)\S{0,3}논술|논술\S{0,3}(역사|한국사|세계사)|역사하기/ },
  { id: 'math', re: /수학|매쓰|math|연산|사고력|팩토|소마|CMS|해법수학|와이즈만|주산|암산/i },
  { id: 'english', re: /영어|english|잉글|토익|토플|텝스|toeic|toefl|teps|파닉스|phonics|그래머|grammar|원어민/i },
  { id: 'lang2', re: /중국어|일본어|HSK|JLPT|JPT|스페인어|독일어|프랑스어|러시아어|베트남어|아랍어/i },
  { id: 'science', re: /과학|물리|화학|생명과학|생물|지구과학|사이언스|science|과탐/i },
  { id: 'social', re: /사회|역사|한국사|세계사|지리|윤리|사탐|정치|경제/ },
  // '외국어'의 '국어'는 제외
  { id: 'korean', re: /(?<!외)국어|문학|비문학|받아쓰기|한글/ },
  { id: 'essay', re: /논술|독서|글쓰기|토론|문해/ },
  { id: 'coding', re: /코딩|컴퓨터|프로그래밍|파이썬|python|스크래치|엔트리|로봇|소프트웨어|아두이노|ITQ|컴활|정보교과|정보올림/i },
  { id: 'allsubj', re: /종합|전과목|국영수|국\.영\.수|국영수사과/ },
  { id: 'piano', re: /피아노|바이엘|체르니|소나티네|하농|부르크뮐러|piano/i },
  { id: 'violin', re: /바이올린|첼로|비올라|현악|violin|cello/i },
  { id: 'guitar', re: /통기타|일렉기타|클래식기타|기타\s*\(|기타반|기타\s*(초급|중급|고급)|우쿨렐레|우클렐레|guitar|ukulele/i },
  { id: 'drum', re: /드럼|drum|타악/i },
  { id: 'vocal', re: /보컬|성악|발성|노래|vocal/i },
  { id: 'art', re: /미술|드로잉|소묘|수채화|유화|서양화|동양화|한국화|디자인|웹툰|만화|일러스트|조소|크로키/ },
  { id: 'ballet', re: /발레|ballet|무용/i },
  { id: 'dance', re: /댄스|방송|힙합|k-?pop|케이팝|스트릿|걸스힙합|치어/i },
  { id: 'acting', re: /연기|뮤지컬|연극|acting/i },
];

// 교육청 교습과정 분류(LE_CRSE_NM) → 과목. 과정 이름과 학원 이름으로도 못 찾았을 때만 쓴다.
const CATEGORY_RULES: { id: string; re: RegExp }[] = [
  { id: 'lang2', re: /^실용외국어/ },
  { id: 'coding', re: /컴퓨터|정보|소프트웨어|로봇/ },
  { id: 'art', re: /^미술$|디자인/ },
  { id: 'ballet', re: /무용/ },
  { id: 'dance', re: /댄스/ },
  { id: 'vocal', re: /성악/ },
];

// 앱에 해당 과목이 없는 과정 – 학원 과목으로 끼워 맞추지 않는다
// (예: 바이올린 학원의 '작곡입시', 피아노 학원의 '칼림바 초급'·'플룻(중급)')
const NO_APP_SUBJECT_RE =
  /작곡|미디|화성학|시창|청음|한자|바둑|서예|속독|웅변|스피치|칼림바|오카리나|플루트|플룻|클라리넷|색소폰|섹소폰|트럼펫|호른|오보에|관악|하모니카|리코더|단소|가야금|해금|대금|장구|핸드벨/;

// 월 교습비가 아닌 항목. '캠프'·'모의고사'는 정규반 이름에도 쓰여서(독서캠프1, 내신+모의고사반)
// 계절·기간 표시가 있거나 그 항목 자체일 때만 뺀다.
const EXCLUDE_RE = new RegExp(
  [
    '특강',
    '일일',
    '하루',
    '체험',
    '원\\s*데이',
    'one\\s*-?day',
    '교재',
    '재료',
    '상자',
    '(방학|여름|겨울|썸머|서머|윈터|단기|주말|\\d+박)\\S{0,4}캠프',
    '캠프\\s*(참가)?비',
    '^\\s*모의고사',
    '모의고사\\s*(비|응시료?)\\s*$',
    '등록비',
    '입회비',
    '차량',
    '진단',
    '레벨\\s*테스트',
    '상담',
    '컨설팅',
    '병행',
  ].join('|'),
  'i',
);

/** 이 값 이하면 월 교습비가 아니라 회당·일일 금액일 가능성이 높다 */
export const MIN_MONTHLY = 30000;
export const MAX_MONTHLY = 3000000;

function matchSubjects(text: string | undefined): string[] {
  if (!text) return [];
  const found: string[] = [];
  for (const rule of SUBJECT_RULES) if (rule.re.test(text) && !found.includes(rule.id)) found.push(rule.id);
  return found;
}

function matchSubject(text: string | undefined): string | null {
  return matchSubjects(text)[0] ?? null;
}

/** 학원 이름·대표 과정에서 짐작한 과목 (과정 이름에 과목이 없을 때 쓴다) */
export function academySubject(ctx: CourseContext): string | null {
  const fromName = matchSubject(ctx.academyName) ?? matchSubject(ctx.courseList);
  if (fromName) return fromName;
  for (const rule of CATEGORY_RULES) if (ctx.courseCategory && rule.re.test(ctx.courseCategory)) return rule.id;
  // 'OO음악교습소'의 '초급/중급'은 대부분 피아노지만 확신할 수 없으므로 비워 둔다.
  return null;
}

// ───── 대상 연령 ─────
// '초급·중급·고급'(수준), '기초·집중·최고·고시·고흐'처럼 초/중/고 글자가 들어간 단어를
// 학년으로 읽지 않도록, 한 글자 학년 표기는 앞뒤가 구분자일 때만 인정한다: (초), 초/중/고, 유.초등
const SEP_BEFORE = '(?:^|[(,·/.\\s+\\-])';
const SEP_AFTER = '(?=\\s*(?:[,·)/.+\\-]|$))';
const single = (ch: string) => `${SEP_BEFORE}${ch}${SEP_AFTER}`;

/** '예비중'은 초등 6학년, '초등예비'는 7세처럼 '예비'는 한 단계 아래 학년이다 */
const PREP_RULES: { age: AgeGroup; re: RegExp }[] = [
  { age: 'preschool', re: /[예에]비\s*초등?|초등\s*[예에]비/g },
  { age: 'elementary', re: /[예에]비\s*중(등|학)?(?!급)|중등\s*[예에]비/g },
  { age: 'middle', re: /[예에]비\s*고(등|교)?(?!급)|고등\s*[예에]비/g },
];

const AGE_RULES: { age: AgeGroup; re: RegExp }[] = [
  { age: 'preschool', re: new RegExp(`유아|유치|영유아|키즈|kids|[5-7]세|유\\s*[.,·]\\s*초|${single('유')}`, 'i') },
  {
    age: 'elementary',
    re: new RegExp(`초등|초교|(?<![기최])초[1-6](?![0-9])|초저|초고(?!급)|저학년|고학년|어린이|아동|주\\s*니어|junior|초중(등|고)|${single('초')}|${single('저')}`, 'i'),
  },
  { age: 'middle', re: new RegExp(`중등|중학|(?<![집도])중[1-3](?![0-9급])|중고(등|생)|초중(등|고)|${single('중')}`) },
  { age: 'high', re: new RegExp(`고등|고교|(?<![최재])고[1-3](?![0-9급])|중고(등|생)|초중고|재수|N수|${single('고')}`) },
  { age: 'adult', re: /성인|일반인|직장인|대학생|공무원/ },
];

export function detectAges(text: string): AgeGroup[] {
  const ages = new Set<AgeGroup>();
  let rest = text;
  for (const rule of PREP_RULES) {
    if (rule.re.test(rest)) {
      ages.add(rule.age);
      rest = rest.replace(rule.re, ' ');
    }
    rule.re.lastIndex = 0;
  }
  const childContext = /아동|어린이|유아|초등/.test(rest);
  for (const rule of AGE_RULES) {
    // '아동미술1(고)'의 (고)는 고학년이지 고등이 아니다
    if (rule.age === 'high' && childContext && !/고등|고교|고[1-3]/.test(rest)) continue;
    if (rule.re.test(rest)) ages.add(rule.age);
  }
  // 학년이 안 보일 때만 쓰는 약한 단서: 입시·수능 → 고등, 자격증·토익·취미반 → 성인
  if (ages.size === 0 && /입시|수능/.test(rest)) ages.add('high');
  if (ages.size === 0 && /자격증|토익|토플|취미반/.test(rest)) ages.add('adult');
  const order: AgeGroup[] = ['preschool', 'elementary', 'middle', 'high', 'adult'];
  return order.filter((a) => ages.has(a));
}

export function detectSessionsPerWeek(text: string): number | undefined {
  const weekly = text.match(/주\s*([1-7])\s*(?:회|일)(?!\s*(모의고사|테스트|시험))/);
  if (weekly) return Number(weekly[1]);
  // '초등수학(5일반)', '고등수학(3일)'
  const days = text.match(/(?<![월\d])([2-7])\s*일\s*(?:반|\))/);
  return days ? Number(days[1]) : undefined;
}

export function classifyCourse(course: string, price: number, ctx: CourseContext): ClassifiedCourse {
  const fallbackSubject = academySubject(ctx);
  const found = matchSubjects(course);
  let subjectId: string | null;
  if (found.length >= 2 && /[+&]|및|와\s/.test(course) && !found.includes('essay')) {
    // '첼로+피아노'처럼 서로 다른 과목을 묶은 과정은 한 과목 가격으로 볼 수 없다
    subjectId = null;
  } else if (found.length > 0) {
    subjectId = found[0];
  } else {
    subjectId = NO_APP_SUBJECT_RE.test(course) ? null : fallbackSubject;
  }
  // 대상 연령은 과정 이름에서만 찾는다. (교육청의 '대표 과정'은 첫 과정 이름이라 다른 과정에 적용하면 틀린다)
  const ages = detectAges(course);
  const result: ClassifiedCourse = { course, price, subjectId, ages, sessionsPerWeek: detectSessionsPerWeek(course) };
  if (EXCLUDE_RE.test(course)) result.excluded = '특강·재료비 등 월 교습비가 아닌 항목';
  else if (price <= MIN_MONTHLY) result.excluded = '금액이 너무 작음 (회당·일일 요금으로 보임)';
  else if (price > MAX_MONTHLY) result.excluded = '금액이 너무 큼';
  return result;
}
