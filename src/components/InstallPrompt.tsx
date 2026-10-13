import { Download, Share, SquarePlus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { load, save } from '../store/storage';

// 홈 화면에 앱처럼 설치하기
// - 안드로이드 Chrome·삼성 인터넷 등: 브라우저가 주는 설치 창(beforeinstallprompt)을 띄운다
// - iPhone·iPad Safari: 설치 창이 없어서 '공유 → 홈 화면에 추가' 방법을 안내한다
// - 카카오톡·네이버 앱 같은 앱 안 브라우저: 설치가 안 되므로 다른 브라우저로 열도록 안내한다

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  // 이 이벤트는 화면이 그려지기 전에 올 수 있어 모듈을 읽을 때 바로 받아 둔다
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    save('install-dismissed', true);
    notify();
  });
}

export type InstallMode = 'prompt' | 'ios' | 'in-app' | 'none';

/** 단일 파일 데모는 다른 페이지 안에 들어가 있어 설치·오프라인이 안 된다 */
const SINGLE = typeof __SINGLE_FILE__ !== 'undefined' && __SINGLE_FILE__;

function detect(): { standalone: boolean; mode: InstallMode } {
  if (typeof window === 'undefined') return { standalone: false, mode: 'none' };
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const standalone = Boolean(window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone);
  const ua = nav.userAgent;
  const inApp = /KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|Line\//i.test(ua);
  const ios = /iPhone|iPad|iPod/.test(ua) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  const mode: InstallMode = deferred ? 'prompt' : inApp ? 'in-app' : ios ? 'ios' : 'none';
  return { standalone, mode };
}

export function useInstall() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  const { standalone, mode } = detect();
  return {
    standalone,
    mode,
    /** 브라우저 설치 창 띄우기 */
    install: async (): Promise<boolean> => {
      if (!deferred) return false;
      const e = deferred;
      await e.prompt();
      const { outcome } = await e.userChoice;
      deferred = null;
      notify();
      return outcome === 'accepted';
    },
  };
}

function Guide({ mode }: { mode: InstallMode }) {
  if (mode === 'ios')
    return (
      <span>
        Safari 아래쪽 <Share aria-label="공유" className="inline h-4 w-4 align-[-3px]" /> 공유 버튼을 누르고 <b className="text-ink">홈 화면에 추가</b>
        <SquarePlus aria-hidden="true" className="ml-0.5 inline h-4 w-4 align-[-3px]" />를 고르세요.
      </span>
    );
  if (mode === 'in-app')
    return (
      <span>
        카카오톡 같은 앱 안에서는 설치할 수 없어요. 오른쪽 위 메뉴에서 <b className="text-ink">다른 브라우저로 열기</b>(Safari·Chrome)를 고른 뒤 설치하세요.
      </span>
    );
  return <span>브라우저 메뉴의 ‘홈 화면에 추가’ 또는 ‘앱 설치’를 누르세요.</span>;
}

/** 홈 화면 위쪽 안내 (휴대폰에서만, 닫으면 다시 안 보임) */
export function InstallBanner() {
  const { standalone, mode, install } = useInstall();
  const [dismissed, setDismissed] = useState(() => load('install-dismissed', false));
  if (SINGLE || standalone || dismissed || mode === 'none') return null;
  const close = () => {
    save('install-dismissed', true);
    setDismissed(true);
  };
  return (
    <div className="card relative mb-2 flex items-start gap-3 p-3.5 pr-12 md:hidden">
      <img src="icons/icon-192.png" alt="" className="h-10 w-10 shrink-0 rounded-xl" />
      <div className="min-w-0 text-[13px] text-ink-2">
        <p className="text-[14px] font-bold text-ink">학원비교를 앱처럼 쓰기</p>
        <p className="mt-0.5">홈 화면에 추가하면 앱처럼 바로 열리고, 인터넷이 끊겨도 본 적 있는 지역을 볼 수 있어요.</p>
        {mode === 'prompt' ? (
          <button type="button" className="btn-primary mt-2 px-3 py-2 text-[13px]" onClick={() => install().then((ok) => ok && close())}>
            <Download aria-hidden="true" className="h-4 w-4" />
            홈 화면에 설치
          </button>
        ) : (
          <p className="mt-1.5">
            <Guide mode={mode} />
          </p>
        )}
      </div>
      <button type="button" onClick={close} className="absolute right-1 top-1 rounded-xl p-3 text-ink-3 hover:bg-surface-2" aria-label="설치 안내 닫기">
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}

/** 설정 화면의 설치 안내 */
export function InstallSection() {
  const { standalone, mode, install } = useInstall();
  if (SINGLE)
    return (
      <p className="card p-4 text-sm text-ink-2">
        이 미리 보기에서는 설치할 수 없어요. 배포된 사이트(GitHub Pages)를 휴대폰 브라우저로 열면 홈 화면에 추가할 수 있어요.
      </p>
    );
  if (standalone) return <p className="card p-4 text-sm text-ink-2">지금 홈 화면 앱으로 쓰고 있어요.</p>;
  return (
    <div className="card flex flex-col gap-3 p-4 text-sm text-ink-2">
      <p>홈 화면에 추가하면 주소창 없이 앱처럼 열리고, 인터넷이 끊겨도 본 적 있는 화면과 지역 데이터를 볼 수 있어요.</p>
      {mode === 'prompt' ? (
        <button type="button" className="btn-primary self-start" onClick={() => install()}>
          <Download aria-hidden="true" className="h-4 w-4" />
          홈 화면에 설치
        </button>
      ) : (
        <>
          <p>
            <b className="text-ink">iPhone·iPad</b> · Safari 아래쪽 <Share aria-label="공유" className="inline h-4 w-4 align-[-3px]" /> 공유 버튼 → <b className="text-ink">홈 화면에 추가</b>
          </p>
          <p>
            <b className="text-ink">안드로이드</b> · Chrome·삼성 인터넷 메뉴(⋮) → <b className="text-ink">홈 화면에 추가</b> 또는 <b className="text-ink">앱 설치</b>
          </p>
          {mode === 'in-app' && <p className="font-semibold text-pricey">카카오톡 같은 앱 안 브라우저에서는 설치가 안 돼요. ‘다른 브라우저로 열기’를 먼저 눌러 주세요.</p>}
        </>
      )}
    </div>
  );
}
