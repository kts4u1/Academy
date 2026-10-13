import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { findDistrict } from '../data/regions';
import type { AcademyRef, AgeGroup } from '../types';
import { load, remove, save } from './storage';

/** 찜한 학원: 목록에서 바로 보여 줄 수 있게 이름·동·종류를 함께 저장한다 */
export interface FavoriteItem extends AcademyRef {
  dong: string;
  /** 화면에 보여 줄 위치 (구 미상 학원은 '성남시(구 미상) 정자동') */
  place?: string;
  kind: string;
  subjects: string[];
  addedAt: string;
}

/** 비교함: 학원 + 비교할 과정 키 (courseKey: 이름|금액, 교습비가 없으면 null) */
export interface CompareItem {
  ref: AcademyRef;
  course: string | null;
}

/** 내 학원비 항목. 교육청 자료에서 고른 과정이거나 직접 입력한 금액 */
export interface CalcItem {
  id: string;
  /** 자녀(또는 본인) 이름 – 합계를 사람별로 나눠 보여준다 */
  person: string;
  name: string;
  /** 실제로 내는 월 금액 */
  monthly: number;
  subjectId: string | null;
  age: AgeGroup | null;
  /** 시세 비교 기준 지역 */
  sido: string;
  sigungu: string;
  ref?: AcademyRef;
  /** 과정 키 (courseKey) */
  course?: string;
  /** 교육청 신고 교습비 (고를 때 기준) */
  reportedPrice?: number;
  /** 특강·1:1 처럼 월 시세와 비교하지 않는 과정 */
  noMarket?: boolean;
}

export type ThemePref = 'system' | 'light' | 'dark';

export interface Settings {
  home: { sido: string; sigungu: string } | null;
  /** 정적 데이터가 없을 때(로컬 실행 등) 브라우저에서 교육청 자료를 직접 받는 데 쓰는 인증키 */
  neisKey: string;
  theme: ThemePref;
}

const DEFAULT_SETTINGS: Settings = {
  home: null,
  neisKey: '',
  theme: 'system',
};

export const MAX_COMPARE = 4;

interface AppContextValue {
  favorites: FavoriteItem[];
  toggleFavorite: (item: Omit<FavoriteItem, 'addedAt'>) => boolean;
  isFavorite: (academyId: string) => boolean;

  compare: CompareItem[];
  addCompare: (item: CompareItem) => 'added' | 'updated' | 'full';
  removeCompare: (academyId: string) => void;
  setCompareCourse: (academyId: string, course: string | null) => void;
  clearCompare: () => void;
  inCompare: (academyId: string) => boolean;

  calc: CalcItem[];
  addCalc: (item: Omit<CalcItem, 'id'>) => void;
  updateCalc: (id: string, patch: Partial<CalcItem>) => void;
  removeCalc: (id: string) => void;

  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  resetAll: () => void;

  toast: string | null;
  showToast: (message: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

// 예시 데이터를 쓰던 때의 저장값(가짜 학원 id)은 더는 의미가 없어 지운다.
const LEGACY_KEYS = ['favorites', 'compare', 'calc', 'reports'];

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
  useState(() => LEGACY_KEYS.forEach(remove));
  const [favorites, setFavorites] = usePersistent<FavoriteItem[]>('v2:favorites', []);
  const [compare, setCompare] = usePersistent<CompareItem[]>('v2:compare', []);
  const [calc, setCalc] = usePersistent<CalcItem[]>('v2:calc', []);
  const [storedSettings, setSettings] = usePersistent<Settings>('settings', DEFAULT_SETTINGS);
  const settings = useMemo(() => {
    const merged: Settings = { home: storedSettings.home ?? null, neisKey: storedSettings.neisKey ?? '', theme: storedSettings.theme ?? 'system' };
    // 지역 목록이 바뀌어 저장된 동네가 더는 없으면 비운다
    if (merged.home && !findDistrict(merged.home.sido, merged.home.sigungu)) merged.home = null;
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
    (item: Omit<FavoriteItem, 'addedAt'>) => {
      const exists = favorites.some((f) => f.id === item.id);
      setFavorites((prev) => (exists ? prev.filter((f) => f.id !== item.id) : [{ ...item, addedAt: new Date().toISOString().slice(0, 10) }, ...prev]));
      return !exists;
    },
    [favorites, setFavorites],
  );

  const addCompare = useCallback(
    (item: CompareItem): 'added' | 'updated' | 'full' => {
      if (compare.some((c) => c.ref.id === item.ref.id)) {
        setCompare((prev) => prev.map((c) => (c.ref.id === item.ref.id ? item : c)));
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
    isFavorite: (id) => favorites.some((f) => f.id === id),

    compare,
    addCompare,
    removeCompare: (id) => setCompare((prev) => prev.filter((c) => c.ref.id !== id)),
    setCompareCourse: (id, course) => setCompare((prev) => prev.map((c) => (c.ref.id === id ? { ...c, course } : c))),
    clearCompare: () => setCompare([]),
    inCompare: (id) => compare.some((c) => c.ref.id === id),

    calc,
    addCalc: (item) => setCalc((prev) => [...prev, { ...item, id: newId('calc') }]),
    updateCalc: (id, patch) => setCalc((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c))),
    removeCalc: (id) => setCalc((prev) => prev.filter((c) => c.id !== id)),

    settings,
    updateSettings: (patch) => setSettings((prev) => ({ ...DEFAULT_SETTINGS, ...prev, ...patch })),
    resetAll: () => {
      setFavorites([]);
      setCompare([]);
      setCalc([]);
      setSettings(DEFAULT_SETTINGS);
    },

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
