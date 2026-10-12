import { ChartColumn, Heart, House, MapPin, Scale, Search, Settings, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { RegionPicker } from './RegionPicker';
import { Sheet } from './ui';

const TABS = [
  { to: '/', label: '홈', icon: House, end: true },
  { to: '/search', label: '검색', icon: Search },
  { to: '/compare', label: '비교', icon: Scale },
  { to: '/market', label: '시세', icon: ChartColumn },
  { to: '/budget', label: '내 학원비', icon: Wallet },
];

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2" aria-label="학원비교 홈">
      <svg width="28" height="28" viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="rgb(var(--accent))" />
        <path d="M18 16h17l13 13-17 19-15-15V18a2 2 0 0 1 2-2z" fill="rgb(var(--tag))" />
        <circle cx="26" cy="25" r="3.5" fill="rgb(var(--accent))" />
      </svg>
      <span className="text-[19px] font-bold tracking-tight">학원비교</span>
    </Link>
  );
}

function LocationChip() {
  const { settings, updateSettings, showToast } = useApp();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(settings.home ?? { sido: '서울', sigungu: '강남구' });
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDraft(settings.home ?? { sido: '서울', sigungu: '강남구' });
          setOpen(true);
        }}
        className="inline-flex max-w-[9rem] items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-[13px] font-semibold text-ink-2 hover:bg-surface-2"
        aria-label="내 동네 설정"
      >
        <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-accent" />
        <span className="truncate">{settings.home ? settings.home.sigungu : '동네 설정'}</span>
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="내 동네 설정"
        footer={
          <button
            type="button"
            className="btn-primary w-full"
            onClick={() => {
              updateSettings({ home: draft });
              setOpen(false);
              showToast(`${draft.sido} ${draft.sigungu} 기준으로 거리와 시세를 보여드려요`);
            }}
          >
            이 동네로 설정
          </button>
        }
      >
        <p className="mb-4 text-sm text-ink-2">거리순 정렬과 홈 화면의 우리 동네 시세에 사용합니다.</p>
        <RegionPicker idPrefix="home" sido={draft.sido} sigungu={draft.sigungu} allowAll={false} onChange={(sido, sigungu) => setDraft({ sido, sigungu })} />
      </Sheet>
    </>
  );
}

function Header() {
  const { favorites, compare } = useApp();
  return (
    <header
      className="sticky z-30 border-b border-line bg-surface/95 backdrop-blur"
      style={{ top: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="mx-auto flex h-14 max-w-app items-center gap-3 px-4">
        <Logo />
        <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="주요 메뉴">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `relative rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${isActive ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-surface-2'}`
              }
            >
              {tab.label}
              {tab.to === '/compare' && compare.length > 0 && (
                <span className="ml-1 rounded-full bg-accent px-1.5 text-[11px] text-on-accent">{compare.length}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <LocationChip />
          <Link to="/favorites" className="relative rounded-lg p-2 text-ink-2 hover:bg-surface-2" aria-label={`찜한 학원 ${favorites.length}곳`}>
            <Heart className="h-5 w-5" />
            {favorites.length > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-pricey" aria-hidden="true" />}
          </Link>
          <Link to="/settings" className="rounded-lg p-2 text-ink-2 hover:bg-surface-2" aria-label="설정">
            <Settings className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function BottomNav() {
  const { compare } = useApp();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="하단 메뉴"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${isActive ? 'text-accent' : 'text-ink-3'}`
              }
            >
              <Icon aria-hidden="true" className="h-[22px] w-[22px]" />
              {label}
              {to === '/compare' && compare.length > 0 && (
                <span className="absolute left-1/2 top-1 ml-2 min-w-[18px] rounded-full bg-accent px-1 text-center text-[10px] leading-[18px] text-on-accent">
                  {compare.length}
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function SampleBanner() {
  return (
    <div className="border-b border-line bg-surface-2">
      <p className="mx-auto max-w-app px-4 py-1.5 text-[12px] text-ink-2">
        <b className="font-semibold text-ink">데모 데이터</b> · 학원명·주소·가격·후기는 예시예요.{' '}
        <Link to="/data" className="font-semibold text-accent underline-offset-2 hover:underline">
          무엇이 실제인지 보기
        </Link>
        {' · '}
        <Link to="/neis" className="font-semibold text-accent underline-offset-2 hover:underline">
          교육청 실데이터 조회 →
        </Link>
      </p>
    </div>
  );
}

function Toast() {
  const { toast } = useApp();
  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 md:bottom-8" role="status" aria-live="polite">
      <div className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-bg shadow-lg">{toast}</div>
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function Layout() {
  return (
    <div className="min-h-full">
      <ScrollToTop />
      <Header />
      <SampleBanner />
      <main className="mx-auto max-w-app px-4 pb-28 pt-3 md:pb-16">
        <Outlet />
      </main>
      <BottomNav />
      <Toast />
    </div>
  );
}
