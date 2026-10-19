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
  /** 바우처 월 지원 한도와 같은 금액 그대로 넣음 (실제 내는 금액으로 바꿀 때까지 시세와 비교하지 않는다) */
  voucherCap?: boolean;
}

export type ThemePref = 'system' | 'light' | 'dark';

export interface ToastAction {
  label: string;
  onClick: () => void;
}
export interface ToastState {
  message: string;
  action?: ToastAction;
}

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
  /** 되돌리기: 지운 찜을 원래 자리에 그대로(찜한 날짜 포함) 다시 넣는다 */
  restoreFavorite: (item: FavoriteItem, index: number) => void;
  isFavorite: (academyId: string) => boolean;

  compare: CompareItem[];
  addCompare: (item: CompareItem) => 'added' | 'updated' | 'full';
  removeCompare: (academyId: string) => void;
  setCompareCourse: (academyId: string, course: string | null) => void;
  clearCompare: () => void;
  /** 되돌리기: 뺀 학원들을 다시 넣는다 (이미 있으면 그대로, 최대 4곳) */
  restoreCompare: (items: CompareItem[]) => void;
  inCompare: (academyId: string) => boolean;

  calc: CalcItem[];
  addCalc: (item: Omit<CalcItem, 'id'>) => void;
  updateCalc: (id: string, patch: Partial<CalcItem>) => void;
  removeCalc: (id: string) => void;
  /** 되돌리기: 지운 항목을 원래 자리에 다시 넣는다 */
  restoreCalc: (item: CalcItem, index: number) => void;

  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  resetAll: () => void;

  toast: ToastState | null;
  /** action: 되돌리기 같은 버튼 (누르면 실행하고 알림을 닫는다) */
  showToast: (message: string, action?: ToastAction) => void;
  hideToast: () => void;
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
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  // 테마: 'system' 이면 속성을 건드리지 않아 OS(또는 호스트) 설정을 따른다.
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', settings.theme);
    // 휴대폰 상태 표시줄 색을 머리글 색과 맞춘다 (테마를 직접 고르면 시스템 설정 대신 그 색)
    const metas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
    for (const m of metas) {
      m.dataset.media ??= m.getAttribute('media') ?? '';
      if (settings.theme === 'system') {
        if (m.dataset.media) m.setAttribute('media', m.dataset.media);
      } else {
        m.removeAttribute('media');
        m.setAttribute('content', settings.theme === 'dark' ? '#161e28' : '#ffffff');
      }
    }
    if (settings.theme === 'system') {
      for (const m of metas) m.setAttribute('content', m.dataset.media?.includes('dark') ? '#161e28' : '#ffffff');
    }
  }, [settings.theme]);

  const hideToast = useCallback(() => {
    window.clearTimeout(toastTimer.current);
    setToast(null);
  }, []);
  const showToast = useCallback((message: string, action?: ToastAction) => {
    setToast({ message, action });
    window.clearTimeout(toastTimer.current);
    // 되돌리기 버튼이 있으면 누를 시간을 더 준다
    toastTimer.current = window.setTimeout(() => setToast(null), action ? 5000 : 2200);
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
    // 되돌리기는 알림을 띄울 때의 목록이 아니라 지금 목록을 보고 판단해야 해서 함수형 업데이트로 한다
    restoreFavorite: (item, index) => setFavorites((prev) => (prev.some((f) => f.id === item.id) ? prev : [...prev.slice(0, index), item, ...prev.slice(index)])),
    isFavorite: (id) => favorites.some((f) => f.id === id),

    compare,
    addCompare,
    removeCompare: (id) => setCompare((prev) => prev.filter((c) => c.ref.id !== id)),
    setCompareCourse: (id, course) => setCompare((prev) => prev.map((c) => (c.ref.id === id ? { ...c, course } : c))),
    clearCompare: () => setCompare([]),
    restoreCompare: (items) =>
      setCompare((prev) => [...prev, ...items.filter((i) => !prev.some((c) => c.ref.id === i.ref.id))].slice(0, MAX_COMPARE)),
    inCompare: (id) => compare.some((c) => c.ref.id === id),

    calc,
    addCalc: (item) => setCalc((prev) => [...prev, { ...item, id: newId('calc') }]),
    updateCalc: (id, patch) => setCalc((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c))),
    removeCalc: (id) => setCalc((prev) => prev.filter((c) => c.id !== id)),
    restoreCalc: (item, index) => setCalc((prev) => (prev.some((c) => c.id === item.id) ? prev : [...prev.slice(0, index), item, ...prev.slice(index)])),

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
    hideToast,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
