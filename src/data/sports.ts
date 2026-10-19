// 국민체육진흥공단 공공데이터 → 앱의 학원 형식(RealAcademy). scripts/fetch-sports.ts 가 받은 원자료를 buildData 가 가공할 때 쓴다.
//
// - 스포츠강좌이용권 등록시설 + 등록강좌: 강좌별 결제금액이 있는 체육시설 (저소득층 유·청소년 바우처 가맹 시설만)
// - 전국체육시설 정보: 시·군·구에 신고·등록된 체육시설과 공공 수영장·테니스장 목록 (금액 없음)
//
// 바우처 강좌 금액의 절반 가까이는 월 지원 한도(2026년 105,000원)에 맞춰져 있어 시장 가격으로 보기 어렵다.
// 그런 강좌는 목록에는 보여 주되 시세·비교에서는 뺀다(voucherCap). 한도의 2~3배(여러 달 치 결제)도 뺀다.

import { stableName } from '../lib/hash';
import { detectAges, detectSessionsPerWeek, isNonMonthlyCourseName } from '../lib/neisClassify';
import type { Course, RealAcademy } from '../lib/realData';
import type { AgeGroup } from '../types';
import { resolveAddressDistrict } from './regions';

export type SportsRow = Record<string, string>;

/** .sports-raw 에 보관하는 원자료 */
export interface SportsSnapshot {
  fetchedAt: string;
  courses: SportsRow[];
  facilities: SportsRow[];
  national: SportsRow[];
}

/** 스포츠강좌이용권 종목명 → 앱 과목. 무용·댄스는 교육청 학원 자료와 섞이지 않게 넣지 않는다 */
export const VOUCHER_ITEM_SUBJECT: Record<string, string> = {
  태권도: 'taekwondo',
  수영: 'swim',
  복싱: 'boxing',
  검도: 'kendo',
  주짓수: 'jiujitsu',
  합기도: 'hapkido',
  유도: 'judo',
  농구: 'basketball',
  '축구(풋살)': 'soccer',
  축구: 'soccer',
  야구: 'baseball',
  줄넘기: 'jumprope',
  클라이밍: 'climbing',
  '클라이밍(암벽등반)': 'climbing',
  테니스: 'tennis',
  골프: 'golf',
  배드민턴: 'badminton',
  탁구: 'tabletennis',
  필라테스: 'pilates',
  요가: 'pilates',
};

/** 종목이 '기타종목'·'종합체육시설'처럼 넓거나 법정 분류에 없는 종목(킥복싱)은 이름으로 찾는다. 앞쪽이 우선 */
const NAME_SUBJECT_RULES: { id: string; re: RegExp }[] = [
  { id: 'kickboxing', re: /킥\s*복싱|무에타이|입식\s*타격/ },
  { id: 'jiujitsu', re: /주짓수|주지츠|jiu\s*-?jitsu|bjj/i },
  { id: 'jumprope', re: /줄넘기/ },
  { id: 'climbing', re: /클라이밍|볼더링|암벽/ },
  { id: 'pilates', re: /필라테스|요가/ },
  { id: 'taekwondo', re: /태권도/ },
  { id: 'boxing', re: /복싱|권투/ },
  { id: 'kendo', re: /검도/ },
  { id: 'hapkido', re: /합기도/ },
  { id: 'judo', re: /유도(?!\s*관)/ },
  { id: 'swim', re: /수영|스위밍|swim/i },
  { id: 'soccer', re: /축구|풋살/ },
  { id: 'basketball', re: /농구|바스켓/ },
  { id: 'baseball', re: /야구|베이스볼/ },
  { id: 'badminton', re: /배드민턴/ },
  { id: 'tabletennis', re: /탁구/ },
  { id: 'tennis', re: /테니스/ },
  { id: 'golf', re: /골프/ },
];

export function subjectFromName(text: string): string | null {
  for (const r of NAME_SUBJECT_RULES) if (r.re.test(text)) return r.id;
  return null;
}

/** 비대면(온라인) 종목 코드: 대면 코드와 짝으로 80~108 */
export function isOnlineItem(itemCd: string): boolean {
  const n = Number(itemCd);
  return Number.isFinite(n) && n >= 80 && n <= 108;
}

const decodeEntities = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

const priceOf = (v: string | undefined) => {
  const n = Math.round(Number(String(v ?? '').replace(/,/g, '')));
  return Number.isFinite(n) ? n : 0;
};

/**
 * 바우처 월 지원 한도: 강좌 금액 가운데 가장 흔한 금액이 20% 넘게 몰려 있으면 그 금액으로 본다.
 * (해마다 한도가 바뀌어도 자료에서 알아낸다)
 */
export function detectVoucherCap(courses: SportsRow[]): number | null {
  const counts = new Map<number, number>();
  let total = 0;
  for (const c of courses) {
    if (isOnlineItem(c.item_cd)) continue;
    const p = priceOf(c.settl_amt);
    if (p <= 0) continue;
    counts.set(p, (counts.get(p) ?? 0) + 1);
    total++;
  }
  let best: [number, number] | null = null;
  for (const e of counts) if (!best || e[1] > best[1]) best = e;
  return best && total > 0 && best[1] / total >= 0.2 ? best[0] : null;
}

const MULTI_MONTH_RE = /(?:[2-9]|1[0-2])\s*개월|분기|학기|당겨\s*쓰기/;
/** '10회권', '12회' 같은 회차권 ('주3회', '주 5회권', '월 4회'는 월 수강료) */
const PASS_RE = /(?<!주\s*)\d+\s*회\s*권|(?<![주월]\s*)[1-9]\d\s*회/;
const ADDON_RE = /추가\s*(결제|금|요금|비)?|대여료|장비\s*대여/;
/** 1:1·개인 레슨 ('1:10', '1:15' 같은 정원 표기나 '그룹PT'는 아님) */
const PRIVATE_RE = /(?<![\d:])1\s*(:|대)\s*1(?![\d])|개인\s*(레슨|지도|강습|수업|운동|PT)|(?<!그룹\s*|단체\s*|소그룹\s*)(\bPT\b|피티)|퍼스널|프라이빗/i;

export const MIN_SPORTS_PRICE = 10000;
const YOUTH_AGES: AgeGroup[] = ['preschool', 'elementary', 'middle', 'high'];
export const MAX_SPORTS_PRICE = 1000000;

export function classifySportsCourse(name: string, price: number, cap: number | null): Pick<Course, 'excluded' | 'private' | 'voucherCap'> {
  const out: Pick<Course, 'excluded' | 'private' | 'voucherCap'> = {};
  if (isNonMonthlyCourseName(name)) out.excluded = '특강·체험 등 월 수강료가 아닌 항목';
  else if (MULTI_MONTH_RE.test(name)) out.excluded = '여러 달 치를 묶은 금액';
  else if (PASS_RE.test(name)) out.excluded = '회차권 (월 수강료가 아님)';
  else if (ADDON_RE.test(name)) out.excluded = '추가 요금·대여료';
  else if (price < MIN_SPORTS_PRICE) out.excluded = '금액이 너무 작음 (회당·추가 요금으로 보임)';
  else if (price > MAX_SPORTS_PRICE) out.excluded = '금액이 너무 큼';
  else if (cap && (price === cap * 2 || price === cap * 3)) out.excluded = '바우처 여러 달 치(한도의 2~3배)를 한 번에 결제한 금액으로 보임';
  if (PRIVATE_RE.test(name)) out.private = true;
  if (cap && price === cap) out.voucherCap = true;
  return out;
}

/** 주소 괄호 속 동: '… 2층 (대흥동)' → '대흥동' */
function dongIn(text: string): string {
  const m = text.match(/\(([가-힣0-9]+?(?:동|읍|면|가|리))\)/);
  return m ? m[1].replace(/\d+(?=동$)/, '') : '';
}

function locate(roadAddress: string, extra: string, hint?: { sido?: string; sigungu?: string }): { sido: string; sigungu: string; unassigned?: boolean } | null {
  if (!roadAddress && !hint?.sigungu) return null;
  return resolveAddressDistrict(roadAddress, `${roadAddress} ${extra}`, hint);
}

function subjectsOf(courses: Course[], fallback: (string | null)[]): string[] {
  const fromCourses = courses.filter((c) => c.subjectId && !c.excluded).map((c) => c.subjectId!);
  const list = fromCourses.length ? fromCourses : fallback.filter((x): x is string => Boolean(x));
  return Array.from(new Set(list));
}

/** 스포츠강좌이용권 등록시설 + 등록강좌 → 강좌 금액이 있는 체육시설 */
export function voucherAcademies(snap: SportsSnapshot, cap = detectVoucherCap(snap.courses)): RealAcademy[] {
  const byFacility = new Map<string, SportsRow[]>();
  for (const c of snap.courses) {
    if (isOnlineItem(c.item_cd)) continue;
    const key = `${c.brno}|${c.facil_sn}`;
    const list = byFacility.get(key);
    if (list) list.push(c);
    else byFacility.set(key, [c]);
  }
  const out: RealAcademy[] = [];
  for (const f of snap.facilities) {
    const rows = byFacility.get(`${f.brno}|${f.facil_sn}`);
    if (!rows?.length) continue;
    const name = decodeEntities(f.facil_nm ?? '');
    const detail = decodeEntities(f.faci_daddr ?? '');
    const road = decodeEntities(f.road_addr ?? '');
    const place = locate(road, detail, { sido: f.city_nm, sigungu: f.local_nm });
    // 이름 대신 사업자번호 같은 숫자만 적힌 곳은 넣지 않는다
    if (!name || /^[\d\s-]+$/.test(name) || !place) continue;
    const facilitySubject = VOUCHER_ITEM_SUBJECT[f.main_event_nm] ?? subjectFromName(name);
    const seen = new Set<string>();
    const courses: Course[] = [];
    for (const r of rows) {
      const courseName = decodeEntities(r.course_nm ?? '');
      const price = priceOf(r.settl_amt);
      if (!courseName || price <= 0) continue;
      // 킥복싱은 법정 종목이 아니라 복싱·기타종목으로 등록되어 이름으로 가린다
      const byItem = VOUCHER_ITEM_SUBJECT[r.item_nm];
      const byName = subjectFromName(courseName);
      let subjectId: string | null = byName === 'kickboxing' && (!byItem || ['boxing', 'jiujitsu', 'hapkido'].includes(byItem)) ? 'kickboxing' : (byItem ?? null);
      if (!subjectId && ['기타종목', '종합체육시설', '헬스'].includes(r.item_nm)) subjectId = byName;
      if (!subjectId) continue; // 앱에 없는 종목(헬스·볼링·승마·무용 등)
      const key = `${courseName}|${price}|${subjectId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const sessions = detectSessionsPerWeek(courseName);
      const ages = detectAges(courseName);
      courses.push({
        name: courseName,
        price,
        subjectId,
        // 스포츠강좌이용권은 유·청소년(만 5~18세) 대상이라 대상이 적혀 있지 않으면 유아~고등으로 본다
        ages: ages.length ? ages : YOUTH_AGES,
        ...(sessions ? { sessionsPerWeek: sessions } : {}),
        ...classifySportsCourse(courseName, price, cap),
      });
    }
    if (courses.length === 0) continue;
    out.push({
      id: `kv-${stableName(`${f.brno}|${f.facil_sn}`)}`,
      name,
      kind: '체육시설',
      source: 'voucher',
      sido: place.sido,
      sigungu: place.sigungu,
      ...(place.unassigned ? { unassigned: true } : {}),
      dong: dongIn(detail) || dongIn(road),
      address: detail ? `${road} ${detail}` : road,
      phone: '',
      realm: '스포츠강좌이용권',
      category: decodeEntities(f.main_event_nm ?? ''),
      capacity: null,
      established: '',
      // 받은 날짜는 manifest.sports.fetchedAt 에만 둔다 (매주 모든 파일 내용이 바뀌어 휴대폰 보관본을 다시 받지 않게)
      loadedAt: '',
      courses,
      subjects: subjectsOf(courses, [facilitySubject]),
    });
  }
  return out;
}

const DOJANG_TYPE: Record<string, string> = { 태권도: 'taekwondo', 권투: 'boxing', 검도: 'kendo', 합기도: 'hapkido', 유도: 'judo' };
const LESSON_TYPE: Record<string, string> = { 축구: 'soccer', 줄넘기: 'jumprope', 농구: 'basketball', 야구: 'baseball', 배드민턴: 'badminton', 수영: 'swim' };

/** 전국체육시설 정보의 업종·시설유형 → 앱 과목 (금액이 없는 시설 목록) */
function facilitySubject(r: SportsRow): string | null {
  const fcob = r.fcob_nm ?? '';
  const ftype = r.ftype_nm ?? '';
  const name = r.faci_nm ?? '';
  const byName = subjectFromName(name);
  switch (fcob) {
    case '체육도장업': {
      // 주짓수·킥복싱·MMA 는 권투·레슬링·합기도·유도 등으로 신고되어 상호로 가린다
      if (byName === 'kickboxing' || byName === 'jiujitsu' || byName === 'jumprope') return byName;
      const t = DOJANG_TYPE[ftype];
      return t ?? byName;
    }
    case '체육교습업': {
      const t = LESSON_TYPE[ftype];
      return t ?? byName;
    }
    case '수영장업':
    case '수영장':
      return 'swim';
    case '인공암벽장업':
      return 'climbing';
    case '골프연습장업':
      // 스크린골프는 레슨 시설로 보기 어려워 넣지 않는다
      return ftype === '스크린' ? null : 'golf';
    case '테니스장':
      return 'tennis';
    case '체력단련장업':
    case '종합체육시설업':
      // 필라테스·복싱·킥복싱처럼 이름에 종목이 있는 곳만
      return byName && ['pilates', 'boxing', 'kickboxing', 'jiujitsu', 'climbing', 'swim'].includes(byName) ? byName : null;
    default:
      return null;
  }
}

/** 전국체육시설 정보 → 시·군·구 신고 체육시설 목록 (정상운영, 앱 과목이 있는 곳만) */
export function facilityAcademies(snap: SportsSnapshot): RealAcademy[] {
  const out: RealAcademy[] = [];
  const fallbackDate = snap.fetchedAt.slice(0, 10);
  for (const r of snap.national) {
    if (r.faci_stat_nm !== '정상운영') continue;
    // 공공시설은 강습이 있는 수영장·테니스장만 (간이운동장·축구장 등은 대관 위주)
    if (r.faci_gb_nm === '공공' && !['수영장', '테니스장', '인공암벽장업'].includes(r.fcob_nm)) continue;
    const subject = facilitySubject(r);
    if (!subject) continue;
    const name = decodeEntities(r.faci_nm ?? '');
    const road = decodeEntities(r.faci_road_addr ?? '');
    const jibun = decodeEntities(r.faci_addr ?? '');
    const emd = r.addr_emd_nm ? `(${r.addr_emd_nm})` : '';
    const hint = { sido: r.cp_nm || r.addr_ctpv_nm, sigungu: r.cpb_nm || r.addr_cpb_nm };
    const place = locate(road, emd) ?? locate(jibun, emd, hint);
    if (!name || /^[\d\s-]+$/.test(name) || !place) continue;
    const detail = decodeEntities(r.faci_road_daddr ?? r.faci_daddr ?? '');
    const base = road || jibun;
    out.push({
      id: `kf-${stableName(r.faci_cd ?? `${name}|${base}`)}`,
      name,
      kind: r.faci_gb_nm === '공공' ? '공공체육시설' : '체육시설',
      source: 'facility',
      sido: place.sido,
      sigungu: place.sigungu,
      ...(place.unassigned ? { unassigned: true } : {}),
      dong: r.addr_emd_nm || dongIn(road),
      address: detail && !base.includes(detail) ? `${base} ${detail}` : base,
      phone: (r.faci_tel_no ?? '').trim(),
      realm: r.fcob_nm ?? '',
      category: r.ftype_nm ?? '',
      capacity: null,
      established: '',
      loadedAt: /^\d{4}-\d{2}-\d{2}/.test(r.updt_dt ?? '') ? r.updt_dt.slice(0, 10) : fallbackDate,
      courses: [],
      subjects: [subject],
    });
  }
  return out;
}

const normName = (s: string) => s.replace(/\(.*?\)|[\s·.,\-_'"&/]/g, '').toLowerCase();
/** 도로명 + 건물번호: '서울특별시 강남구 도곡로 123 (역삼동)' → '도곡로123' */
const roadKey = (address: string) => address.match(/([가-힣0-9]+(?:로|길))\s*(\d+(?:-\d+)?)/)?.slice(1, 3).join('') ?? '';

/**
 * 같은 시설이 두 자료에 다 있으면(바우처 가맹 태권도장이 신고 체육시설 목록에도 있는 경우) 금액이 있는 바우처 쪽만 남기고,
 * 바우처 쪽에 없는 전화번호는 시설 목록에서 가져온다.
 */
export function mergeSportsAcademies(voucher: RealAcademy[], listed: RealAcademy[]): RealAcademy[] {
  const byName = new Map<string, RealAcademy>();
  const byRoad = new Map<string, RealAcademy[]>();
  for (const v of voucher) {
    byName.set(`${v.sido}|${v.sigungu}|${normName(v.name)}`, v);
    const rk = roadKey(v.address);
    if (rk) byRoad.set(`${v.sido}|${v.sigungu}|${rk}`, [...(byRoad.get(`${v.sido}|${v.sigungu}|${rk}`) ?? []), v]);
  }
  const rest: RealAcademy[] = [];
  for (const f of listed) {
    const n = normName(f.name);
    let match = byName.get(`${f.sido}|${f.sigungu}|${n}`);
    if (!match) {
      const rk = roadKey(f.address);
      // 같은 건물이면 이름 앞 두 글자가 같거나 한쪽 이름이 다른 쪽을 품을 때 같은 곳으로 본다
      match = rk
        ? byRoad.get(`${f.sido}|${f.sigungu}|${rk}`)?.find((v) => {
            const m = normName(v.name);
            return m.includes(n) || n.includes(m) || (m.length >= 2 && m.slice(0, 2) === n.slice(0, 2));
          })
        : undefined;
    }
    if (match) {
      if (!match.phone && f.phone) match.phone = f.phone;
      for (const s of f.subjects) if (!match.subjects.includes(s)) match.subjects.push(s);
      continue;
    }
    rest.push(f);
  }
  return [...voucher, ...rest];
}

export interface SportsSummary {
  fetchedAt: string;
  /** 바우처 월 지원 한도로 본 금액 */
  voucherCap: number | null;
  /** 강좌 금액이 있는 시설 (스포츠강좌이용권) */
  priced: number;
  courses: number;
  /** 금액 없이 목록만 있는 시설 (전국체육시설 정보) */
  listed: number;
}

/** 원자료 → 앱 형식 체육시설 전체와 요약 */
export function buildSports(snap: SportsSnapshot): { academies: RealAcademy[]; summary: SportsSummary } {
  const cap = detectVoucherCap(snap.courses);
  const voucher = voucherAcademies(snap, cap);
  const academies = mergeSportsAcademies(voucher, facilityAcademies(snap));
  return {
    academies,
    summary: {
      fetchedAt: snap.fetchedAt,
      voucherCap: cap,
      priced: voucher.length,
      courses: voucher.reduce((s, a) => s + a.courses.length, 0),
      listed: academies.length - voucher.length,
    },
  };
}
