import type { AgeGroup, CategoryGroup } from '../types';

export const GROUPS: { id: CategoryGroup; name: string; desc: string }[] = [
  { id: 'academic', name: '교과', desc: '국어 · 영어 · 수학 · 과학 · 논술 · 코딩 · 외국어' },
  { id: 'sports', name: '체육', desc: '수영 · 태권도 · 복싱 · 주짓수 · 구기 (교육청 자료 없음)' },
  { id: 'arts', name: '예술', desc: '피아노 · 바이올린 · 미술 · 발레 · 댄스 · 연기' },
];

export const AGE_LABELS: Record<AgeGroup, string> = {
  preschool: '유아',
  elementary: '초등',
  middle: '중등',
  high: '고등',
  adult: '성인',
};

export const AGE_ORDER: AgeGroup[] = ['preschool', 'elementary', 'middle', 'high', 'adult'];

export interface Subject {
  id: string;
  name: string;
  /** 타일에 쓰는 1~2자 약칭 */
  short: string;
  group: CategoryGroup;
  /** 검색어에서 이 과목으로 알아들을 낱말. 여러 과목에 걸치는 말(보습·실용음악·내신 등)은 넣지 않는다 */
  keywords: string[];
  /** 교육청(NEIS) 학원교습소 자료에 있는 분야인지. 체육시설은 체육시설법 대상이라 없다. */
  inNeis: boolean;
}

export const SUBJECTS: Subject[] = [
  // ───────────── 교과 ─────────────
  { id: 'korean', name: '국어', short: '국', group: 'academic', keywords: ['국어', '비문학', '수능국어'], inNeis: true },
  { id: 'english', name: '영어', short: '영', group: 'academic', keywords: ['영어', '영어회화', '토익', '토플', '수능영어', '원어민'], inNeis: true },
  { id: 'math', name: '수학', short: '수', group: 'academic', keywords: ['수학', '수능수학', '사고력수학'], inNeis: true },
  { id: 'science', name: '과학', short: '과', group: 'academic', keywords: ['과학', '물리', '화학', '생명과학', '지구과학'], inNeis: true },
  { id: 'social', name: '사회', short: '사', group: 'academic', keywords: ['사회', '한국사', '역사', '사탐', '윤리', '지리'], inNeis: true },
  { id: 'essay', name: '논술·독서', short: '논', group: 'academic', keywords: ['논술', '독서', '글쓰기', '토론', '대입논술'], inNeis: true },
  { id: 'coding', name: '코딩', short: '코', group: 'academic', keywords: ['코딩', '프로그래밍', '파이썬', '스크래치', '로봇', '정보올림피아드'], inNeis: true },
  { id: 'lang2', name: '제2외국어', short: '외', group: 'academic', keywords: ['중국어', '일본어', '스페인어', 'HSK', 'JLPT', '제2외국어'], inNeis: true },
  { id: 'allsubj', name: '종합(전과목)', short: '종', group: 'academic', keywords: ['전과목', '국영수', '공부방'], inNeis: true },
  // ───────────── 체육 (교육청 자료 없음) ─────────────
  { id: 'swim', name: '수영', short: '수영', group: 'sports', keywords: ['수영', '생존수영', '자유형', '접영', '아쿠아', '스윔'], inNeis: false },
  { id: 'taekwondo', name: '태권도', short: '태권', group: 'sports', keywords: ['태권도', '품새', '겨루기', '시범단'], inNeis: false },
  { id: 'boxing', name: '복싱', short: '복싱', group: 'sports', keywords: ['복싱', '권투', '다이어트복싱'], inNeis: false },
  { id: 'kickboxing', name: '킥복싱', short: '킥', group: 'sports', keywords: ['킥복싱', '무에타이', '입식타격'], inNeis: false },
  { id: 'kendo', name: '검도', short: '검도', group: 'sports', keywords: ['검도', '죽도', '호구', '검술'], inNeis: false },
  { id: 'jiujitsu', name: '주짓수', short: '주짓', group: 'sports', keywords: ['주짓수', '브라질리언주짓수', 'BJJ', '노기', '그래플링'], inNeis: false },
  { id: 'basketball', name: '농구', short: '농구', group: 'sports', keywords: ['농구', '바스켓볼', '스킬트레이닝'], inNeis: false },
  { id: 'soccer', name: '축구', short: '축구', group: 'sports', keywords: ['축구', '풋살', '유소년축구'], inNeis: false },
  { id: 'baseball', name: '야구', short: '야구', group: 'sports', keywords: ['야구', '리틀야구', '베이스볼'], inNeis: false },
  { id: 'jumprope', name: '줄넘기', short: '줄', group: 'sports', keywords: ['줄넘기', '음악줄넘기', '키즈체육'], inNeis: false },
  { id: 'climbing', name: '클라이밍', short: '클라', group: 'sports', keywords: ['클라이밍', '볼더링', '암벽'], inNeis: false },
  { id: 'tennis', name: '테니스', short: '테니', group: 'sports', keywords: ['테니스', '실내테니스'], inNeis: false },
  { id: 'golf', name: '골프', short: '골프', group: 'sports', keywords: ['골프', '스크린골프', '골프레슨'], inNeis: false },
  { id: 'badminton', name: '배드민턴', short: '배드', group: 'sports', keywords: ['배드민턴', '셔틀콕'], inNeis: false },
  { id: 'tabletennis', name: '탁구', short: '탁구', group: 'sports', keywords: ['탁구', '핑퐁'], inNeis: false },
  { id: 'pilates', name: '필라테스', short: '필라', group: 'sports', keywords: ['필라테스', '기구필라테스', '요가'], inNeis: false },
  // ───────────── 예술 ─────────────
  { id: 'piano', name: '피아노', short: '피아', group: 'arts', keywords: ['피아노', '바이엘', '체르니', '입시피아노'], inNeis: true },
  { id: 'violin', name: '바이올린', short: '바이', group: 'arts', keywords: ['바이올린', '첼로', '비올라'], inNeis: true },
  { id: 'guitar', name: '기타', short: '기타', group: 'arts', keywords: ['기타', '통기타', '일렉기타', '우쿨렐레'], inNeis: true },
  { id: 'drum', name: '드럼', short: '드럼', group: 'arts', keywords: ['드럼', '타악기'], inNeis: true },
  { id: 'vocal', name: '보컬', short: '보컬', group: 'arts', keywords: ['보컬', '노래', '발성', '입시보컬'], inNeis: true },
  { id: 'art', name: '미술', short: '미술', group: 'arts', keywords: ['미술', '드로잉', '창의미술', '입시미술', '웹툰'], inNeis: true },
  { id: 'ballet', name: '발레', short: '발레', group: 'arts', keywords: ['발레', '취미발레', '전공발레'], inNeis: true },
  { id: 'dance', name: '방송댄스', short: '댄스', group: 'arts', keywords: ['방송댄스', 'K-POP', '케이팝', '스트릿댄스', '힙합', '댄스'], inNeis: true },
  { id: 'acting', name: '연기', short: '연기', group: 'arts', keywords: ['연기', '뮤지컬', '입시연기'], inNeis: true },
];

export const SUBJECT_MAP: Record<string, Subject> = Object.fromEntries(SUBJECTS.map((s) => [s.id, s]));

export function subjectsOf(group: CategoryGroup): Subject[] {
  return SUBJECTS.filter((s) => s.group === group);
}

export function subjectName(id: string): string {
  return SUBJECT_MAP[id]?.name ?? id;
}
