// 교육청 원자료 → 앱이 읽는 정적 데이터 파일 (scripts/update-data.ts 가 쓴다)
// 받는 것(API·전국 파일)과 가공을 나눠서, 코드만 바뀌었을 때 보관해 둔 원자료로 다시 가공할 수 있게 한다.

import { stableName } from '../lib/hash';
import { toNeisAcademy, type NeisRawRow } from '../lib/neis';
import { buildMarket, toRealAcademy, type RealAcademy } from '../lib/realData';
import type { DataManifest } from './manifest';
import { DISTRICTS, EDU_OFFICES } from './regions';

/** 원자료 묶음: API 든 전국 파일이든 같은 모양으로 보관하고 가공한다 */
export interface RawSnapshot {
  kind: 'api' | 'file' | 'sample';
  /** 받은 시각 ISO */
  fetchedAt: string;
  /** 전국 파일의 기준일 YYYY-MM-DD */
  baseDate?: string;
  fileName?: string;
  offices: { code: string; total: number; rows: NeisRawRow[] }[];
}

export { stableName };

/** 같은 학원이 두 교육청에 함께 올라 있는 경우(예: 군위군 경북→대구 편입) 한 번만 남긴다 */
export function dedupeSamePlace(list: RealAcademy[]): RealAcademy[] {
  const best = new Map<string, RealAcademy>();
  for (const a of list) {
    const k = `${a.name.replace(/\s/g, '')}|${a.address.replace(/\s/g, '')}`;
    const prev = best.get(k);
    if (!prev || a.courses.length > prev.courses.length || (a.courses.length === prev.courses.length && a.loadedAt > prev.loadedAt)) best.set(k, a);
  }
  return Array.from(best.values());
}

export function buildOutput(snap: RawSnapshot): { manifest: DataManifest; files: Map<string, unknown> } {
  const academies: RealAcademy[] = [];
  const officeStats: DataManifest['offices'] = [];
  let skippedClosed = 0;
  for (const o of snap.offices) {
    const office = EDU_OFFICES.find((e) => e.code === o.code);
    if (!office) continue;
    const seen = new Set<string>();
    let kept = 0;
    for (const raw of o.rows) {
      const row = toNeisAcademy(raw);
      if (seen.has(row.id)) continue; // 페이지가 밀려 같은 학원이 두 번 온 경우
      seen.add(row.id);
      if (row.status && row.status !== '개원') {
        skippedClosed++;
        continue;
      }
      academies.push(toRealAcademy(row, office.sido));
      kept++;
    }
    officeStats.push({ code: o.code, sido: office.sido, total: o.total, fetched: seen.size, kept });
  }

  const byDistrict = new Map<string, RealAcademy[]>();
  const byBucket = new Map<string, RealAcademy[]>();
  for (const a of academies) {
    const k = `${a.sido}|${a.sigungu}`;
    const map = a.unassigned ? byBucket : byDistrict;
    const list = map.get(k);
    if (list) list.push(a);
    else map.set(k, [a]);
  }
  const prepare = (list: RealAcademy[]) => dedupeSamePlace(list).sort((x, y) => x.name.localeCompare(y.name, 'ko'));
  const priced = (list: RealAcademy[]) => list.filter((a) => a.courses.length > 0).length;
  const files = new Map<string, unknown>();
  const all: RealAcademy[] = [];

  const districts: DataManifest['districts'] = DISTRICTS.map((d) => {
    const list = prepare(byDistrict.get(`${d.sido}|${d.sigungu}`) ?? []);
    all.push(...list);
    const file = `d/${d.code}.json`;
    if (list.length) files.set(file, list);
    return { sido: d.sido, sigungu: d.sigungu, code: d.code, file: list.length ? file : null, academies: list.length, priced: priced(list) };
  });
  const buckets: DataManifest['buckets'] = Array.from(byBucket.entries(), ([k, raw]) => {
    const [sido, name] = k.split('|');
    const list = prepare(raw);
    all.push(...list);
    const file = `b/${stableName(k)}.json`;
    files.set(file, list);
    return { sido, name, file, academies: list.length, priced: priced(list) };
  });

  const market = buildMarket(all);
  files.set('market.json', { updatedAt: snap.fetchedAt, rows: market });
  // 파일 내용으로 버전을 붙인다: 같은 원자료를 새 코드로 다시 가공해 내용이 바뀌면 주소도 바뀌고,
  // 매주 받아도 내용이 같은 파일은 휴대폰에 보관해 둔 것을 그대로 쓴다
  const versions: Record<string, string> = {};
  for (const [file, data] of files) versions[file] = stableName(JSON.stringify(data));
  const manifest: DataManifest = {
    version: 2,
    updatedAt: snap.fetchedAt,
    sourceKind: snap.kind,
    ...(snap.baseDate ? { baseDate: snap.baseDate } : {}),
    sampleMode: snap.kind === 'sample',
    source:
      snap.kind === 'api'
        ? '나이스 교육정보 개방 포털 학원교습소정보 Open API'
        : snap.kind === 'file'
          ? `나이스 교육정보 개방 포털 학원교습소정보 전국 파일${snap.fileName ? ` (${snap.fileName})` : ''}`
          : '나이스 학원교습소정보 표본 (개발용)',
    totals: {
      academies: all.length,
      priced: priced(all),
      courses: all.reduce((s, a) => s + a.courses.length, 0),
      unassigned: buckets.reduce((s, b) => s + b.academies, 0),
      skippedClosed,
    },
    offices: officeStats,
    districts,
    buckets,
    versions,
  };
  files.set('manifest.json', manifest);
  return { manifest, files };
}

