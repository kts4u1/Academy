import { useMemo } from 'react';
import { getAcademies } from './data';
import { findDistrict } from './data/regions';
import type { Origin } from './lib/search';
import { useApp } from './store/AppContext';

export function useAcademies() {
  return useMemo(() => getAcademies(), []);
}

/** 내 동네 중심 좌표 (거리 계산 기준) */
export function useOrigin(): Origin | null {
  const { settings } = useApp();
  return useMemo(() => {
    if (!settings.home) return null;
    const d = findDistrict(settings.home.sido, settings.home.sigungu);
    return d ? { lat: d.lat, lng: d.lng } : null;
  }, [settings.home]);
}
