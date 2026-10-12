// 샘플 학원 데이터 생성기
// 실제 서비스에서는 교육청 신고 교습비, 학원 직접 등록, 사용자 제보 데이터로 대체된다.
// 여기서는 과목별 시세 범위(categories.ts)와 지역 물가 지수(regions.ts)를 바탕으로
// 현실적인 분포를 갖는 가상의 학원을 시드 고정으로 만든다. (모든 이름·주소·전화번호는 가상)

import type {
  Academy,
  AgeGroup,
  CategoryGroup,
  Discount,
  ExtraFee,
  PriceHistoryEntry,
  PricePlan,
  PriceSource,
  Review,
} from '../types';
import { AGE_LABELS, SUBJECT_MAP, SUBJECT_PAIRS, SUBJECTS, type PlanTemplate, type Subject } from './categories';
import { DISTRICTS, type District } from './regions';
import { between, intBetween, mulberry32, pick, roundTo, shuffle, weightedPick, type Rng } from './random';

export const SAMPLE_SEED = 20261012;
/** 샘플 데이터의 기준일 (가격 업데이트일 계산용) */
export const REFERENCE_DATE = '2026-10-01';

const SUBJECT_WEIGHTS: Record<string, number> = {
  math: 3.2, english: 3.2, korean: 1.6, science: 1.3, social: 0.6, essay: 1, coding: 1, lang2: 0.6, allsubj: 1.6,
  swim: 2.2, taekwondo: 2.6, boxing: 1.2, kickboxing: 0.9, kendo: 0.8, jiujitsu: 0.9, basketball: 1.2,
  soccer: 1.5, baseball: 0.8, jumprope: 0.8, climbing: 0.6, tennis: 0.6, golf: 0.6, badminton: 0.6,
  tabletennis: 0.5, pilates: 1.2,
  piano: 2.4, violin: 0.7, guitar: 0.6, drum: 0.5, vocal: 0.6, art: 2.4, ballet: 1, dance: 1.2, acting: 0.4,
};

const PREFIXES = [
  '한빛', '푸른솔', '새솔', '다온', '리더스', '탑클래스', '에이스', '해냄', '바른', '큰나무', '별빛', '하랑',
  '이룸', '늘품', '가온', '누리', '한결', '미래로', '더배움', '온누리', '청람', '해오름', '빛나래', '라온',
  '시냇물', '도담', '아름드리', '꿈나무', '마루', '참길', '솔빛', '단비', '새움', '보람', '다솜', '힘찬',
  '스텝업', '브라이트', '포레스트', '오름', '열매', '지혜의숲', '한울', '든솔', '모아', '그린', '블루밍', '노을',
  '키움', '하늘빛', '새봄', '나래', '은하수', '파란', '두드림', '위드', '하모니', '샛별', '무지개', '튼튼',
];

const AREA_CODES: Record<string, string> = {
  서울: '02', 경기: '031', 부산: '051', 대구: '053', 인천: '032', 광주: '062', 대전: '042', 울산: '052', 세종: '044',
};

const BUILDINGS = ['센트럴빌딩', '스카이타워', '그린프라자', '드림빌딩', '한마음상가', '타운프라자', '미래빌딩', '해밀타워'];

const FEATURES: Record<CategoryGroup, string[]> = {
  academic: ['레벨테스트', '내신대비', '자습실 운영', '학습 리포트', '1:1 클리닉', '숙제 관리', '방학 특강', '온라인 보충'],
  sports: ['샤워실', '락커', '대회 출전', '야간반', '여성반', '키즈 전문', '보호자 대기실', '용품 대여'],
  arts: ['개인 연습실', '정기 발표회', '악기·용품 대여', '성인 취미반', '포트폴리오 관리', '1:1 피드백'],
};

const HOURS: Record<CategoryGroup, string[]> = {
  academic: ['평일 14:00~22:00 · 토 10:00~18:00', '평일 15:00~22:00 · 토 13:00~19:00', '평일 13:00~21:00'],
  sports: ['평일 06:00~23:00 · 토 09:00~18:00', '평일 14:00~22:00 · 토 10:00~17:00', '평일 10:00~22:00 · 주말 10:00~18:00'],
  arts: ['평일 12:00~21:00 · 토 10:00~17:00', '평일 13:00~22:00', '평일 11:00~21:00 · 토 10:00~16:00'],
};

const AGE_WORDS = ['유아', '초등', '중등', '고등', '성인', '키즈', '청소년', '중고등', '주니어', '입시', '전공', '리틀', '엘리트', '1:1', '1:2', '2:1'];

const REVIEW_TEXTS: Record<CategoryGroup, { good: string[]; price: string[]; meh: string[] }> = {
  academic: {
    good: ['선생님이 꼼꼼하게 숙제 체크해 주세요.', '내신 대비 자료가 잘 정리되어 있어요.', '아이가 질문하기 편하다고 해요.', '레벨에 맞게 반을 나눠줘서 좋아요.'],
    price: ['교재비가 따로 들어서 생각보다 조금 더 나와요.', '주변 학원 대비 수업 시간이 길어서 시간당으로 보면 합리적이에요.', '가격은 조금 있지만 관리가 확실합니다.', '형제 할인 받아서 부담이 줄었어요.'],
    meh: ['반 인원이 조금 많은 편이에요.', '주차가 불편해요.', '상담 연락이 조금 느려요.'],
  },
  sports: {
    good: ['코치님이 아이들을 잘 다뤄주세요.', '시설이 깨끗하고 샤워실이 좋아요.', '운동량이 많아서 만족해요.', '초보도 차근차근 가르쳐 줍니다.'],
    price: ['도복·용품비가 초기에 꽤 들어요.', '3개월 등록하면 할인돼서 좋아요.', '심사비가 별도라 연간으로 보면 조금 올라가요.', '이 동네에서 가성비 좋은 편이에요.'],
    meh: ['저녁 시간대는 사람이 많아요.', '차량 시간이 가끔 늦어요.', '주말반이 없어서 아쉬워요.'],
  },
  arts: {
    good: ['아이가 즐겁게 다녀요.', '발표회 준비를 정성껏 해주세요.', '개인 진도에 맞춰 지도해 줍니다.', '선생님이 전공자라 믿음이 가요.'],
    price: ['재료비가 매달 따로 나와요.', '연주회비가 별도라 연간 비용을 따져보세요.', '1:1 치고는 합리적인 가격이에요.', '주5회 기준이라 시간당 단가는 저렴한 편이에요.'],
    meh: ['연습실이 조금 좁아요.', '수업 시간 변경이 어려워요.', '대기 기간이 있었어요.'],
  },
};

const REVIEW_AUTHORS = ['학부모', '수강생', '초등맘', '중등맘', '직장인', '대학생', '재원생 부모', '성인 수강생'];

function addDays(iso: string, days: number): string {
  const dt = new Date(`${iso}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function centered(rng: Rng): number {
  // 0~1 사이, 가운데로 몰리는 분포 (시세 분포를 자연스럽게)
  return (rng() + rng() + rng()) / 3;
}

function planName(tpl: PlanTemplate): string {
  const hasAgeWord = AGE_WORDS.some((w) => tpl.label.startsWith(w));
  if (hasAgeWord || tpl.ages.length !== 1) return tpl.label;
  return `${AGE_LABELS[tpl.ages[0]]} ${tpl.label}`;
}

function priceUnit(billing: PricePlan['billing']): number {
  return billing === 'package' ? 10000 : 5000;
}

function chooseTemplates(rng: Rng, subject: Subject, isPublic: boolean, count: number): PlanTemplate[] {
  let pool = subject.templates;
  if (isPublic) pool = pool.filter((p) => p.classType === 'group');
  const picked = shuffle(rng, pool).slice(0, Math.min(count, pool.length));
  if (!picked.some((p) => p.classType !== 'private')) {
    const groupPlan = pool.find((p) => p.classType !== 'private');
    if (groupPlan) picked[0] = groupPlan;
  }
  // 원래 정의 순서(연령 순)로 정렬
  return pool.filter((p) => picked.includes(p));
}

function makePlan(
  rng: Rng,
  academyId: string,
  subject: Subject,
  tpl: PlanTemplate,
  idx: number,
  factor: number,
): PricePlan {
  let minutes = tpl.minutes;
  let price = tpl.range[0] + (tpl.range[1] - tpl.range[0]) * centered(rng);
  // 수업 시간이 학원마다 조금씩 다르다 → 시간당 단가 비교가 의미를 갖는다.
  if (tpl.classType !== 'private' && rng() < 0.45) {
    const deltas = tpl.minutes >= 90 ? [-30, -10, 10, 30] : [-10, 10];
    const delta = pick(rng, deltas);
    if (minutes + delta >= 40) {
      price *= 1 + (0.5 * delta) / minutes;
      minutes += delta;
    }
  }
  price = roundTo(price * factor, priceUnit(tpl.billing));
  const maxStudents =
    tpl.classType === 'private' ? 1 : Math.max(2, tpl.maxStudents + intBetween(rng, -2, 3) * (tpl.classType === 'small' ? 0 : 1));
  return {
    id: `${academyId}-p${idx}`,
    subjectId: subject.id,
    name: planName(tpl),
    targets: tpl.ages,
    classType: tpl.classType,
    maxStudents,
    billing: tpl.billing,
    price,
    sessionsPerWeek: tpl.sessionsPerWeek,
    minutesPerSession: minutes,
    months: tpl.months,
    totalSessions: tpl.totalSessions,
    unlimited: tpl.unlimited,
  };
}

function makeExtras(rng: Rng, academyId: string, subjects: Subject[], targets: AgeGroup[], isPublic: boolean): ExtraFee[] {
  const fees: ExtraFee[] = [];
  const seen = new Set<string>();
  for (const subject of subjects) {
    for (const tpl of subject.extras) {
      if (seen.has(tpl.name)) continue;
      if (tpl.ages && !tpl.ages.some((a) => targets.includes(a))) continue;
      if (isPublic && (tpl.name === '등록비' || tpl.name.includes('셔틀'))) continue;
      if (rng() > tpl.probability) continue;
      seen.add(tpl.name);
      const unit = tpl.range[1] >= 100000 ? 10000 : 5000;
      fees.push({
        id: `${academyId}-f${fees.length}`,
        name: tpl.name,
        amount: Math.max(unit, roundTo(between(rng, tpl.range[0], tpl.range[1]), unit)),
        frequency: tpl.frequency,
        timesPerYear: tpl.timesPerYear,
        required: tpl.required,
        note: tpl.note,
      });
    }
  }
  return fees;
}

function makeDiscounts(rng: Rng, academyId: string, group: CategoryGroup, multiSubject: boolean, isPublic: boolean): Discount[] {
  const out: Discount[] = [];
  const add = (dsc: Omit<Discount, 'id'>) => out.push({ id: `${academyId}-d${out.length}`, ...dsc });
  if (isPublic) {
    if (rng() < 0.6) add({ type: 'sibling', label: '다자녀·지역주민 할인 20%', percent: 20 });
    return out;
  }
  if (rng() < 0.45) {
    if (rng() < 0.5) {
      const pct = pick(rng, [5, 10]);
      add({ type: 'sibling', label: `형제·자매 할인 ${pct}%`, percent: pct });
    } else {
      const amt = pick(rng, [10000, 20000]);
      add({ type: 'sibling', label: `형제·자매 월 ${amt / 10000}만원 할인`, amount: amt });
    }
  }
  const prepayChance = group === 'sports' ? 0.5 : group === 'arts' ? 0.25 : 0.15;
  if (rng() < prepayChance) {
    const months = pick(rng, [3, 6]);
    const pct = months === 3 ? pick(rng, [5, 7]) : pick(rng, [10, 12]);
    add({ type: 'prepay', label: `${months}개월 선납 ${pct}% 할인`, percent: pct, months });
  }
  if (multiSubject && rng() < 0.6) add({ type: 'multi_subject', label: '2과목 이상 수강 10% 할인', percent: 10 });
  if (rng() < 0.15) add({ type: 'first_month', label: '첫 달 수강료 20% 할인', percent: 20 });
  if (rng() < 0.1) add({ type: 'card', label: '제휴카드 결제 5% 할인', percent: 5 });
  return out;
}

function makeReviews(rng: Rng, academyId: string, group: CategoryGroup, rating: number, priceSat: number): Review[] {
  const pool = REVIEW_TEXTS[group];
  const n = intBetween(rng, 3, 5);
  const reviews: Review[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.max(2, Math.min(5, Math.round(rating + between(rng, -1, 0.8))));
    const p = Math.max(1, Math.min(5, Math.round(priceSat + between(rng, -1, 0.8))));
    const parts = [pick(rng, r >= 4 ? pool.good : pool.meh), pick(rng, pool.price)];
    reviews.push({
      id: `${academyId}-r${i}`,
      author: pick(rng, REVIEW_AUTHORS),
      rating: r,
      priceSatisfaction: p,
      date: addDays(REFERENCE_DATE, -intBetween(rng, 3, 400)),
      text: parts.join(' '),
    });
  }
  return reviews.sort((a, b) => b.date.localeCompare(a.date));
}

function makeHistory(rng: Rng, plans: PricePlan[]): PriceHistoryEntry[] {
  const history: PriceHistoryEntry[] = [];
  for (const plan of plans.slice(0, 2)) {
    let price = plan.price;
    const points = intBetween(rng, 2, 4);
    const year = 2026;
    history.push({ date: `${year}-03`, planId: plan.id, price });
    for (let i = 1; i < points; i++) {
      price = roundTo(price / (1 + between(rng, 0.02, 0.08)), priceUnit(plan.billing));
      history.push({ date: `${year - i}-03`, planId: plan.id, price });
    }
  }
  return history.sort((a, b) => a.date.localeCompare(b.date));
}

function pickSource(rng: Rng, group: CategoryGroup): PriceSource {
  // 체육도장·수영장 등은 학원법이 아니라 체육시설법 적용 → 교육청 신고 대상이 아니다.
  if (group === 'sports') return rng() < 0.7 ? 'academy' : 'user_report';
  const r = rng();
  if (r < 0.65) return 'education_office';
  return r < 0.9 ? 'academy' : 'user_report';
}

function makeName(rng: Rng, subject: Subject, district: District, dong: string, isPublic: boolean, used: Set<string>): string {
  if (isPublic) {
    const base = `구립 ${pick(rng, PREFIXES)}스포츠센터`;
    return used.has(base) ? `${base} ${dong}` : base;
  }
  for (let attempt = 0; attempt < 6; attempt++) {
    const prefix = pick(rng, PREFIXES);
    const suffix = pick(rng, subject.nameSuffixes);
    const joiner = /^[A-Za-z]/.test(suffix) || suffix.includes(' ') ? ' ' : '';
    let name = `${prefix}${joiner}${suffix}`;
    if (rng() < 0.15) name = `${name} ${dong.replace(/\d?동$/, '')}점`;
    if (!used.has(name)) return name;
  }
  return `${pick(rng, PREFIXES)}${subject.nameSuffixes[0]} ${district.sigungu.split(' ').pop()}`;
}

function makeAcademy(rng: Rng, district: District, idx: number, used: Set<string>): Academy {
  // 시군구 코드 기반이라 지역 목록 순서가 바뀌어도 id 가 유지된다
  const id = `a${district.code}-${idx}`;
  const subject = weightedPick(rng, SUBJECTS, (s) => SUBJECT_WEIGHTS[s.id] ?? 1);
  const group = subject.group;
  const isPublic = Boolean(subject.hasPublic) && rng() < 0.18;
  const dong = pick(rng, district.dongs);
  const name = makeName(rng, subject, district, dong, isPublic, used);
  used.add(name);

  const subjects: Subject[] = [subject];
  const pairs = SUBJECT_PAIRS[subject.id] ?? [];
  if (!isPublic && pairs.length && rng() < 0.3) subjects.push(SUBJECT_MAP[pick(rng, pairs)]);

  // 학원 단위 가격 성향(프리미엄/가성비) × 지역 지수
  const premium = isPublic ? between(rng, 0.55, 0.7) : 0.82 + centered(rng) * 0.4;
  const plans: PricePlan[] = [];
  subjects.forEach((subj, si) => {
    const regional = 1 + (district.priceIndex - 1) * subj.regionSensitivity;
    const count = si === 0 ? intBetween(rng, 2, Math.min(5, subj.templates.length)) : intBetween(rng, 1, 2);
    for (const tpl of chooseTemplates(rng, subj, isPublic, count)) {
      plans.push(makePlan(rng, id, subj, tpl, plans.length, premium * regional));
    }
  });

  const targets = Array.from(new Set(plans.flatMap((p) => p.targets)));
  const shuttleChance = subject.id === 'taekwondo' ? 0.9 : group === 'sports' ? 0.45 : group === 'academic' ? 0.35 : 0.3;
  const shuttle = !isPublic && targets.some((a) => a !== 'adult') && rng() < shuttleChance;
  const extraFees = makeExtras(rng, id, subjects, targets, isPublic);
  const parking = isPublic || rng() < (group === 'sports' ? 0.55 : 0.35);
  const trialAvailable = rng() < (group === 'academic' ? 0.5 : 0.7);
  const trialPrice = trialAvailable && rng() > 0.6 ? pick(rng, [10000, 15000, 20000]) : 0;

  const features = new Set<string>(shuffle(rng, FEATURES[group]).slice(0, intBetween(rng, 2, 4)));
  if (shuttle) features.add(extraFees.some((f) => f.name.includes('차량') || f.name.includes('셔틀')) ? '차량운행' : '차량 무료운행');
  if (trialAvailable) features.add(trialPrice ? '유료 체험수업' : '무료 체험수업');
  if (parking) features.add('주차가능');
  if (plans.some((p) => p.classType === 'small')) features.add('소수정예');
  if (plans.some((p) => p.classType === 'private')) features.add('1:1 레슨');
  if (isPublic) features.add('공공시설');

  const rating = Math.round(between(rng, 3.6, 4.9) * 10) / 10;
  const priceSatisfaction = Math.round(Math.max(2.5, Math.min(4.9, 4.4 - (premium - 1) * 3 + between(rng, -0.4, 0.4))) * 10) / 10;
  const areaCode = AREA_CODES[district.sido] ?? '02';
  const subjectNames = subjects.map((s) => s.name).join('·');

  const descriptions: Record<CategoryGroup, string> = {
    academic: `${dong}에 위치한 ${subjectNames} 전문 학원입니다. 레벨별 반 편성과 정기 테스트로 학습 상태를 관리합니다.`,
    sports: isPublic
      ? `${district.sigungu}에서 운영하는 공공 체육시설로 ${subjectNames} 강습을 저렴하게 운영합니다. 추첨·선착순 접수가 있을 수 있습니다.`
      : `${dong} ${subjectNames} 전문 체육관입니다. 연령·수준별 반을 운영하며 초보자도 기초부터 배울 수 있습니다.`,
    arts: `${dong}의 ${subjectNames} 교육 공간입니다. 개인 진도에 맞춘 지도와 정기 발표 기회를 제공합니다.`,
  };

  return {
    id,
    name,
    group,
    subjectIds: subjects.map((s) => s.id),
    region: { sido: district.sido, sigungu: district.sigungu, dong },
    address: `${district.sido} ${district.sigungu} ${dong} ${intBetween(rng, 10, 980)}-${intBetween(rng, 1, 40)} ${pick(rng, BUILDINGS)} ${intBetween(rng, 1, 6)}층`,
    lat: district.lat + between(rng, -0.018, 0.018),
    lng: district.lng + between(rng, -0.022, 0.022),
    phone: `${areaCode}-0000-${String(intBetween(rng, 1000, 9999))}`,
    description: descriptions[group],
    targets,
    features: Array.from(features),
    shuttle,
    parking,
    trialClass: { available: trialAvailable, price: trialPrice },
    isPublic,
    plans,
    extraFees,
    discounts: makeDiscounts(rng, id, group, subjects.length > 1, isPublic),
    rating,
    reviewCount: intBetween(rng, 3, 320),
    priceSatisfaction,
    reviews: makeReviews(rng, id, group, rating, priceSatisfaction),
    priceSource: isPublic ? 'academy' : pickSource(rng, group),
    priceUpdatedAt: addDays(REFERENCE_DATE, -intBetween(rng, 0, 200)),
    priceHistory: makeHistory(rng, plans),
    teacherCount: isPublic ? intBetween(rng, 4, 12) : intBetween(rng, 1, group === 'academic' ? 15 : 6),
    establishedYear: intBetween(rng, 1998, 2025),
    hours: pick(rng, HOURS[group]),
  };
}

const METRO_SIDO = new Set(['부산', '대구', '인천', '광주', '대전', '울산', '세종']);

/** 지역 규모에 맞춘 학원 수: 서울 자치구 > 광역시·경기 > 도 지역 시 > 군 */
export function academyCount(district: District): number {
  if (district.isGun) return 8;
  if (district.sido === '서울') return 34;
  if (METRO_SIDO.has(district.sido) || district.sido === '경기') return 18;
  return 14;
}

export function generateAcademies(seed = SAMPLE_SEED): Academy[] {
  const rng = mulberry32(seed);
  const academies: Academy[] = [];
  for (const district of DISTRICTS) {
    const used = new Set<string>();
    const count = academyCount(district);
    for (let i = 0; i < count; i++) academies.push(makeAcademy(rng, district, i, used));
  }
  return academies;
}
