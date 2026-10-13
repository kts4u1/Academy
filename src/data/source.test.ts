import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { idbClear } from '../store/idb';
import { academy, raw } from '../test/fixtures';
import type { DataManifest } from './manifest';
import { dataAvailability, loadDistrictData, loadMarketRows, resetDataCaches } from './source';

const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

function manifest(): DataManifest {
  return {
    version: 2,
    sourceKind: 'api',
    updatedAt: '2026-10-12T18:00:00.000Z',
    sampleMode: false,
    source: 'test',
    totals: { academies: 3, priced: 3, courses: 3, unassigned: 1, skippedClosed: 0 },
    offices: [],
    districts: [{ sido: '경기', sigungu: '성남시 분당구', code: '41135', file: 'd/41135.json', academies: 2, priced: 2 }],
    buckets: [{ sido: '경기', name: '성남시', file: 'b/0.json', academies: 1, priced: 1 }],
  };
}

describe('정적 데이터 (매주 자동 업데이트)', () => {
  const assigned = [academy({ ATPT_OFCDC_SC_CODE: 'J10', ADMST_ZONE_NM: '성남시', FA_RDNMA: '경기도 성남시 분당구 황새울로 1', FA_RDNDA: ' (서현동)' }, '경기')];
  const bucket = [academy({ ATPT_OFCDC_SC_CODE: 'J10', ADMST_ZONE_NM: '성남시', FA_RDNMA: '경기도 성남시 어딘가로 1', FA_RDNDA: '' }, '경기')];

  beforeEach(() => {
    resetDataCaches();
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        const url = input.split('?')[0];
        if (url === 'data/manifest.json') return json(manifest());
        if (url === 'data/d/41135.json') return json(assigned);
        if (url === 'data/b/0.json') return json(bucket);
        if (url === 'data/market.json') return json({ rows: [{ sido: '경기' }] });
        return json({}, 404);
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('인증키 없이 시·군·구 파일과 같은 시의 구 미상 파일을 읽는다', async () => {
    expect((await dataAvailability('')).mode).toBe('static');
    const d = await loadDistrictData('경기', '성남시 분당구', { neisKey: '' });
    expect(d?.mode).toBe('static');
    expect(d?.academies.map((a) => a.id)).toEqual(assigned.map((a) => a.id));
    expect(d?.unknownDistrict.map((a) => a.id)).toEqual(bucket.map((a) => a.id));
    expect(d?.cityWide).toBe(false);
    expect(d?.updatedAt).toBe('2026-10-12T18:00:00.000Z');
    expect(await loadMarketRows(d)).toEqual([{ sido: '경기' }]);
  });

  it('학원이 없는 지역은 빈 목록', async () => {
    const d = await loadDistrictData('서울', '강남구', { neisKey: '' });
    expect(d?.academies).toEqual([]);
    expect(d?.unknownDistrict).toEqual([]);
  });
});

describe('정적 데이터가 없을 때', () => {
  const rows = [
    raw({ ADMST_ZONE_NM: '강남구', PSNBY_THCC_CNTNT: '초등영어:200000' }),
    raw({ ADMST_ZONE_NM: '강남구', PSNBY_THCC_CNTNT: '초등영어:250000', REG_STTUS_NM: '휴원' }),
  ];
  let neisCalls = 0;

  beforeEach(async () => {
    resetDataCaches();
    await idbClear();
    neisCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        const url = input.split('?')[0];
        if (url.startsWith('data/')) return json({}, 404);
        neisCalls++;
        expect(input).toContain('KEY=test-key');
        expect(input).toContain('ADMST_ZONE_NM=%EA%B0%95%EB%82%A8%EA%B5%AC');
        return json({ acaInsTiInfo: [{ head: [{ list_total_count: rows.length }, { RESULT: { CODE: 'INFO-000', MESSAGE: '' } }] }, { row: rows }] });
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('인증키가 없으면 데이터 없음 (예시 데이터를 만들지 않는다)', async () => {
    expect((await dataAvailability('')).mode).toBe('none');
    expect(await loadDistrictData('서울', '강남구', { neisKey: '' })).toBeNull();
    expect(neisCalls).toBe(0);
  });

  it('인증키로 고른 지역만 교육청에서 받아 보관하고, 운영 중인 곳만 쓴다', async () => {
    expect((await dataAvailability('test-key')).mode).toBe('live');
    const first = await loadDistrictData('서울', '강남구', { neisKey: 'test-key' });
    expect(first?.mode).toBe('live');
    expect(first?.academies).toHaveLength(1);
    expect(neisCalls).toBe(1);
    const market = await loadMarketRows(first);
    expect(market).toEqual([]); // 과정 1개라 시세 없음

    await loadDistrictData('서울', '강남구', { neisKey: 'test-key' });
    expect(neisCalls).toBe(1); // 7일 안에는 보관본

    await loadDistrictData('서울', '강남구', { neisKey: 'test-key', force: true });
    expect(neisCalls).toBe(2);
  });
});
