import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import type { DataManifest } from './data/manifest';
import { resetDataCaches } from './data/source';
import { buildMarket } from './lib/realData';
import { academy } from './test/fixtures';

const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

const gangnam = [
  academy({ ACA_NM: '개포영어교습소', PSNBY_THCC_CNTNT: '초등영어:200000, 중등영어:300000' }),
  academy({ ACA_NM: '대치영어교습소', PSNBY_THCC_CNTNT: '초등영어:250000' }),
  academy({ ACA_NM: '도곡영어교습소', PSNBY_THCC_CNTNT: '초등영어:350000' }),
  academy({ ACA_INSTI_SC_NM: '학원', ACA_NM: '역삼영어학원', PSNBY_THCC_CNTNT: '' }),
];

const manifest: DataManifest = {
  version: 2,
    sourceKind: 'api',
  updatedAt: '2026-10-12T18:00:00.000Z',
  sampleMode: false,
  source: 'test',
  totals: { academies: 4, priced: 3, courses: 4, unassigned: 0, skippedClosed: 0 },
  offices: [{ code: 'B10', sido: '서울', total: 4, fetched: 4, kept: 4 }],
  districts: [{ sido: '서울', sigungu: '강남구', code: '11680', file: 'd/11680.json', academies: 4, priced: 3 }],
  buckets: [],
};

function serve(withData: boolean) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string) => {
      const url = input.split('?')[0];
      if (!withData) return json({}, 404);
      if (url === 'data/manifest.json') return json(manifest);
      if (url === 'data/d/11680.json') return json(gangnam);
      if (url === 'data/market.json') return json({ rows: buildMarket(gangnam) });
      return json({}, 404);
    }),
  );
}

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetDataCaches();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('데이터가 없으면 예시 대신 설정 방법을 안내한다', async () => {
    serve(false);
    window.location.hash = '#/search?sido=서울&sigungu=강남구';
    render(<App />);
    expect(await screen.findByRole('heading', { name: '아직 교육청 데이터가 없어요' })).toBeInTheDocument();
    expect(screen.queryAllByRole('article')).toHaveLength(0);
  });

  it('홈 화면: 내 동네 시세', async () => {
    serve(true);
    window.localStorage.setItem('hakwon-compare:settings', JSON.stringify({ home: { sido: '서울', sigungu: '강남구' } }));
    window.location.hash = '#/';
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('교육청 신고가');
    expect(await screen.findByText(/교육청에 등록된 학원·교습소/)).toHaveTextContent('4곳');
    expect(await screen.findByText('2026.10.13 업데이트 (매주 자동)', { exact: false })).toBeInTheDocument();
  });

  it('검색: 교육청 자료의 학원과 시세 대비 위치', async () => {
    serve(true);
    window.location.hash = '#/search?sido=서울&sigungu=강남구&subject=english&age=elementary';
    render(<App />);
    const cards = await screen.findAllByRole('article');
    expect(cards).toHaveLength(4);
    expect(cards[0]).toHaveTextContent('개포영어교습소');
    expect(cards[0]).toHaveTextContent('20만원');
    expect(cards[0]).toHaveTextContent('매우 저렴');
    expect(cards[3]).toHaveTextContent('교습비가 공개되지 않았어요');
  });

  it('학원 상세: 과정별 교습비와 더 저렴한 곳', async () => {
    serve(true);
    const target = gangnam[2];
    window.location.hash = `#/academy/서울/강남구/${target.id}`;
    render(<App />);
    expect(await screen.findByRole('heading', { name: '도곡영어교습소' })).toBeInTheDocument();
    expect(screen.getByText('교습과정별 신고 교습비')).toBeInTheDocument();
    expect(screen.getByText('같은 동네에서 더 저렴한 곳')).toBeInTheDocument();
    expect(screen.getByText('개포영어교습소')).toBeInTheDocument();
  });

  it('체육 자료가 없으면 솔직하게 알린다', async () => {
    serve(true);
    window.location.hash = '#/search?sido=서울&sigungu=강남구&subject=swim';
    render(<App />);
    expect(await screen.findByRole('heading', { name: /수영 자료를 아직 불러오지 못했어요/ })).toBeInTheDocument();
  });

  it('되돌리기: 지운 찜·비교함·내 학원비를 원래 자리에 그대로 되살린다', async () => {
    serve(true);
    const stored = (key: string) => JSON.parse(window.localStorage.getItem(`hakwon-compare:v2:${key}`) ?? '[]') as { id?: string; ref?: { id: string }; addedAt?: string }[];
    const ref = (i: number) => ({ id: gangnam[i].id, sido: '서울', sigungu: '강남구', name: gangnam[i].name });

    // 찜 해제 → 되돌리기: 같은 자리, 찜한 날짜 그대로
    const fav = (i: number, addedAt: string) => ({ ...ref(i), dong: gangnam[i].dong, kind: gangnam[i].kind, subjects: gangnam[i].subjects, addedAt });
    window.localStorage.setItem('hakwon-compare:v2:favorites', JSON.stringify([fav(0, '2026-10-01'), fav(1, '2026-10-02')]));
    window.location.hash = '#/favorites';
    let view = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '개포영어교습소 찜 해제' }));
    expect(stored('favorites')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
    expect(stored('favorites').map((f) => [f.id, f.addedAt])).toEqual([
      [gangnam[0].id, '2026-10-01'],
      [gangnam[1].id, '2026-10-02'],
    ]);
    view.unmount();

    // 비교함 비우기·빼기 → 되돌리기
    window.localStorage.setItem('hakwon-compare:v2:compare', JSON.stringify([{ ref: ref(0), course: null }, { ref: ref(1), course: null }]));
    window.location.hash = '#/compare';
    view = render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '비우기' }));
    expect(stored('compare')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
    expect(stored('compare').map((c) => c.ref!.id)).toEqual([gangnam[0].id, gangnam[1].id]);
    fireEvent.click((await screen.findAllByRole('button', { name: '대치영어교습소 빼기' }))[0]);
    expect(stored('compare')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
    expect(stored('compare').map((c) => c.ref!.id)).toEqual([gangnam[0].id, gangnam[1].id]);
    view.unmount();

    // 내 학원비 삭제 → 되돌리기: 같은 id, 같은 자리
    const item = (id: string, name: string) => ({ id, person: '첫째', name, monthly: 100000, subjectId: null, age: null, sido: '서울', sigungu: '강남구' });
    window.localStorage.setItem('hakwon-compare:v2:calc', JSON.stringify([item('c1', '동네 수영장'), item('c2', '수학 과외')]));
    window.location.hash = '#/budget';
    view = render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '동네 수영장 삭제' }));
    expect(stored('calc').map((c) => c.id)).toEqual(['c2']);
    fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
    expect(stored('calc').map((c) => c.id)).toEqual(['c1', 'c2']);
    view.unmount();
  });

  it('체육 과목: 바우처 등록 금액과 신고 체육시설 목록', async () => {
    const tkd = [
      { name: '가나태권도', price: 150000 },
      { name: '다라태권도', price: 130000 },
      { name: '마바태권도', price: 160000 },
      { name: '사아태권도', price: 105000 },
    ].map(({ name, price }, i) => ({
      id: `kv-${i}`,
      name,
      kind: '체육시설',
      source: 'voucher' as const,
      sido: '서울',
      sigungu: '강남구',
      dong: '역삼동',
      address: '서울특별시 강남구 도곡로 1',
      phone: '',
      realm: '스포츠강좌이용권',
      category: '태권도',
      capacity: null,
      established: '',
      loadedAt: '2026-10-16',
      courses: [{ name: '태권도 주5회', price, subjectId: 'taekwondo', ages: ['preschool', 'elementary', 'middle', 'high'] as const, ...(price === 105000 ? { voucherCap: true } : {}) }],
      subjects: ['taekwondo'],
    }));
    const listed = { ...tkd[0], id: 'kf-1', name: '목록태권도', source: 'facility' as const, courses: [], phone: '02-111-2222' };
    const district = [...gangnam, ...tkd, listed];
    const sportsManifest = { ...manifest, sports: { fetchedAt: '2026-10-16T01:00:00.000Z', voucherCap: 105000, priced: 4, courses: 4, listed: 1 } };
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        const url = input.split('?')[0];
        if (url === 'data/manifest.json') return json(sportsManifest);
        if (url === 'data/d/11680.json') return json(district);
        if (url === 'data/market.json') return json({ rows: buildMarket(district as never) });
        return json({}, 404);
      }),
    );
    window.location.hash = '#/search?sido=서울&sigungu=강남구&subject=taekwondo';
    render(<App />);
    const cards = await screen.findAllByRole('article');
    expect(cards.map((c) => c.querySelector('h3')?.textContent)).toEqual(['사아태권도', '다라태권도', '가나태권도', '마바태권도', '목록태권도']);
    expect(screen.getByText(/국민체육진흥공단 자료/)).toBeInTheDocument();
    // 한도 금액(10.5만원)은 시세에서 빼고, 배지도 붙이지 않는다
    expect(cards[0]).toHaveTextContent('바우처 월 지원 한도와 같은 금액이라 시세 비교에서 뺐어요');
    expect(cards[0]).not.toHaveTextContent('중앙값');
    expect(cards[1]).toHaveTextContent('/ 월 · 바우처 등록 금액');
    expect(cards[1]).toHaveTextContent('중앙값 15만원');
    expect(cards[4]).toHaveTextContent('금액 정보가 없어요');
    // 전체 과목 목록에는 체육시설이 섞이지 않는다
  });
});
