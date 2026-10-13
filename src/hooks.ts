import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DataManifest } from './data/manifest';
import { loadDistrictData, loadManifest, loadStaticMarket, type DataMode, type DistrictData } from './data/source';
import { neisErrorMessage } from './lib/neis';
import { buildMarket, type MarketRow } from './lib/realData';
import { useApp } from './store/AppContext';

interface ManifestState {
  loading: boolean;
  manifest: DataManifest | null;
  error: string | null;
}

/** 매주 만들어지는 정적 데이터 목록 (배포된 적이 없으면 null) */
export function useManifest(): ManifestState & { retry: () => void } {
  const [state, setState] = useState<ManifestState>({ loading: true, manifest: null, error: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    loadManifest()
      .then((manifest) => alive && setState({ loading: false, manifest, error: null }))
      .catch((err) => alive && setState({ loading: false, manifest: null, error: neisErrorMessage(err) }));
    return () => {
      alive = false;
    };
  }, [tick]);
  const retry = useCallback(() => {
    setState({ loading: true, manifest: null, error: null });
    setTick((n) => n + 1);
  }, []);
  return { ...state, retry };
}

export type Availability = 'static' | 'live' | 'none' | 'error';

/** 지금 쓸 수 있는 데이터: 정적 파일 · 브라우저에서 내 인증키로 받기 · 없음 · 목록을 못 받음 */
export function useAvailability(): { loading: boolean; mode: Availability; manifest: DataManifest | null; error: string | null; retry: () => void } {
  const { loading, manifest, error, retry } = useManifest();
  const { settings } = useApp();
  if (loading) return { loading, mode: 'none', manifest, error, retry };
  if (manifest) return { loading, mode: 'static', manifest, error, retry };
  if (error) return { loading, mode: 'error', manifest, error, retry };
  return { loading, mode: settings.neisKey.trim() ? 'live' : 'none', manifest, error, retry };
}

/** 정적 데이터가 몇 날 지났는지 (자동 업데이트가 멈췄는지 알리는 데 쓴다) */
export function daysSince(iso: string, now = Date.now()): number {
  return Math.floor((now - Date.parse(iso)) / 86_400_000);
}

export type DistrictStatus = 'idle' | 'loading' | 'ready' | 'nodata' | 'error';

export interface DistrictState {
  status: DistrictStatus;
  data: DistrictData | null;
  progress: string | null;
  /** status 가 error 일 때, 또는 데이터는 있는데 '지금 다시 받기'가 실패했을 때 */
  error: string | null;
}

const LOADING: DistrictState = { status: 'loading', data: null, progress: null, error: null };
const regionKey = (r: { sido: string; sigungu: string }) => `${r.sido}|${r.sigungu}`;

/**
 * 여러 시·군·구의 학원 데이터 (비교함·내 학원비처럼 지역이 섞일 때).
 * 결과는 'sido|sigungu' 키로 찾는다.
 */
export function useDistricts(regions: { sido: string; sigungu: string }[]): { states: Map<string, DistrictState>; loading: boolean; reload: () => void } {
  const { settings } = useApp();
  const keys = Array.from(new Set(regions.filter((r) => r.sido && r.sigungu).map(regionKey))).sort();
  const keyString = keys.join('\n');
  const [states, setStates] = useState<Map<string, DistrictState>>(new Map());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const list = keyString ? keyString.split('\n') : [];
    // 이미 받아 둔 지역은 그대로 두고 새 지역만 '불러오는 중'으로 바꾼다
    setStates((prev) => new Map(list.map((k) => [k, prev.get(k)?.status === 'ready' ? prev.get(k)! : LOADING])));
    for (const k of list) {
      const [sido, sigungu] = k.split('|');
      const set = (patch: Partial<DistrictState>) => alive && setStates((prev) => new Map(prev).set(k, { ...(prev.get(k) ?? LOADING), ...patch }));
      loadDistrictData(sido, sigungu, { neisKey: settings.neisKey, onProgress: (progress) => set({ progress }) })
        .then((data) => set(data ? { status: 'ready', data, progress: null, error: null } : { status: 'nodata', data: null, progress: null }))
        .catch((err) => set({ status: 'error', data: null, error: neisErrorMessage(err), progress: null }));
    }
    return () => {
      alive = false;
    };
  }, [keyString, settings.neisKey, tick]);

  const loading = keys.some((k) => (states.get(k) ?? LOADING).status === 'loading');
  /**
   * 데이터를 다시 받는다. 브라우저에서 받은 지역은 교육청에서 새로 받고, 정적 데이터는 다시 읽는다.
   * 다시 받기가 실패하면 보던 데이터는 그대로 두고 오류만 알린다.
   */
  const reload = useCallback(() => {
    const list = keyString ? keyString.split('\n') : [];
    let before = new Map<string, DistrictState>();
    setStates((prev) => {
      before = prev;
      return new Map(list.map((k) => [k, { ...(prev.get(k) ?? LOADING), status: 'loading' as const, progress: null, error: null }]));
    });
    Promise.allSettled(
      list.map((k) => {
        const [sido, sigungu] = k.split('|');
        return loadDistrictData(sido, sigungu, {
          neisKey: settings.neisKey,
          force: true,
          onProgress: (progress) => setStates((prev) => new Map(prev).set(k, { ...(prev.get(k) ?? LOADING), progress })),
        });
      }),
    ).then((results) => {
      const failed = results.flatMap((r, i) => (r.status === 'rejected' ? [[list[i], neisErrorMessage(r.reason)] as const] : []));
      if (failed.length === 0) return setTick((n) => n + 1);
      setStates((prev) => {
        const next = new Map(prev);
        for (const [k, error] of failed) {
          const old = before.get(k);
          next.set(k, old?.data ? { ...old, status: 'ready', progress: null, error } : { status: 'error', data: null, progress: null, error });
        }
        return next;
      });
    });
  }, [keyString, settings.neisKey]);
  return { states, loading, reload };
}

/** 시·군·구 하나의 학원 데이터 */
export function useDistrictData(sido: string, sigungu: string): DistrictState & { reload: () => void } {
  const regions = useMemo(() => (sido && sigungu ? [{ sido, sigungu }] : []), [sido, sigungu]);
  const { states, reload } = useDistricts(regions);
  const state: DistrictState = sido && sigungu ? (states.get(`${sido}|${sigungu}`) ?? LOADING) : { status: 'idle', data: null, progress: null, error: null };
  return { ...state, reload };
}

/**
 * 교습비 시세. 정적 데이터면 전국 시세 파일을, 브라우저에서 받았으면 받은 지역들로 계산한다.
 */
export function useMarket(datas: (DistrictData | null | undefined)[]): { rows: MarketRow[]; mode: DataMode | null; loading: boolean; error: string | null } {
  const live = datas.filter((d): d is DistrictData => d?.mode === 'live');
  const liveKey = live.map((d) => `${d.sido}|${d.sigungu}|${d.updatedAt}`).join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const liveRows = useMemo(() => (live.length ? buildMarket(live.flatMap((d) => [...d.academies, ...d.unknownDistrict])) : null), [liveKey]);
  const { manifest, loading: manifestLoading } = useManifest();
  const [staticState, setStaticState] = useState<{ rows: MarketRow[] | null; error: string | null }>({ rows: null, error: null });
  useEffect(() => {
    if (!manifest) return;
    let alive = true;
    loadStaticMarket()
      .then((rows) => alive && setStaticState({ rows, error: null }))
      .catch((err) => alive && setStaticState({ rows: [], error: neisErrorMessage(err) }));
    return () => {
      alive = false;
    };
  }, [manifest]);
  if (manifest) return { rows: staticState.rows ?? [], mode: 'static', loading: staticState.rows === null, error: staticState.error };
  if (liveRows) return { rows: liveRows, mode: 'live', loading: false, error: null };
  return { rows: [], mode: null, loading: manifestLoading, error: null };
}
