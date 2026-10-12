import { describe, expect, it, vi } from 'vitest';
import { getAcademies } from '../data';
import { filterNeisForDistrict } from '../data/regions';
import { fetchAllNeisAcademies, type NeisAcademy } from './neis';
import { classifyRows, compareWithSample, coverage } from './neisCompare';

function aca(id: string, name: string, tuitions: [string, number][], extra: Partial<NeisAcademy> = {}): NeisAcademy {
  return {
    id,
    name,
    kind: '교습소',
    office: '',
    sigungu: '강남구',
    realm: '입시.검정 및 보습',
    courseGroup: '보통교과',
    course: '',
    courseCategory: '보습',
    courseList: '',
    tuitions: tuitions.map(([course, price]) => ({ course, price })),
    tuitionPublic: true,
    capacity: null,
    address: '서울특별시 강남구 예시로 1',
    roadAddress: '서울특별시 강남구 예시로 1',
    phone: '',
    establishedAt: '',
    status: '개원',
    loadedAt: '',
    ...extra,
  };
}

describe('예시 데이터와 비교', () => {
  const rows = [
    aca('1', '가수학교습소', [['초등수학', 200000], ['중등수학', 240000], ['일일특강', 10000]]),
    aca('2', '나수학교습소', [['초등수학A', 220000], ['중등수학', 300000]]),
    aca('3', '다수학교습소', [['초등 수학', 180000], ['1:1 고등수학', 600000]]),
    aca('4', '라영어교습소', [['초등영어', 150000]]),
  ];
  const items = classifyRows(rows);

  it('과목·연령별로 실제 중앙값과 예시 중앙값을 나란히 만든다', () => {
    const table = compareWithSample(items, getAcademies(), { sido: '서울', sigungu: '강남구' });
    const mathAll = table.find((r) => r.subjectId === 'math' && r.age === null)!;
    expect(mathAll.real.n).toBe(5); // 특강·1:1 제외
    const mathElem = table.find((r) => r.subjectId === 'math' && r.age === 'elementary')!;
    expect(mathElem.real.median).toBe(200000);
    expect(mathElem.sample).not.toBeNull();
    expect(mathElem.diff).toBeCloseTo(mathElem.sample!.median / 200000 - 1);
    // 표본 3개 미만(영어 1개)은 표에 넣지 않는다
    expect(table.some((r) => r.subjectId === 'english')).toBe(false);
  });

  it('분류 현황', () => {
    const c = coverage(items);
    expect(c.total).toBe(8);
    expect(c.excluded).toBe(1);
    expect(c.privateLessons).toBe(1);
    expect(c.comparable).toBe(6);
  });
});

describe('지역 맞춤 거르기', () => {
  const loc = (sigungu: string, roadAddress: string, address = roadAddress) => ({ sigungu, roadAddress, address });

  it('일반구는 주소의 구 이름으로 거른다', () => {
    const rows = [loc('성남시', '경기도 성남시 분당구 정자일로 1'), loc('성남시', '경기도 성남시 수정구 수정로 1')];
    const r = filterNeisForDistrict(rows, { sido: '경기', sigungu: '성남시 분당구' });
    expect(r.rows).toHaveLength(1);
    expect(r.cityWide).toBe(false);
  });

  it('주소에 구가 없으면 시 전체 (cityWide)', () => {
    const rows = [loc('화성시', '경기도 화성시 동탄대로 1'), loc('화성시', '경기도 화성시 봉담읍 1')];
    const r = filterNeisForDistrict(rows, { sido: '경기', sigungu: '화성시 동탄구' });
    expect(r.rows).toHaveLength(2);
    expect(r.cityWide).toBe(true);
  });

  it('인천 옛 중구 학원은 법정동으로 영종구·제물포구에 나눈다', () => {
    const rows = [
      loc('중구', '인천광역시 중구 공항로 1', '인천광역시 중구 공항로 1 (운서동)'),
      loc('중구', '인천광역시 중구 신포로 1', '인천광역시 중구 신포로 1 (신포동)'),
      loc('동구', '인천광역시 동구 송림로 1'),
      loc('영종구', '인천광역시 영종구 하늘중앙로 1'),
    ];
    expect(filterNeisForDistrict(rows, { sido: '인천', sigungu: '영종구' }).rows).toHaveLength(2);
    expect(filterNeisForDistrict(rows, { sido: '인천', sigungu: '제물포구' }).rows).toHaveLength(2);
  });
});

describe('여러 페이지 받기', () => {
  it('인증키가 있으면 total 만큼 1,000건씩 이어 받는다', async () => {
    const page = (n: number, total: number) => ({
      acaInsTiInfo: [
        { head: [{ list_total_count: total }, { RESULT: { CODE: 'INFO-000', MESSAGE: '' } }] },
        { row: Array.from({ length: n }, (_, i) => ({ ATPT_OFCDC_SC_CODE: 'B10', ATPT_OFCDC_SC_NM: '', ADMST_ZONE_NM: '강남구', ACA_INSTI_SC_NM: '학원', ACA_ASNUM: `${total}-${n}-${i}-${Math.random()}`, ACA_NM: '학원' })) },
      ],
    });
    const calls: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      calls.push(url);
      const p = Number(new URL(url).searchParams.get('pIndex'));
      return new Response(JSON.stringify(page(p < 3 ? 1000 : 500, 2500)));
    });
    const progress: number[] = [];
    const r = await fetchAllNeisAcademies({ key: 'TEST', officeCode: 'B10', sigungu: '강남구' }, { fetchImpl: fetchMock as unknown as typeof fetch, onProgress: (n) => progress.push(n) });
    expect(r.rows).toHaveLength(2500);
    expect(calls).toHaveLength(3);
    expect(calls[0]).toContain('pSize=1000');
    expect(progress).toEqual([1000, 2000, 2500]);
    expect(r.truncated).toBe(false);
  });

  it('상한(maxRows)을 넘으면 멈추고 truncated 로 알린다', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          acaInsTiInfo: [
            { head: [{ list_total_count: 9000 }, { RESULT: { CODE: 'INFO-000', MESSAGE: '' } }] },
            { row: Array.from({ length: 1000 }, (_, i) => ({ ATPT_OFCDC_SC_CODE: 'B10', ATPT_OFCDC_SC_NM: '', ADMST_ZONE_NM: '강남구', ACA_INSTI_SC_NM: '학원', ACA_ASNUM: String(i), ACA_NM: '학원' })) },
          ],
        }),
      ),
    );
    const r = await fetchAllNeisAcademies({ key: 'TEST', officeCode: 'B10' }, { maxRows: 2000, fetchImpl: fetchMock as unknown as typeof fetch });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(r.truncated).toBe(true);
  });
});
