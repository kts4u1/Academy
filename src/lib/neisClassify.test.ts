import { describe, expect, it } from 'vitest';
import { classifyCourse, detectAges, detectSessionsPerWeek } from './neisClassify';

// 교육청 자료에서 실제로 보이는 과정 이름들
const ctx = (academyName: string, courseCategory = '보습') => ({ academyName, courseCategory });

describe('과목 분류', () => {
  it.each([
    ['초등국어(주1회반)', '글숲국어교습소', 'korean'],
    ['중등내신A(과학)', '앨리스실험과학교습소', 'science'],
    ['피아노(초급)', '블루밍피아노교습소', 'piano'],
    ['체르니30', '루나피아노음악교습소', 'piano'],
    ['HSK2', '차이랑중국어교습소', 'lang2'],
    ['독서논술(초등1)', '어린이독서논술교습소', 'essay'],
    ['수학논술1-1', '개념탄탄수학논술교습소', 'math'],
    ['고등A', '봉덕하연과학교습소', 'science'], // 과정 이름에 과목이 없으면 학원 이름으로
    ['미술(초급)', '그림나라미술교습소', 'art'],
    ['바이올린 초급 A', '아마빌레바이올린음악교습소', 'violin'],
  ])('%s (%s) → %s', (course, academy, expected) => {
    expect(classifyCourse(course, 150000, ctx(academy)).subjectId).toBe(expected);
  });

  it('규칙 겹침: 중국어·원어민중국어·방송연기', () => {
    expect(classifyCourse('중국어+HSK', 200000, ctx('밍중국어교습소')).subjectId).toBe('lang2');
    expect(classifyCourse('원어민중국어', 200000, ctx('밍중국어교습소')).subjectId).toBe('lang2');
    expect(classifyCourse('방송연기', 200000, ctx('스타연기교습소', '기타')).subjectId).toBe('acting');
  });

  it('학원 이름에 과목이 여럿이면 과목 없는 과정은 비워 둔다', () => {
    expect(classifyCourse('중등반', 250000, ctx('한빛수학영어교습소')).subjectId).toBeNull();
    expect(classifyCourse('중등수학', 250000, ctx('한빛수학영어교습소')).subjectId).toBe('math');
  });

  it("'외국어'를 국어로 보지 않는다", () => {
    expect(classifyCourse('실용외국어9', 150000, ctx('다한영어교습소', '실용외국어(유아/초·중·고)')).subjectId).toBe('english');
  });

  it('외국어 학원의 회화는 그 외국어', () => {
    expect(classifyCourse('기초회화', 175000, ctx('차이랑중국어교습소')).subjectId).toBe('lang2');
  });

  it('앱에 없는 과목은 학원 과목으로 끼워 맞추지 않는다', () => {
    expect(classifyCourse('작곡입시', 500000, ctx('강남아첼바이올린음악교습소', '음악')).subjectId).toBeNull();
  });

  it('과목을 알 수 없으면 비워 둔다', () => {
    expect(classifyCourse('고급2', 190000, ctx('아름음악교습소', '음악')).subjectId).toBeNull();
  });
});

describe('대상 연령', () => {
  it('학년 표기', () => {
    expect(detectAges('초등국어')).toEqual(['elementary']);
    expect(detectAges('국어고1')).toEqual(['high']);
    expect(detectAges('중학특강반(중1)')).toEqual(['middle']);
    expect(detectAges('독서논술(초,중등)1')).toEqual(['elementary', 'middle']);
    expect(detectAges('피아노입시')).toEqual(['high']);
    expect(detectAges('유아수학')).toEqual(['preschool']);
  });

  it('수준(초급·중급·고급)을 학년으로 착각하지 않는다', () => {
    expect(detectAges('피아노 초급1')).toEqual([]);
    expect(detectAges('바이올린 중급 A')).toEqual([]);
    expect(detectAges('그림미술(모네3) 고급')).toEqual([]);
    expect(detectAges('고급독해')).toEqual([]);
  });

  it('주당 횟수', () => {
    expect(detectSessionsPerWeek('초등국어(주2회반)')).toBe(2);
    expect(detectSessionsPerWeek('고등부 주 3회')).toBe(3);
    expect(detectSessionsPerWeek('고등국어B')).toBeUndefined();
  });
});

describe('검증에서 찾은 오분류 (실제 교육청 과정 이름)', () => {
  it.each([
    ['그림미술(고흐1) 고급', []],
    ['바이올린(고시)', []],
    ['컴퓨터(기초)', []],
    ['초급 중국어기초2', []],
    ['피아노(집중)', []],
    ['내국인(초/중/고)B', ['elementary', 'middle', 'high']],
    ['중고등미술', ['middle', 'high']],
    ['미술(유.초등)', ['preschool', 'elementary']],
    ['독서논술(초등예비)', ['preschool']],
    ['중3(예비고등반)', ['middle']],
    ['에비중', ['elementary']],
    ['수능트레이닝기본(중)', ['middle']],
    ['피아노 입시 전공 (초등학생)', ['elementary']],
    ['피아노 중등 입시', ['middle']],
    ['초등 자격증 A(외국인)', ['elementary']],
    ['중등 취미반 (중급)', ['middle']],
    ['중국어 HSK 자격증 A', ['adult']],
    ['아동미술1(고)', ['elementary']],
    ['아동미술1(저)', ['elementary']],
    ['중국어주 니어A', ['elementary']],
  ] as const)('%s → %j', (course, expected) => {
    expect(detectAges(course)).toEqual(expected);
  });

  it('앱에 없는 악기·복수 과목 묶음은 과목을 비운다', () => {
    expect(classifyCourse('칼림바입시', 80000, ctx('늘피아노음악교습소', '음악')).subjectId).toBeNull();
    expect(classifyCourse('플룻(중급)', 130000, ctx('맑은소리피아노음악교습소', '음악')).subjectId).toBeNull();
    expect(classifyCourse('첼로+피아노', 200000, ctx('이음음악교습소', '음악')).subjectId).toBeNull();
  });

  it('역사·세계사 논술은 논술', () => {
    expect(classifyCourse('초등역사논술A', 70000, ctx('책바라기논술교습소')).subjectId).toBe('essay');
    expect(classifyCourse('초등논술세계사', 130000, ctx('한우리독서토론논술교습소')).subjectId).toBe('essay');
    expect(classifyCourse('역사하기(논술)', 100000, ctx('플라톤독서토론논술교습소')).subjectId).toBe('essay');
  });

  it("'N일반'도 주당 횟수", () => {
    expect(detectSessionsPerWeek('초등수학(5일반)')).toBe(5);
    expect(detectSessionsPerWeek('고등수학(3일)')).toBe(3);
    expect(detectSessionsPerWeek('고등부(내신+수능 주1회 모의고사)')).toBeUndefined();
  });

  it('정규반 이름의 캠프·모의고사는 빼지 않고, 원데이·진단·병행은 뺀다', () => {
    expect(classifyCourse('초등논술독서캠프1', 88000, ctx('플라톤독서토론논술교습소')).excluded).toBeUndefined();
    expect(classifyCourse('고등부(내신+수능 주1회 모의고사)', 300000, ctx('영어교습소')).excluded).toBeUndefined();
    expect(classifyCourse('겨울방학캠프', 300000, ctx('영어교습소')).excluded).toBeTruthy();
    expect(classifyCourse('원데이클래스 (고급)A', 50000, ctx('미술교습소')).excluded).toBeTruthy();
    expect(classifyCourse('학습전략진단(중)', 60000, ctx('국어교습소')).excluded).toBeTruthy();
    expect(classifyCourse('초등교과논술(병행)', 43000, ctx('논술교습소')).excluded).toBeTruthy();
    expect(classifyCourse('바이올린', 30000, ctx('바이올린교습소')).excluded).toBeTruthy();
  });
});

describe('비교 제외 항목', () => {
  it('특강·재료비·작은 금액', () => {
    expect(classifyCourse('일일특강 초급', 7500, ctx('코딩교습소')).excluded).toBeTruthy();
    expect(classifyCourse('과학실험상자', 0, ctx('과학교습소')).excluded).toBeTruthy();
    expect(classifyCourse('초등A', 25000, ctx('과학교습소')).excluded).toBeTruthy();
    expect(classifyCourse('초등수학', 200000, ctx('수학교습소')).excluded).toBeUndefined();
  });
});
