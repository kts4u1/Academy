import { describe, expect, it } from 'vitest';
import { buildMarket } from '../lib/realData';
import { buildOutput, type RawSnapshot } from './buildData';
import { resolveAddressDistrict } from './regions';
import {
  buildSports,
  classifySportsCourse,
  detectVoucherCap,
  facilityAcademies,
  isOnlineItem,
  mergeSportsAcademies,
  subjectFromName,
  voucherAcademies,
  type SportsRow,
  type SportsSnapshot,
} from './sports';

let seq = 0;
function facility(over: Partial<SportsRow> = {}): SportsRow {
  seq += 1;
  return {
    brno: String(1000000000 + seq),
    facil_sn: '1',
    city_nm: '서울',
    local_nm: '강남구',
    facil_nm: `테스트태권도${seq}`,
    road_addr: '서울특별시 강남구 도곡로 100',
    faci_daddr: '2층(역삼동)',
    main_event_nm: '태권도',
    ...over,
  };
}
function course(f: SportsRow, over: Partial<SportsRow> = {}): SportsRow {
  return { brno: f.brno, facil_sn: f.facil_sn, item_cd: '22', item_nm: '태권도', course_nm: '태권도 주5회', settl_amt: '150000', ...over };
}
function national(over: Partial<SportsRow> = {}): SportsRow {
  seq += 1;
  return {
    faci_cd: `CD${seq}`,
    faci_nm: `목록태권도${seq}`,
    faci_gb_nm: '신고',
    fcob_nm: '체육도장업',
    ftype_nm: '태권도',
    faci_stat_nm: '정상운영',
    faci_road_addr: '서울특별시 강남구 선릉로 200 (대치동)',
    faci_tel_no: '02-555-0000',
    cp_nm: '서울특별시',
    cpb_nm: '강남구',
    addr_emd_nm: '대치동',
    updt_dt: '2026-10-01',
    ...over,
  };
}
const snap = (p: Partial<SportsSnapshot>): SportsSnapshot => ({ fetchedAt: '2026-10-16T01:00:00.000Z', courses: [], facilities: [], national: [], ...p });

describe('체육 강좌 분류', () => {
  it('바우처 한도: 가장 흔한 금액이 20% 넘게 몰려 있으면 그 금액', () => {
    const f = facility();
    const rows = [105000, 105000, 105000, 150000, 130000, 90000, 120000, 170000, 110000, 100000].map((p) => course(f, { settl_amt: String(p) }));
    expect(detectVoucherCap(rows)).toBe(105000);
    expect(detectVoucherCap([150000, 130000, 90000, 120000, 170000, 110000].map((p) => course(f, { settl_amt: String(p) })))).toBeNull();
  });

  it('비대면 종목 코드는 80~108', () => {
    expect(isOnlineItem('96')).toBe(true);
    expect(isOnlineItem('22')).toBe(false);
    expect(isOnlineItem('110')).toBe(false); // 주짓수 대면
  });

  it('월 수강료가 아닌 강좌를 가린다', () => {
    expect(classifySportsCourse('태권도 주5회', 150000, 105000)).toEqual({});
    expect(classifySportsCourse('태권도 주3회', 105000, 105000)).toEqual({ voucherCap: true });
    expect(classifySportsCourse('주짓수', 315000, 105000).excluded).toMatch(/여러 달/);
    expect(classifySportsCourse('헬스 이용권 3개월', 210000, 105000).excluded).toMatch(/여러 달/);
    expect(classifySportsCourse('1대1 PT 10회권', 315000, 105000)).toMatchObject({ private: true });
    expect(classifySportsCourse('클라이밍 10회권', 200000, 105000).excluded).toMatch(/회차권/);
    expect(classifySportsCourse('복싱 주 5회권 1개월', 140000, 105000).excluded).toBeUndefined();
    expect(classifySportsCourse('월 4회 클라이밍 그룹강습', 132000, 105000).excluded).toBeUndefined();
    expect(classifySportsCourse('스포츠클라이밍-장비대여료', 10000, 105000).excluded).toBeTruthy();
    expect(classifySportsCourse('농구(1만원 추가결제)', 10000, 105000).excluded).toBeTruthy();
    expect(classifySportsCourse('펜싱체험권', 105000, 105000).excluded).toBeTruthy();
    expect(classifySportsCourse('어린이수영A', 24800, 105000)).toEqual({});
  });

  it('이름으로 종목 찾기 (킥복싱이 복싱보다 먼저)', () => {
    expect(subjectFromName('강남 킥복싱 짐')).toBe('kickboxing');
    expect(subjectFromName('OO복싱클럽')).toBe('boxing');
    expect(subjectFromName('그레이시 주짓수')).toBe('jiujitsu');
    expect(subjectFromName('행복한 체육관')).toBeNull();
  });
});

describe('스포츠강좌이용권 시설', () => {
  it('시설과 강좌를 묶고 주소로 시·군·구를 정한다', () => {
    const f = facility({ facil_nm: '강남&amp;태권도' });
    const s = snap({
      facilities: [f],
      courses: [
        course(f),
        course(f, { course_nm: '태권도 주3회', settl_amt: '105000' }),
        course(f, { course_nm: '태권도 주3회', settl_amt: '105000' }), // 같은 강좌가 두 번 → 한 번만
        course(f, { item_cd: '96', course_nm: '온라인 태권도', settl_amt: '50000' }), // 비대면 → 뺀다
        course(f, { item_cd: '25', item_nm: '헬스', course_nm: '헬스 1개월', settl_amt: '80000' }), // 앱에 없는 종목
        course(f, { item_cd: '76', item_nm: '복싱', course_nm: '킥복싱 성인반', settl_amt: '160000' }),
        course(f, { item_cd: '03', item_nm: '기타종목', course_nm: '어린이 줄넘기', settl_amt: '90000' }),
      ],
    });
    const [a] = voucherAcademies(s, 105000);
    expect(a).toMatchObject({ name: '강남&태권도', source: 'voucher', kind: '체육시설', sido: '서울', sigungu: '강남구', dong: '역삼동', phone: '' });
    expect(a.id).toMatch(/^kv-/);
    expect(a.id).not.toContain(f.brno); // 사업자번호를 그대로 드러내지 않는다
    expect(a.courses.map((c) => [c.name, c.subjectId])).toEqual([
      ['태권도 주5회', 'taekwondo'],
      ['태권도 주3회', 'taekwondo'],
      ['킥복싱 성인반', 'kickboxing'],
      ['어린이 줄넘기', 'jumprope'],
    ]);
    expect(a.courses[1].voucherCap).toBe(true);
    // 대상이 없으면 유·청소년, 적혀 있으면 그대로
    expect(a.courses[0].ages).toEqual(['preschool', 'elementary', 'middle', 'high']);
    expect(a.courses[2].ages).toEqual(['adult']);
    expect(a.courses[0].sessionsPerWeek).toBe(5);
    expect(a.subjects).toEqual(['taekwondo', 'kickboxing', 'jumprope']);
  });

  it('강좌가 없는 시설, 앱 종목이 없는 시설은 넣지 않는다', () => {
    const f1 = facility();
    const f2 = facility({ main_event_nm: '헬스' });
    const s = snap({ facilities: [f1, f2], courses: [course(f2, { item_cd: '25', item_nm: '헬스', course_nm: '헬스', settl_amt: '80000' })] });
    expect(voucherAcademies(s, null)).toEqual([]);
  });

  it('주소를 읽지 못하면 자료의 시·도·시·군·구 이름으로', () => {
    const f = facility({ road_addr: '부산북구덕천3동', city_nm: '부산', local_nm: '북구' });
    const [a] = voucherAcademies(snap({ facilities: [f], courses: [course(f)] }), null);
    expect(a).toMatchObject({ sido: '부산', sigungu: '북구' });
  });
});

describe('전국체육시설 목록', () => {
  it('정상운영이고 앱 종목이 있는 곳만, 업종·시설유형으로 종목을 정한다', () => {
    const s = snap({
      national: [
        national(),
        national({ ftype_nm: '권투', faci_nm: '강남 킥복싱' }),
        national({ ftype_nm: '레슬링', faci_nm: '그레이시 주짓수' }),
        national({ faci_stat_nm: '폐업' }),
        national({ fcob_nm: '골프연습장업', ftype_nm: '스크린', faci_nm: '스크린골프' }),
        national({ fcob_nm: '골프연습장업', ftype_nm: '실내', faci_nm: '실내골프' }),
        national({ fcob_nm: '당구장업', ftype_nm: '당구장', faci_nm: '당구장' }),
        national({ faci_gb_nm: '공공', fcob_nm: '수영장', ftype_nm: '수영장', faci_nm: '구민 수영장' }),
        national({ faci_gb_nm: '공공', fcob_nm: '축구장', ftype_nm: '축구장', faci_nm: '구민 축구장' }),
        national({ fcob_nm: '체력단련장업', ftype_nm: '체력단련장', faci_nm: '바른 필라테스' }),
        national({ fcob_nm: '체력단련장업', ftype_nm: '체력단련장', faci_nm: 'OO헬스' }),
        national({ fcob_nm: '체육교습업', ftype_nm: '농구', faci_nm: 'OO농구교실' }),
      ],
    });
    const list = facilityAcademies(s);
    expect(list.map((a) => [a.name, a.subjects[0], a.kind])).toEqual([
      [expect.stringMatching(/^목록태권도/), 'taekwondo', '체육시설'],
      ['강남 킥복싱', 'kickboxing', '체육시설'],
      ['그레이시 주짓수', 'jiujitsu', '체육시설'],
      ['실내골프', 'golf', '체육시설'],
      ['구민 수영장', 'swim', '공공체육시설'],
      ['바른 필라테스', 'pilates', '체육시설'],
      ['OO농구교실', 'basketball', '체육시설'],
    ]);
    expect(list[0]).toMatchObject({ source: 'facility', courses: [], sido: '서울', sigungu: '강남구', dong: '대치동', phone: '02-555-0000', loadedAt: '2026-10-01' });
  });

  it('바우처 시설과 같은 곳이면 하나로 (이름이 같거나, 같은 건물에 이름이 비슷)', () => {
    const f = facility({ facil_nm: '정의 태권도', road_addr: '서울특별시 강남구 도곡로 100' });
    const voucher = voucherAcademies(snap({ facilities: [f], courses: [course(f)] }), null);
    const listed = facilityAcademies(
      snap({
        national: [
          national({ faci_nm: '정의태권도', faci_road_addr: '서울특별시 강남구 다른로 5 (대치동)', faci_tel_no: '02-111-2222' }),
          national({ faci_nm: '정의태권도장', faci_road_addr: '서울특별시 강남구 도곡로 100 (역삼동)' }),
          national({ faci_nm: '다른태권도', faci_road_addr: '서울특별시 강남구 도곡로 100 (역삼동)' }),
        ],
      }),
    );
    const merged = mergeSportsAcademies(voucher, listed);
    expect(merged.map((a) => a.name)).toEqual(['정의 태권도', '다른태권도']);
    expect(merged[0].phone).toBe('02-111-2222');
  });
});

describe('체육 시세와 정적 파일', () => {
  it('바우처 한도 금액은 시세에서 뺀다', () => {
    const fs = [facility(), facility(), facility(), facility()];
    const s = snap({
      facilities: fs,
      courses: [course(fs[0], { settl_amt: '105000' }), course(fs[1], { settl_amt: '120000' }), course(fs[2], { settl_amt: '140000' }), course(fs[3], { settl_amt: '160000' })],
    });
    const row = buildMarket(voucherAcademies(s, 105000)).find((r) => r.sigungu === '강남구' && r.subjectId === 'taekwondo' && r.age === null)!;
    expect(row.academies).toBe(3);
    expect(row.median).toBe(140000);
  });

  it('학원 자료와 같은 시·군·구 파일에 넣되 개수는 따로 센다', () => {
    const neis: RawSnapshot = { kind: 'sample', fetchedAt: '2026-10-12T18:00:00.000Z', offices: [] };
    const f = facility();
    const sports = snap({ facilities: [f], courses: [course(f)], national: [national()] });
    const { manifest, files } = buildOutput(neis, sports);
    const gangnam = manifest.districts.find((d) => d.sigungu === '강남구')!;
    expect(gangnam).toMatchObject({ academies: 0, priced: 0, sports: 2, sportsPriced: 1, file: 'd/11680.json' });
    expect(manifest.totals.academies).toBe(0);
    expect(manifest.sports).toMatchObject({ priced: 1, listed: 1, courses: 1 });
    expect((files.get('d/11680.json') as { source?: string }[]).map((a) => a.source).sort()).toEqual(['facility', 'voucher']);
    // 체육 자료가 없으면 manifest 에 sports 가 없다
    expect(buildOutput(neis).manifest.sports).toBeUndefined();
  });

  it('buildSports 요약', () => {
    const f = facility();
    const { summary } = buildSports(snap({ facilities: [f], courses: [course(f), course(f, { course_nm: '주3회', settl_amt: '105000' }), course(f, { course_nm: '주2회', settl_amt: '105000' })] }));
    expect(summary).toMatchObject({ voucherCap: 105000, priced: 1, courses: 3, listed: 0 });
  });
});

describe('주소로 시·군·구 정하기', () => {
  it('옛 이름과 일반구, 통합 시·도', () => {
    expect(resolveAddressDistrict('인천광역시 남구 주안로 1')).toMatchObject({ sido: '인천', sigungu: '미추홀구' });
    expect(resolveAddressDistrict('경기도 성남시 분당구 황새울로 1')).toMatchObject({ sido: '경기', sigungu: '성남시 분당구' });
    expect(resolveAddressDistrict('대전 유성구 노은동')).toMatchObject({ sido: '대전', sigungu: '유성구' });
    expect(resolveAddressDistrict('', '', { sido: '경기도', sigungu: '화성시' })?.sido).toBe('경기');
    expect(resolveAddressDistrict('알 수 없는 주소')).toBeNull();
  });
});
