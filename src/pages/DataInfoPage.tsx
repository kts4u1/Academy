import { ExternalLink } from 'lucide-react';
import { PageHeader, Section } from '../components/ui';
import { EDU_OFFICES } from '../data/regions';
import { useAvailability } from '../hooks';
import { dotDate, kstDate, manwon } from '../lib/format';
import { MAX_MONTHLY, MIN_MONTHLY } from '../lib/neisClassify';
import { MIN_MARKET_N } from '../lib/realData';

export function DataInfoPage() {
  const { loading, mode, manifest } = useAvailability();
  const officeName = (code: string) => EDU_OFFICES.find((o) => o.code === code)?.office ?? code;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="데이터 안내" subtitle="어디서 받아 어떻게 비교하는지" back />

      <div className="card p-4 text-[14px] text-ink-2">
        {loading ? (
          '데이터 상태를 확인하는 중…'
        ) : mode === 'static' && manifest ? (
          <>
            <p>
              {manifest.sourceKind === 'file' ? (
                <>
                  교육청이 매달 올리는 전국 파일(<b className="text-ink">{manifest.baseDate ? dotDate(manifest.baseDate) : '-'} 기준</b>)을 {kstDate(manifest.updatedAt)}에 받아 만든 자료예요.
                </>
              ) : (
                <>
                  <b className="text-ink">{kstDate(manifest.updatedAt)}</b>에 교육청 Open API 로 받은 자료예요.
                </>
              )}{' '}
              학원·교습소{' '}
              <b className="text-ink">{manifest.totals.academies.toLocaleString()}곳</b> 중 교습비가 공개된 곳은 {manifest.totals.priced.toLocaleString()}곳, 신고된 교습과정은{' '}
              {manifest.totals.courses.toLocaleString()}개예요.
            </p>
            {manifest.sampleMode && <p className="mt-2 font-semibold text-pricey">지금은 인증키 없이 받은 표본(일부 학원)이라 숫자가 실제보다 훨씬 적어요.</p>}
            {manifest.totals.unassigned > 0 && (
              <p className="mt-2 text-[13px]">
                주소에 구가 적혀 있지 않아 어느 구인지 정하지 못한 곳이 {manifest.totals.unassigned.toLocaleString()}곳 있어요. 이런 곳은 같은 시의 각 구 검색에 ‘구 미상’으로 함께 보여 줘요.
              </p>
            )}
          </>
        ) : mode === 'live' ? (
          '자동 업데이트 데이터가 아직 없어서, 설정에 넣은 인증키로 고른 시·군·구만 교육청에서 직접 받아 이 브라우저에 7일 동안 보관하고 있어요.'
        ) : (
          '아직 교육청 데이터가 없어요. 아래 ‘매주 자동 업데이트’ 설정을 하거나, 설정 화면에 인증키를 넣어 주세요.'
        )}
      </div>

      <Section title="데이터 출처">
        <ul className="card divide-y divide-line text-[13px]">
          <li className="px-4 py-3">
            <b className="block text-[14px]">학원·교습소 목록과 신고 교습비</b>
            <span className="text-ink-2">
              나이스 교육정보 개방 포털 ‘학원교습소정보’. 인증키가 있으면 Open API(acaInsTiInfo)로 전국 17개 시·도교육청 자료를 매주 받고, 없거나 API 가 실패하면 교육청이
              매달 올리는 전국 파일(CSV)을 써요. 휴원·폐원한 곳은 빼요.
            </span>
          </li>
          <li className="px-4 py-3">
            <b className="block text-[14px]">시·도 · 시·군·구 · 동 이름</b>
            <span className="text-ink-2">행정동 경계 데이터(2026년 7월 기준, 전국 256개 시·군·구)</span>
          </li>
          <li className="px-4 py-3">
            <b className="block text-[14px]">쓰지 않는 것</b>
            <span className="text-ink-2">예시·가짜 학원, 임의로 만든 가격·평점·후기는 없어요. 공식 자료에 없는 항목은 비워 둬요.</span>
          </li>
        </ul>
      </Section>

      <Section title="매주 자동 업데이트" desc="GitHub Actions 가 매주 월요일 새벽 3시(한국 시간)에 실행해요">
        <ol className="card flex list-decimal flex-col gap-2 py-4 pl-9 pr-4 text-[13px] text-ink-2">
          <li>저장소 Settings → Pages 에서 Source 를 ‘GitHub Actions’로 바꿔요.</li>
          <li>
            (권장) Settings → Secrets and variables → Actions → New repository secret 에서 이름 <code className="rounded bg-surface-2 px-1">NEIS_KEY</code>, 값에 발급받은
            인증키를 넣어요. 없으면 교육청 전국 파일(매달 갱신)로 만들어요.
          </li>
          <li>Actions 탭 → ‘교육청 데이터 주간 업데이트’ → Run workflow 로 처음 한 번 실행해요. 이후로는 매주 자동이에요.</li>
          <li>받다가 실패하면 지난주 데이터를 그대로 두고, 다음 실행에서 다시 받아요. 9일 넘게 갱신되지 않으면 화면 위쪽에 알려 드려요.</li>
        </ol>
      </Section>

      <Section title="비교 규칙">
        <ul className="card flex list-disc flex-col gap-1.5 py-4 pl-9 pr-4 text-[13px] text-ink-2">
          <li>신고 교습비는 학원이 교육청에 신고한 1인 교습비예요. 대부분 월 금액이고, 교재비·차량비·할인은 들어 있지 않아요.</li>
          <li>과정 이름(예: ‘중등 수학 내신’, ‘초등 영어 주3회’)으로 과목과 대상(유아·초등·중등·고등·성인)을 나눠요. 이름에 대상이 없으면 대상 ‘전체’ 시세로 비교해요.</li>
          <li>
            특강·방학 캠프·교재비·재료비·1:1 개인 레슨, 그리고 {manwon(MIN_MONTHLY)} 이하나 {manwon(MAX_MONTHLY)} 넘는 금액은 월 교습비로 보기 어려워 시세에서 빼요.
          </li>
          <li>같은 시·군·구에 같은 과목·대상으로 교습비를 공개한 곳이 {MIN_MARKET_N}곳 이상일 때 시세를 내요. 모자라면 시·도 전체로 넓혀요.</li>
          <li>과정을 여러 개 신고한 곳이 시세를 좌우하지 않게, 학원마다 해당 과정 금액의 중앙값 하나만 세요.</li>
          <li>‘저렴·평균·비쌈’은 같은 조건 학원들 사이에서의 위치예요 (하위 40% 미만 저렴, 60% 넘으면 비쌈).</li>
        </ul>
      </Section>

      <Section title="알아 둘 한계">
        <ul className="card flex list-disc flex-col gap-1.5 py-4 pl-9 pr-4 text-[13px] text-ink-2">
          <li>교습소는 교습비가 대부분 공개돼 있지만, 학원은 공개 자료에 교습비가 비어 있는 경우가 많아요. 이런 곳도 목록에는 보여 주고 ‘교습비 미공개’로 표시해요.</li>
          <li>수영·태권도·복싱·주짓수·구기 같은 체육시설은 체육시설법 대상이라 교육청 자료에 없어요. 공식 가격 자료도 없어 비워 둬요.</li>
          <li>교육청 자료는 학원이 신고를 바꿀 때 갱신돼서, 학원마다 ‘자료 갱신일’이 달라요.</li>
          <li>교육청 자료에는 시 이름만 있는 경우가 많아(성남시·수원시 등), 주소의 동으로 구를 찾아요. 동이 없으면 ‘구 미상’이에요.</li>
        </ul>
      </Section>

      {manifest && manifest.offices.length > 0 && (
        <Section title="교육청별 받은 건수">
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-line text-[12px] text-ink-3">
                  <th className="px-4 py-2 font-semibold">교육청</th>
                  <th className="num px-4 py-2 text-right font-semibold">전체</th>
                  <th className="num px-4 py-2 text-right font-semibold">운영 중</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {manifest.offices.map((o) => (
                  <tr key={o.code}>
                    <td className="px-4 py-2">{officeName(o.code)}</td>
                    <td className="num px-4 py-2 text-right">{o.total.toLocaleString()}</td>
                    <td className="num px-4 py-2 text-right">{o.kept.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <Section title="최근 행정구역 변화" desc="2026년 10월 기준">
        <ul className="card flex list-disc flex-col gap-1.5 py-4 pl-9 pr-4 text-[13px] text-ink-2">
          <li>2026-07-01 광주광역시·전라남도가 전남광주통합특별시로 통합됐어요. 교육청 자료도 옛 광주·전남 코드로 나뉘어 있어 앱에서는 ‘광주’, ‘전남’으로 나눠 보여 줘요.</li>
          <li>2026-07-01 인천 중구·동구·서구가 제물포구·영종구·서해구·검단구로 바뀌었어요. 교육청 자료에는 옛 이름이 섞여 있어 주소의 동으로 나눠 담아요.</li>
          <li>2026-02-01 화성시에 일반구 4곳(만세·효행·병점·동탄구)이 생겼어요.</li>
        </ul>
      </Section>

      <p className="mt-4 text-[12px] text-ink-3">
        <a href="https://open.neis.go.kr" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-accent">
          나이스 교육정보 개방 포털 <ExternalLink aria-hidden="true" className="h-3 w-3" />
        </a>{' '}
        ·{' '}
        <a href="https://github.com/vuski/admdongkor" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-accent">
          행정동 경계 vuski/admdongkor <ExternalLink aria-hidden="true" className="h-3 w-3" />
        </a>
      </p>
    </div>
  );
}
