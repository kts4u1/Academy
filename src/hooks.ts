import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DataManifest } from './data/manifest';
import { loadDistrictData, loadManifest, loadStaticMarket, type DataMode, type DistrictData } from './data/source';
import { neisErrorMessage } from './lib/neis';
import { buildMarket, type MarketRow } from './lib/realData';
import { useApp } from './store/AppContext';

/** 매주 만들어지는 정적 데이터 목록 (없으면 null) */
export function useManifest(): { loading: boolean; manifest: DataManifest | null } {
  const [state, setState] = useState<{ loading: boolean; manifest: DataManifest | null }>({ loading: true, manifest: null });
  useEffect(() => {
    let alive = true;
    loadManifest().then((manifest) => alive && setState({ loading: false, manifest }));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

/** 지금 쓸 수 있는 데이터: 정적 파일 · 브라우저에서 내 인증키로 받기 · 없음 */
export function useAvailability(): { loading: boolean; mode: DataMode | 'none'; manifest: DataManifest | null } {
  const { loading, manifest } = useManifest();
  const { settings } = useApp();
  if (loading) return { loading, mode: 'none', manifest };
  if (manifest) return { loading, mode: 'static', manifest };
  return { loading, mode: settings.neisKey.trim() ? 'live' : 'none', manifest };
}

export type DistrictStatus = 'idle' | 'loading' | 'ready' | 'nodata' | 'error';

export interface DistrictState {
  status: DistrictStatus;
  data: DistrictData | null;
  progress: string | null;
  error: string | null;
}

const regionKey = (r: { sido: string; sigungu: string }) => `${r.sido}|${r.sigungu}`;

/**
 * 여러 시·군·구의 학원 데이터 (비교함·찜·내 학원비처럼 지역이 섞일 때).
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
    setStates(new Map(list.map((k) => [k, { status: 'loading', data: null, progress: null, error: null }])));
    for (const k of list) {
      const [sido, sigungu] = k.split('|');
      const set = (patch: Partial<DistrictState>) =>
        alive && setStates((prev) => new Map(prev).set(k, { ...(prev.get(k) ?? { status: 'loading', data: null, progress: null, error: null }), ...patch }));
      loadDistrictData(sido, sigungu, { neisKey: settings.neisKey, onProgress: (progress) => set({ progress }) })
        .then((data) => set(data ? { status: 'ready', data, progress: null } : { status: 'nodata', progress: null }))
        .catch((err) => set({ status: 'error', error: neisErrorMessage(err), progress: null }));
    }
    return () => {
      alive = false;
    };
  }, [keyString, settings.neisKey, tick]);

  const loading = keys.some((k) => (states.get(k)?.status ?? 'loading') === 'loading');
  // 브라우저에서 받은 데이터를 지금 다시 받는다 (정적 데이터는 매주 자동으로 바뀌므로 그대로 다시 읽는다)
  const reload = useCallback(() => {
    const list = keyString ? keyString.split('\n') : [];
    setStates((prev) => new Map(list.map((k) => [k, { ...(prev.get(k) ?? { data: null, error: null }), status: 'loading' as const, progress: null, error: null }])));
    Promise.allSettled(
      list.map((k) => {
        const [sido, sigungu] = k.split('|');
        return loadDistrictData(sido, sigungu, {
          neisKey: settings.neisKey,
          force: true,
          onProgress: (progress) => setStates((prev) => new Map(prev).set(k, { ...prev.get(k)!, progress })),
        });
      }),
    ).then((results) => {
      const failed = results.flatMap((r, i) => (r.status === 'rejected' ? [[list[i], neisErrorMessage(r.reason)] as const] : []));
      if (failed.length === 0) return setTick((n) => n + 1);
      setStates((prev) => {
        const next = new Map(prev);
        for (const [k, error] of failed) next.set(k, { status: 'error', data: null, progress: null, error });
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
  const state = sido && sigungu ? (states.get(`${sido}|${sigungu}`) ?? { status: 'loading', data: null, progress: null, error: null }) : { status: 'idle' as const, data: null, progress: null, error: null };
  return { ...state, reload };
}

/**
 * 교습비 시세. 정적 데이터면 전국 시세 파일을, 브라우저에서 받았으면 받은 지역들로 계산한다.
 */
export function useMarket(datas: (DistrictData | null | undefined)[]): { rows: MarketRow[]; mode: DataMode | null; loading: boolean } {
  const live = datas.filter((d): d is DistrictData => d?.mode === 'live');
  const liveKey = live.map((d) => `${d.sido}|${d.sigungu}|${d.updatedAt}`).join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const liveRows = useMemo(() => (live.length ? buildMarket(live.flatMap((d) => [...d.academies, ...d.unknownDistrict])) : null), [liveKey]);
  const { manifest, loading: manifestLoading } = useManifest();
  const [staticRows, setStaticRows] = useState<MarketRow[] | null>(null);
  useEffect(() => {
    if (!manifest) return;
    let alive = true;
    loadStaticMarket().then((rows) => alive && setStaticRows(rows));
    return () => {
      alive = false;
    };
  }, [manifest]);
  if (manifest) return { rows: staticRows ?? [], mode: 'static', loading: staticRows === null };
  if (liveRows) return { rows: liveRows, mode: 'live', loading: false };
  return { rows: [], mode: null, loading: manifestLoading };
}
