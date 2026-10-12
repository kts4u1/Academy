import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MetricPicker } from '../components/MetricPicker';
import { RegionPicker } from '../components/RegionPicker';
import { PageHeader, Section, Segmented } from '../components/ui';
import { WEEKS_PER_MONTH } from '../lib/pricing';
import { useApp, type ThemePref } from '../store/AppContext';

export function SettingsPage() {
  const { settings, updateSettings, favorites, compare, calc, reports, clearCompare, removeCalc, removeReport, toggleFavorite, showToast } = useApp();
  const [keyDraft, setKeyDraft] = useState(settings.neisKey);
  const [confirmReset, setConfirmReset] = useState(false);

  const resetAll = () => {
    clearCompare();
    calc.forEach((c) => removeCalc(c.id));
    reports.forEach((r) => removeReport(r.id));
    favorites.forEach((f) => toggleFavorite(f));
    setConfirmReset(false);
    showToast('이 기기에 저장된 내 데이터를 지웠어요');
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="설정" back />

      <Section title="내 동네" desc="거리 계산과 홈 화면 시세의 기준">
        <div className="card p-4">
          <RegionPicker
            idPrefix="set-home"
            allowAll={false}
            sido={settings.home?.sido ?? '서울'}
            sigungu={settings.home?.sigungu ?? '강남구'}
            onChange={(sido, sigungu) => updateSettings({ home: { sido, sigungu } })}
          />
        </div>
      </Section>

      <Section title="기본 비교 기준" desc="검색 정렬, 카드의 큰 숫자, 시세 위치에 쓰여요">
        <div className="card p-4">
          <MetricPicker value={settings.metric} onChange={(m) => updateSettings({ metric: m })} />
        </div>
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

      <Section title="교육청 API 인증키" desc="나이스 교육정보 개방 포털에서 무료로 발급받을 수 있어요">
        <form
          className="card grid gap-2 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            updateSettings({ neisKey: keyDraft.trim() });
            showToast(keyDraft.trim() ? '인증키를 저장했어요' : '인증키를 지웠어요');
          }}
        >
          <label className="label" htmlFor="neis-key">
            인증키 (KEY)
          </label>
          <input id="neis-key" className="field font-mono text-[13px]" autoComplete="off" value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} placeholder="발급받은 키를 붙여넣으세요" />
          <p className="text-[12px] text-ink-3">
            키가 없으면 샘플 5건만 조회돼요. 발급: open.neis.go.kr → 인증키 신청. 키는 이 기기에만 저장됩니다.
          </p>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">
              저장
            </button>
            <Link to="/neis" className="btn-ghost">
              실데이터 조회로
            </Link>
          </div>
        </form>
      </Section>

      <Section title="내 데이터" desc="모든 데이터는 이 기기(브라우저)에만 저장돼요">
        <div className="card p-4 text-[14px]">
          <ul className="num grid grid-cols-2 gap-2 text-ink-2">
            <li>찜한 학원 {favorites.length}곳</li>
            <li>비교함 {compare.length}곳</li>
            <li>계산기 항목 {calc.length}개</li>
            <li>가격 제보 {reports.length}건</li>
          </ul>
          {confirmReset ? (
            <div className="mt-3 rounded-lg bg-pricey-soft p-3">
              <p className="text-[13px] font-semibold text-pricey">찜, 비교함, 계산기, 제보를 모두 지울까요? 되돌릴 수 없어요.</p>
              <div className="mt-2 flex gap-2">
                <button type="button" className="btn bg-pricey text-surface" onClick={resetAll}>
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

      <Section title="가격 계산 방식">
        <div className="card p-4 text-[14px] leading-relaxed text-ink-2">
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            <li>한 달은 {WEEKS_PER_MONTH}주로 계산해요. (주 2회 = 월 8회, 학원 관행)</li>
            <li>기간권은 개월 수로, 횟수권은 회당 가격 × 월 수업 횟수로 월 금액을 환산해요.</li>
            <li>실질 월 부담 = (월 수강료×12 + 매월 부대비용×12 + 교재·심사·보험 등 연간 비용 + 도복·등록비 등 초기 비용) ÷ 12</li>
            <li>시세 비교는 같은 과목·대상 연령·수업 형태(그룹/소수정예/1:1)의 요금제끼리, 같은 시·도 안에서 해요. 표본이 5개 미만이면 전국으로 넓혀요.</li>
            <li>선택 비용(호구, 개인 장비, 대회 참가비 등)은 켜기 전까지 합계에서 빠져요.</li>
          </ul>
        </div>
      </Section>
    </div>
  );
}
