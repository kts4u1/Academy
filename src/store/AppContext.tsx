import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { DiscountType, PriceReport } from '../types';
import { findDistrict } from '../data/regions';
import type { Metric } from '../lib/pricing';
import { load, save } from './storage';

export interface CompareItem {
  academyId: string;
  planId: string;
}

export interface CustomCalcEntry {
  name: string;
  monthly: number;
  monthlyExtras: number;
  oneTime: number;
}

export interface CalcItem {
  id: string;
  /** 자녀(또는 본인) 이름 – 합계를 사람별로 나눠 보여준다 */
  person: string;
  academyId?: string;
  planId?: string;
  custom?: CustomCalcEntry;
  discounts: DiscountType[];
  includeOptional: boolean;
}

export type ThemePref = 'system' | 'light' | 'dark';

export interface Settings {
  metric: Metric;
  home: { sido: string; sigungu: string } | null;
  neisKey: string;
  theme: ThemePref;
}

const DEFAULT_SETTINGS: Settings = {
  metric: 'effectiveMonthly',
  home: { sido: '서울', sigungu: '강남구' },
  neisKey: '',
  theme: 'system',
};

export const MAX_COMPARE = 4;

interface AppContextValue {
  favorites: string[];
  toggleFavorite: (academyId: string) => void;
  isFavorite: (academyId: string) => boolean;

  compare: CompareItem[];
  addCompare: (item: CompareItem) => 'added' | 'updated' | 'full';
  removeCompare: (academyId: string) => void;
  setComparePlan: (academyId: string, planId: string) => void;
  clearCompare: () => void;
  inCompare: (academyId: string) => boolean;

  calc: CalcItem[];
  addCalc: (item: Omit<CalcItem, 'id'>) => void;
  updateCalc: (id: string, patch: Partial<CalcItem>) => void;
  removeCalc: (id: string) => void;

  reports: PriceReport[];
  addReport: (report: Omit<PriceReport, 'id' | 'createdAt'>) => void;
  removeReport: (id: string) => void;

  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;

  toast: string | null;
  showToast: (message: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function usePersistent<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => load(key, fallback));
  useEffect(() => save(key, value), [key, value]);
  return [value, setValue] as const;
}

let idCounter = 0;
function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = usePersistent<string[]>('favorites', []);
  const [compare, setCompare] = usePersistent<CompareItem[]>('compare', []);
  const [calc, setCalc] = usePersistent<CalcItem[]>('calc', []);
  const [reports, setReports] = usePersistent<PriceReport[]>('reports', []);
  const [storedSettings, setSettings] = usePersistent<Settings>('settings', DEFAULT_SETTINGS);
  const settings = useMemo(() => {
    const merged = { ...DEFAULT_SETTINGS, ...storedSettings };
    // 지역 목록이 바뀌어 저장된 동네가 더는 없으면 기본값으로 되돌린다
    if (merged.home && !findDistrict(merged.home.sido, merged.home.sigungu)) merged.home = DEFAULT_SETTINGS.home;
    return merged;
  }, [storedSettings]);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  // 테마: 'system' 이면 속성을 건드리지 않아 OS(또는 호스트) 설정을 따른다.
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const toggleFavorite = useCallback(
    (academyId: string) =>
      setFavorites((prev) => (prev.includes(academyId) ? prev.filter((x) => x !== academyId) : [academyId, ...prev])),
    [setFavorites],
  );

  const addCompare = useCallback(
    (item: CompareItem): 'added' | 'updated' | 'full' => {
      if (compare.some((c) => c.academyId === item.academyId)) {
        setCompare((prev) => prev.map((c) => (c.academyId === item.academyId ? item : c)));
        return 'updated';
      }
      if (compare.length >= MAX_COMPARE) return 'full';
      setCompare((prev) => [...prev, item]);
      return 'added';
    },
    [compare, setCompare],
  );

  const value: AppContextValue = {
    favorites,
    toggleFavorite,
    isFavorite: (id) => favorites.includes(id),

    compare,
    addCompare,
    removeCompare: (id) => setCompare((prev) => prev.filter((c) => c.academyId !== id)),
    setComparePlan: (academyId, planId) =>
      setCompare((prev) => prev.map((c) => (c.academyId === academyId ? { academyId, planId } : c))),
    clearCompare: () => setCompare([]),
    inCompare: (id) => compare.some((c) => c.academyId === id),

    calc,
    addCalc: (item) => setCalc((prev) => [...prev, { ...item, id: newId('calc') }]),
    updateCalc: (id, patch) => setCalc((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c))),
    removeCalc: (id) => setCalc((prev) => prev.filter((c) => c.id !== id)),

    reports,
    addReport: (report) =>
      setReports((prev) => [{ ...report, id: newId('report'), createdAt: new Date().toISOString().slice(0, 10) }, ...prev]),
    removeReport: (id) => setReports((prev) => prev.filter((r) => r.id !== id)),

    settings,
    updateSettings: (patch) => setSettings((prev) => ({ ...DEFAULT_SETTINGS, ...prev, ...patch })),

    toast,
    showToast,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
