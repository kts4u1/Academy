import { describe, expect, it } from 'vitest';
import { raw } from '../test/fixtures';
import { buildOutput, stableName, type RawSnapshot } from './buildData';
import type { DataManifest } from './manifest';

const snap = (offices: RawSnapshot['offices']): RawSnapshot => ({ kind: 'file', fetchedAt: '2026-10-12T18:00:00.000Z', baseDate: '2026-09-30', offices });

describe('원자료 → 정적 데이터', () => {
  it('시·군·구 파일, 구 미상 파일, 시세, 목록을 만든다', () => {
    const rows = [
      raw({ ACA_NM: '가', PSNBY_THCC_CNTNT: '중등수학:200000' }),
      raw({ ACA_NM: '나', PSNBY_THCC_CNTNT: '중등수학:300000' }),
      raw({ ACA_NM: '다', PSNBY_THCC_CNTNT: '중등수학:400000' }),
      raw({ ACA_NM: '휴원', REG_STTUS_NM: '휴원' }),
    ];
    const bucketRow = raw({ ATPT_OFCDC_SC_CODE: 'J10', ADMST_ZONE_NM: '성남시', FA_RDNMA: '경기도 성남시 어딘가로 1', FA_RDNDA: '' });
    const { manifest, files } = buildOutput(snap([
      { code: 'B10', total: 4, rows: [...rows, rows[0]] }, // 같은 학원이 두 번 와도 한 번만
      { code: 'J10', total: 1, rows: [bucketRow] },
    ]));
    expect(manifest).toMatchObject({ version: 2, sourceKind: 'file', baseDate: '2026-09-30', sampleMode: false });
    expect(manifest.totals).toMatchObject({ academies: 4, priced: 3, unassigned: 1, skippedClosed: 1 });
    const gangnam = manifest.districts.find((d) => d.sigungu === '강남구')!;
    expect(gangnam).toMatchObject({ file: 'd/11680.json', academies: 3, priced: 3 });
    expect((files.get('d/11680.json') as unknown[]).length).toBe(3);
    expect(manifest.buckets).toEqual([{ sido: '경기', name: '성남시', file: `b/${stableName('경기|성남시')}.json`, academies: 1, priced: 0 }]);
    const market = files.get('market.json') as { rows: { sigungu: string; median: number }[] };
    expect(market.rows.some((r) => r.sigungu === '강남구' && r.median === 300000)).toBe(true);
    expect(files.get('manifest.json')).toBe(manifest as DataManifest);
    // 파일 주소의 ?v= 에 쓰는 내용 해시
    expect(Object.keys(manifest.versions!).sort()).toEqual(['b/' + stableName('경기|성남시') + '.json', 'd/11680.json', 'market.json'].sort());
    expect(manifest.versions!['d/11680.json']).toBe(stableName(JSON.stringify(files.get('d/11680.json'))));
  });

  it('같은 원자료를 다시 가공하면 내용이 바뀐 파일만 버전이 바뀐다', () => {
    const seoul = raw({ ACA_NM: '가', PSNBY_THCC_CNTNT: '중등수학:200000' });
    const bucket = raw({ ATPT_OFCDC_SC_CODE: 'J10', ADMST_ZONE_NM: '성남시', FA_RDNMA: '경기도 성남시 어딘가로 1', FA_RDNDA: '' });
    const build = (price: number) =>
      buildOutput(snap([
        { code: 'B10', total: 1, rows: [{ ...seoul, PSNBY_THCC_CNTNT: `중등수학:${price}` }] },
        { code: 'J10', total: 1, rows: [bucket] },
      ])).manifest.versions!;
    const a = build(200000);
    const b = build(250000);
    expect(b['d/11680.json']).not.toBe(a['d/11680.json']);
    const bucketFile = 'b/' + stableName('경기|성남시') + '.json';
    expect(b[bucketFile]).toBe(a[bucketFile]);
  });

  it('구 미상 파일 이름은 주마다 바뀌지 않는다', () => {
    expect(stableName('경기|성남시')).toBe(stableName('경기|성남시'));
    expect(stableName('경기|성남시')).not.toBe(stableName('경기|고양시'));
  });

  it('두 교육청에 함께 올라 있는 같은 학원은 한 번만', () => {
    const daegu = raw({ ATPT_OFCDC_SC_CODE: 'D10', ADMST_ZONE_NM: '군위군', ACA_NM: '군위수학', FA_RDNMA: '대구광역시 군위군 군위읍 중앙길 1', FA_RDNDA: '' });
    const gyeongbuk = raw({ ATPT_OFCDC_SC_CODE: 'R10', ADMST_ZONE_NM: '군위군', ACA_NM: '군위수학', FA_RDNMA: '대구광역시 군위군 군위읍 중앙길 1', FA_RDNDA: '', PSNBY_THCC_CNTNT: '중등수학:200000' });
    const { manifest, files } = buildOutput(snap([
      { code: 'D10', total: 1, rows: [daegu] },
      { code: 'R10', total: 1, rows: [gyeongbuk] },
    ]));
    const gunwi = manifest.districts.find((d) => d.sido === '대구' && d.sigungu === '군위군')!;
    expect(gunwi.academies).toBe(1);
    expect((files.get(gunwi.file!) as { courses: unknown[] }[])[0].courses).toHaveLength(1); // 과정이 더 많은 쪽
  });
});
