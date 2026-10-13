// 앱이 학원 데이터를 얻는 곳
//
// 1) 정적 파일 (기본): GitHub Actions 가 매주 교육청 자료를 받아 public/data/ 에 만들어 둔 파일.
//    누구나 인증키 없이 같은 최신 데이터를 본다.
// 2) 내 인증키로 바로 받기: 정적 파일이 아직 없을 때(로컬 실행 등) 설정에 넣은 인증키로
//    선택한 시·군·구만 교육청에서 직접 받고, 브라우저에 7일 동안 보관한 뒤 다시 받는다.
// 가짜·예시 데이터는 쓰지 않는다.

import { idbClear, idbGet, idbSet } from '../store/idb';
import { fetchAllNeisAcademies } from '../lib/neis';
import { buildMarket, toRealAcademy, type MarketRow, type RealAcademy } from '../lib/realData';
import { MANIFEST_VERSION, type DataManifest } from './manifest';
import { bucketsFor, EDU_OFFICES, filterNeisForDistrict, findDistrict, neisZoneNames } from './regions';

const BASE = 'data/';
/** 브라우저에서 받은 데이터를 다시 받는 주기 */
export const LIVE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type DataMode = 'static' | 'live';

export interface DistrictData {
  mode: DataMode;
  sido: string;
  sigungu: string;
  /** 이 시·군·구로 배정된 학원 */
  academies: RealAcademy[];
  /** 주소로 구를 정하지 못한 같은 시 학원 (이 구일 수도 있음) */
  unknownDistrict: RealAcademy[];
  /** 구를 모르는 곳이 절반을 넘어 시 전체 기준으로 봐야 하는지 */
  cityWide: boolean;
  updatedAt: string;
  sampleMode: boolean;
}

let manifestPromise: Promise<DataManifest | null> | null = null;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url, init);
  } catch {
    throw new Error('데이터를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.');
  }
  if (!r.ok) throw Object.assign(new Error(`데이터를 불러오지 못했어요 (${r.status}). 잠시 후 다시 시도해 주세요.`), { status: r.status });
  return (await r.json()) as T;
}

/**
 * 정적 데이터 목록. 배포된 적이 없으면(404) null.
 * 연결 오류는 기억하지 않고 던져서, 다시 시도하면 새로 받는다.
 */
export function loadManifest(): Promise<DataManifest | null> {
  manifestPromise ??= fetchJson<DataManifest>(`${BASE}manifest.json`, { cache: 'no-cache' })
    .then((m) => (m && m.version === MANIFEST_VERSION ? m : null))
    .catch((err: Error & { status?: number }) => {
      if (err.status === 404) return null;
      manifestPromise = null;
      throw err;
    });
  return manifestPromise;
}

/**
 * 매주 내용이 바뀌는 파일이라 갱신 시각을 붙여 브라우저 캐시의 옛 파일을 쓰지 않게 한다.
 * (단일 파일 데모는 파일을 함께 올리는 곳이 캐시를 맡으므로 붙이지 않는다)
 */
const SINGLE = typeof __SINGLE_FILE__ !== 'undefined' && __SINGLE_FILE__;
const versioned = (m: DataManifest, file: string) => (SINGLE ? BASE + file : `${BASE}${file}?v=${encodeURIComponent(m.updatedAt)}`);

const fileCache = new Map<string, Promise<RealAcademy[]>>();
function loadFile(m: DataManifest, file: string): Promise<RealAcademy[]> {
  const url = versioned(m, file);
  let p = fileCache.get(url);
  if (!p) {
    p = fetchJson<RealAcademy[]>(url);
    p.catch(() => fileCache.delete(url));
    fileCache.set(url, p);
  }
  return p;
}

let marketPromise: Promise<MarketRow[]> | null = null;
export async function loadStaticMarket(): Promise<MarketRow[]> {
  const m = await loadManifest();
  if (!m) return [];
  marketPromise ??= fetchJson<{ rows: MarketRow[] }>(versioned(m, 'market.json'))
    .then((d) => d.rows)
    .catch((err) => {
      marketPromise = null;
      throw err;
    });
  return marketPromise;
}

async function loadStaticDistrict(m: DataManifest, sido: string, sigungu: string): Promise<DistrictData> {
  const entry = m.districts.find((d) => d.sido === sido && d.sigungu === sigungu);
  const academies = entry?.file ? await loadFile(m, entry.file) : [];
  const bucketNames = new Set(bucketsFor({ sido, sigungu }));
  const bucketFiles = m.buckets.filter((b) => b.sido === sido && bucketNames.has(b.name));
  const unknownDistrict = (await Promise.all(bucketFiles.map((b) => loadFile(m, b.file)))).flat();
  const cityWide = unknownDistrict.length > 0 && unknownDistrict.length / (unknownDistrict.length + academies.length) > 0.5;
  return { mode: 'static', sido, sigungu, academies, unknownDistrict, cityWide, updatedAt: m.updatedAt, sampleMode: m.sampleMode };
}

interface LiveCacheEntry {
  fetchedAt: number;
  academies: RealAcademy[];
  unknownDistrict: RealAcademy[];
  cityWide: boolean;
  sampleMode: boolean;
}

const liveKey = (sido: string, sigungu: string) => `district:${sido}|${sigungu}`;

async function loadLiveDistrict(
  key: string,
  sido: string,
  sigungu: string,
  options: { force?: boolean; onProgress?: (message: string) => void },
): Promise<DistrictData> {
  const district = findDistrict(sido, sigungu);
  if (!district) throw new Error('알 수 없는 지역입니다.');
  const cached = await idbGet<LiveCacheEntry>(liveKey(sido, sigungu));
  if (cached && !options.force && Date.now() - cached.fetchedAt < LIVE_TTL_MS && cached.sampleMode === !key) {
    return { mode: 'live', sido, sigungu, ...cached, updatedAt: new Date(cached.fetchedAt).toISOString() };
  }
  const office = EDU_OFFICES.find((o) => o.sido === sido)!;
  const byId = new Map<string, Parameters<typeof toRealAcademy>[0]>();
  let sampleMode = false;
  for (const zone of neisZoneNames(district)) {
    const r = await fetchAllNeisAcademies(
      { key, officeCode: office.code, sigungu: zone },
      { maxRows: 10000, pageDelayMs: 200, onProgress: (n, total) => options.onProgress?.(`${zone} ${n.toLocaleString()} / ${total.toLocaleString()}곳 받는 중…`) },
    );
    sampleMode = sampleMode || r.sampleMode;
    for (const row of r.rows) if (!row.status || row.status === '개원') byId.set(row.id, row);
  }
  const filtered = filterNeisForDistrict(Array.from(byId.values()), district);
  const all = filtered.rows.map((row) => toRealAcademy(row, sido));
  const entry: LiveCacheEntry = {
    fetchedAt: Date.now(),
    academies: all.filter((a) => !a.unassigned),
    unknownDistrict: all.filter((a) => a.unassigned),
    cityWide: filtered.cityWide,
    sampleMode,
  };
  // 보관이 실패해도(저장 공간 부족 등) 받은 데이터는 바로 보여 준다
  void idbSet(liveKey(sido, sigungu), entry).catch(() => undefined);
  return { mode: 'live', sido, sigungu, ...entry, updatedAt: new Date(entry.fetchedAt).toISOString() };
}

export type DataAvailability = { mode: 'static'; manifest: DataManifest } | { mode: 'live' } | { mode: 'none' };

export async function dataAvailability(neisKey: string): Promise<DataAvailability> {
  const m = await loadManifest();
  if (m) return { mode: 'static', manifest: m };
  return neisKey.trim() ? { mode: 'live' } : { mode: 'none' };
}

/** 시·군·구 하나의 학원 데이터. 쓸 수 있는 데이터가 없으면 null */
export async function loadDistrictData(
  sido: string,
  sigungu: string,
  options: { neisKey: string; force?: boolean; onProgress?: (message: string) => void },
): Promise<DistrictData | null> {
  const m = await loadManifest();
  if (m) return loadStaticDistrict(m, sido, sigungu);
  const key = options.neisKey.trim();
  if (!key) return null;
  // 같은 지역을 여러 화면이 동시에 요청해도 한 번만 받는다
  const flightKey = `${key}|${sido}|${sigungu}|${options.force ? 'force' : ''}`;
  let p = inFlight.get(flightKey);
  if (!p) {
    p = loadLiveDistrict(key, sido, sigungu, options).finally(() => inFlight.delete(flightKey));
    inFlight.set(flightKey, p);
  }
  return p;
}

const inFlight = new Map<string, Promise<DistrictData>>();

/** 브라우저에 보관한 교육청 데이터 지우기 */
export async function clearLiveCache(): Promise<void> {
  await idbClear();
}

/** 시세: 정적 데이터면 전국 시세 파일, 브라우저에서 받았으면 받은 지역으로 계산 */
export async function loadMarketRows(district: DistrictData | null): Promise<MarketRow[]> {
  if (district?.mode === 'live') return buildMarket([...district.academies, ...district.unknownDistrict]);
  if (await loadManifest()) return loadStaticMarket();
  return [];
}

/** 테스트용: 모듈 캐시 비우기 */
export function resetDataCaches() {
  manifestPromise = null;
  inFlight.clear();
  marketPromise = null;
  fileCache.clear();
}
