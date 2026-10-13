import { ChartColumn, Heart, House, MapPin, Scale, Search, Settings, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { daysSince, useAvailability } from '../hooks';
import { dotDate, kstDate } from '../lib/format';
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
              showToast(`${draft.sido} ${draft.sigungu} 기준으로 학원과 시세를 보여드려요`);
            }}
          >
            이 동네로 설정
          </button>
        }
      >
        <p className="mb-4 text-sm text-ink-2">검색할 때 처음 보여 줄 지역과 홈 화면의 우리 동네 시세에 사용합니다.</p>
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

/** 자동 업데이트가 이만큼 지나도 안 바뀌면 멈췄을 수 있다고 알린다 */
const STALE_DAYS = 9;

function DataStatusBanner() {
  const { loading, mode, manifest, error, retry } = useAvailability();
  if (loading) return null;
  const link = (to: string, label: string) => (
    <Link to={to} className="font-semibold text-accent underline-offset-2 hover:underline">
      {label}
    </Link>
  );
  const age = manifest ? daysSince(manifest.updatedAt) : 0;
  return (
    <div className="border-b border-line bg-surface-2">
      <p className="mx-auto max-w-app px-4 py-1.5 text-[12px] text-ink-2">
        {mode === 'static' && manifest && (
          <>
            <b className="font-semibold text-ink">교육청 학원교습소정보</b> ·{' '}
            {manifest.sourceKind === 'file' && manifest.baseDate ? `전국 파일 ${dotDate(manifest.baseDate)} 기준` : `${kstDate(manifest.updatedAt)} 업데이트 (매주 자동)`}
            {manifest.sampleMode && <b className="ml-1 font-semibold text-pricey">· 표본(일부 학원만)</b>}
            {age >= STALE_DAYS && <b className="ml-1 font-semibold text-pricey">· {age}일 동안 갱신되지 않았어요</b>} · {link('/data', '데이터 안내')}
          </>
        )}
        {mode === 'live' && (
          <>
            <b className="font-semibold text-ink">내 인증키로 교육청 자료 직접 받기</b> · 지역별로 7일 보관 후 다시 받아요 · {link('/data', '데이터 안내')}
          </>
        )}
        {mode === 'error' && (
          <>
            <b className="font-semibold text-pricey">데이터 목록을 불러오지 못했어요</b> · {error}{' '}
            <button type="button" onClick={retry} className="font-semibold text-accent underline-offset-2 hover:underline">
              다시 시도
            </button>
          </>
        )}
        {mode === 'none' && (
          <>
            <b className="font-semibold text-ink">아직 교육청 데이터가 없어요</b> · {link('/settings#neis-key', '인증키 넣기')} · {link('/data', '자동 업데이트 설정 방법')}
          </>
        )}
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
  const { pathname, hash } = useLocation();
  useEffect(() => {
    // '/settings#neis-key' 처럼 해시가 있으면 그 부분으로, 아니면 맨 위로
    const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (target) target.scrollIntoView({ block: 'start' });
    else window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export function Layout() {
  return (
    <div className="min-h-full">
      <ScrollToTop />
      <Header />
      <DataStatusBanner />
      <main className="mx-auto max-w-app px-4 pb-28 pt-3 md:pb-16">
        <Outlet />
      </main>
      <BottomNav />
      <Toast />
    </div>
  );
}
