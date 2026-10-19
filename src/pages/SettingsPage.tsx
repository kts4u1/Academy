import { useState } from 'react';
import { Link } from 'react-router-dom';
import { InstallSection } from '../components/InstallPrompt';
import { RegionPicker } from '../components/RegionPicker';
import { PageHeader, Section, Segmented } from '../components/ui';
import { clearLiveCache } from '../data/source';
import { useManifest } from '../hooks';
import { fetchNeisAcademies, neisErrorMessage } from '../lib/neis';
import { useApp, type ThemePref } from '../store/AppContext';

type KeyCheck = { state: 'idle' } | { state: 'checking' } | { state: 'ok'; total: number } | { state: 'error'; message: string };

export function SettingsPage() {
  const { settings, updateSettings, favorites, compare, calc, resetAll, showToast } = useApp();
  const { manifest } = useManifest();
  const [keyDraft, setKeyDraft] = useState(settings.neisKey);
  const [check, setCheck] = useState<KeyCheck>({ state: 'idle' });
  const [confirmReset, setConfirmReset] = useState(false);

  const verifyAndSave = async () => {
    const key = keyDraft.trim();
    if (!key) {
      updateSettings({ neisKey: '' });
      setCheck({ state: 'idle' });
      showToast('인증키를 지웠어요');
      return;
    }
    setCheck({ state: 'checking' });
    try {
      const r = await fetchNeisAcademies({ key, officeCode: 'B10', pageSize: 1 });
      updateSettings({ neisKey: key });
      setCheck({ state: 'ok', total: r.total });
      showToast('인증키를 확인하고 저장했어요');
    } catch (err) {
      setCheck({ state: 'error', message: neisErrorMessage(err) });
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="설정" back />

      <Section title="내 동네" desc="검색·시세 화면에서 처음 보여 줄 지역">
        <div className="card p-4">
          <RegionPicker
            idPrefix="set-home"
            allowAll={false}
            sido={settings.home?.sido ?? ''}
            sigungu={settings.home?.sigungu ?? ''}
            onChange={(sido, sigungu) => updateSettings({ home: { sido, sigungu } })}
          />
          {!settings.home && <p className="mt-2 text-[12px] text-ink-3">아직 정하지 않았어요. 고르면 바로 저장돼요.</p>}
        </div>
      </Section>

      <Section title="홈 화면에 앱으로 설치">
        <InstallSection />
      </Section>

      <Section title="화면 테마">
        <Segmented<ThemePref>
          ariaLabel="화면 테마"
          value={settings.theme}
          onChange={(theme) => updateSettings({ theme })}
          options={[
            { id: 'system', label: '시스템 설정' },
            { id: 'light', label: '밝게' },
            { id: 'dark', label: '어둡게' },
          ]}
        />
      </Section>

      <Section title="교육청 인증키 (이 브라우저에서 직접 받기)" desc="나이스 교육정보 개방 포털(open.neis.go.kr)에서 무료로 발급받을 수 있어요">
        <form
          id="neis-key"
          className="card grid scroll-mt-20 gap-2 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            verifyAndSave();
          }}
        >
          {manifest ? (
            <p className="rounded-lg bg-accent-soft px-3 py-2 text-[13px] text-accent">
              이 사이트는 매주 자동으로 받은 교육청 데이터를 쓰고 있어서 인증키가 필요 없어요. 자동 업데이트 데이터가 없을 때만 아래 키를 써요.
            </p>
          ) : (
            <p className="text-[13px] text-ink-2">
              자동 업데이트 데이터가 아직 없어요. 키를 넣으면 고른 시·군·구의 학원을 교육청에서 바로 받아 이 브라우저에 7일 동안 보관하고, 그 뒤에 다시 받아요.
            </p>
          )}
          <label className="label mt-1" htmlFor="neis-key-input">
            인증키 (KEY)
          </label>
          <input
            id="neis-key-input"
            className="field font-mono md:text-[13px]"
            type="password"
            autoComplete="off"
            value={keyDraft}
            onChange={(e) => {
              setKeyDraft(e.target.value);
              setCheck({ state: 'idle' });
            }}
            placeholder="발급받은 키를 붙여넣으세요"
          />
          <p className="text-[12px] text-ink-3">키는 이 브라우저에만 저장되고 교육청 서버로만 보내요.</p>
          {check.state === 'ok' && <p className="text-[13px] font-semibold text-cheap">사용할 수 있는 키예요 (서울 교육청 학원·교습소 {check.total.toLocaleString()}곳 확인).</p>}
          {check.state === 'error' && (
            <p role="alert" className="text-[13px] font-semibold text-pricey">
              {check.message}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-primary" disabled={check.state === 'checking'}>
              {check.state === 'checking' ? '확인 중…' : '확인하고 저장'}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={async () => {
                await clearLiveCache();
                showToast('브라우저에 보관한 교육청 데이터를 지웠어요');
              }}
            >
              받아 둔 데이터 지우기
            </button>
          </div>
        </form>
      </Section>

      <Section title="내 데이터" desc="찜·비교함·내 학원비는 이 기기(브라우저)에만 저장돼요">
        <div className="card p-4 text-[14px]">
          <ul className="num grid grid-cols-3 gap-2 text-ink-2">
            <li>찜 {favorites.length}곳</li>
            <li>비교함 {compare.length}곳</li>
            <li>내 학원비 {calc.length}개</li>
          </ul>
          {confirmReset ? (
            <div className="mt-3 rounded-lg bg-pricey-soft p-3">
              <p className="text-[13px] font-semibold text-pricey">찜, 비교함, 내 학원비, 설정을 모두 지울까요? 되돌릴 수 없어요.</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="btn bg-pricey text-surface"
                  onClick={async () => {
                    resetAll();
                    setKeyDraft('');
                    setCheck({ state: 'idle' });
                    await clearLiveCache();
                    setConfirmReset(false);
                    showToast('이 기기에 저장된 내 데이터를 지웠어요');
                  }}
                >
                  모두 지우기
                </button>
                <button type="button" className="btn-ghost" onClick={() => setConfirmReset(false)}>
                  취소
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn-ghost mt-3" onClick={() => setConfirmReset(true)}>
              내 데이터 초기화
            </button>
          )}
        </div>
      </Section>

      <p className="mt-6 text-[13px] text-ink-2">
        데이터가 어떻게 만들어지는지는{' '}
        <Link to="/data" className="font-semibold text-accent hover:underline">
          데이터 안내
        </Link>
        에서 볼 수 있어요.
      </p>
    </div>
  );
}
