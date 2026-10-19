import { CircleAlert, Database, KeyRound, LoaderCircle, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useManifest, type DistrictState } from '../hooks';
import { dotDate, kstDate, manwon } from '../lib/format';
import type { DistrictData } from '../data/source';

/** 아직 쓸 수 있는 데이터가 없을 때: 매주 자동 업데이트 설정 방법 안내 */
export function NoDataState({ compact = false }: { compact?: boolean }) {
  return (
    <div className="card p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <Database aria-hidden="true" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-bold">아직 교육청 데이터가 없어요</h2>
          <p className="mt-1 text-sm text-ink-2">
            이 앱은 예시 데이터를 쓰지 않아요. 나이스 교육정보 개방 포털의 학원교습소정보를 매주 받아서 그대로 보여 줍니다.
          </p>
        </div>
      </div>
      {!compact && (
        <p className="mt-4 text-sm text-ink-2">
          <b className="text-ink">이 브라우저에서 바로 보기</b> · 설정에 인증키를 넣으면 고른 시·군·구만 교육청에서 직접 받아 7일 동안 보관합니다.
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/settings#neis-key" className="btn-primary">
          <KeyRound aria-hidden="true" className="h-4 w-4" />
          인증키 넣기
        </Link>
        <Link to="/data" className="btn-ghost">
          데이터 안내
        </Link>
      </div>
    </div>
  );
}

export function LoadingState({ message }: { message?: string | null }) {
  return (
    <div className="card flex items-center gap-3 p-5 text-sm text-ink-2" role="status" aria-live="polite">
      <LoaderCircle aria-hidden="true" className="h-5 w-5 shrink-0 animate-spin text-accent" />
      <span>{message ?? '교육청 데이터를 불러오는 중…'}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card flex flex-col gap-3 p-5" role="alert">
      <p className="flex items-start gap-2 text-sm">
        <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-pricey" />
        <span>{message}</span>
      </p>
      {onRetry && (
        <button type="button" className="btn-ghost self-start" onClick={onRetry}>
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          다시 시도
        </button>
      )}
    </div>
  );
}

/** 시·군·구 데이터를 받는 동안·실패·없음 상태를 대신 보여 준다 */
export function DistrictGate({ state, onRetry, children }: { state: DistrictState; onRetry?: () => void; children: (data: DistrictData) => ReactNode }) {
  if (state.status === 'idle') return null;
  if (state.status === 'loading') return <LoadingState message={state.progress} />;
  if (state.status === 'error') return <ErrorState message={state.error ?? '데이터를 불러오지 못했어요.'} onRetry={onRetry} />;
  if (state.status === 'nodata' || !state.data) return <NoDataState />;
  return <>{children(state.data)}</>;
}

/** 데이터 출처·기준일 한 줄. error: 데이터는 있는데 '지금 다시 받기'가 실패했을 때 */
export function DataStamp({ data, onReload, error, sports = false }: { data: DistrictData; onReload?: () => void; error?: string | null; sports?: boolean }) {
  const { manifest } = useManifest();
  if (sports && data.sports)
    return <p className="text-[12px] text-ink-3">국민체육진흥공단 스포츠강좌이용권·전국체육시설 정보 · {dotDate(data.sports.fetchedAt.slice(0, 10))} 받음 (매주 자동)</p>;
  const label =
    data.mode === 'live'
      ? `내 인증키로 받음 ${kstDate(data.updatedAt)}`
      : manifest?.sourceKind === 'file' && manifest.baseDate
        ? `교육청 전국 파일 ${dotDate(manifest.baseDate)} 기준`
        : `자동 업데이트 ${kstDate(data.updatedAt)}`;
  return (
    <div className="text-[12px] text-ink-3">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>
          교육청 학원교습소정보 · {label}
          {data.sampleMode && <b className="ml-1 font-semibold text-pricey">표본(일부만)</b>}
        </span>
        {data.mode === 'live' && onReload && (
          <button type="button" onClick={onReload} className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">
            <RefreshCw aria-hidden="true" className="h-3 w-3" />
            지금 다시 받기
          </button>
        )}
      </p>
      {error && (
        <p role="alert" className="mt-1 font-semibold text-pricey">
          다시 받지 못해 보관해 둔 자료를 보여 드려요: {error}
        </p>
      )}
    </div>
  );
}

/** 체육 종목 결과 위에 보여 주는 출처 안내 */
export function SportsSourceNote({ voucherCap }: { voucherCap: number | null }) {
  return (
    <div className="mb-3 rounded-xl bg-surface-2 px-3 py-2 text-[12px] leading-relaxed text-ink-2">
      <p>
        체육시설 금액은 스포츠강좌이용권(저소득층 유·청소년 바우처) 가맹 시설이 국민체육진흥공단에 등록한 강좌 결제금액이라 일반 회원가와 다를 수 있어요.
        {voucherCap ? ` 월 지원 한도와 같은 ${manwon(voucherCap)} 강좌가 많아, 그 금액은 시세·비교에서 빼고 보여 드려요.` : ''} 금액이 없는 곳은 시·군·구에 신고된 체육시설
        목록이에요.
      </p>
    </div>
  );
}

/** 체육 종목: 체육시설 자료가 없을 때 (내 인증키로 받는 경우·주간 업데이트에서 받지 못한 경우) */
export function SportsNotice({ subjectName }: { subjectName: string }) {
  return (
    <div className="card p-5">
      <h2 className="text-base font-bold">{subjectName} 자료를 아직 불러오지 못했어요</h2>
      <p className="mt-2 text-sm text-ink-2">
        수영장·태권도장·복싱장 같은 체육시설은 학원법이 아니라 체육시설법 대상이라 교육청 학원교습소정보에 없어요. 이 사이트는 국민체육진흥공단 자료(스포츠강좌이용권 강좌
        금액·전국체육시설 목록)로 보여 드리는데, 지금은 그 자료가 없어요. (매주 자동 업데이트 때 받아요)
      </p>
      <p className="mt-2 text-sm text-ink-2">다니는 곳의 금액은 ‘내 학원비’에 직접 넣어 관리할 수 있어요.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/budget" className="btn-ghost">
          내 학원비에 직접 넣기
        </Link>
        <Link to="/data" className="btn-ghost">
          데이터 안내
        </Link>
      </div>
    </div>
  );
}
