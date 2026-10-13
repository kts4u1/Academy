import { render, screen } from '@testing-library/react';
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

  it('체육 과목은 자료가 없다고 솔직하게 알린다', async () => {
    serve(true);
    window.location.hash = '#/search?sido=서울&sigungu=강남구&subject=swim';
    render(<App />);
    expect(await screen.findByRole('heading', { name: /수영은\(는\) 교육청 자료에 없어요/ })).toBeInTheDocument();
  });
});
