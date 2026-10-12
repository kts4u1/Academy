import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader, Section } from '../components/ui';
import { DISTRICTS, SIDOS } from '../data/regions';
import { useAcademies } from '../hooks';

const ROWS: { item: string; status: 'real' | 'sample' | 'live'; note: string }[] = [
  { item: '시·도, 시·군·구, 동 이름', status: 'real', note: '행정동 경계 데이터(2026년 7월 기준)에서 가져옴' },
  { item: '시·군·구 대표 좌표 (거리 계산)', status: 'real', note: '행정동 경계로 계산한 시가지 중심. 학원별 좌표는 그 주변에 임의로 배치' },
  { item: '교육청 신고 교습비', status: 'live', note: '교육청 실데이터 화면에서 나이스 API 로 불러와 예시 데이터와 과목·연령별로 비교' },
  { item: '학원 이름, 상세 주소, 전화번호', status: 'sample', note: '가상. 실제 학원과 같은 이름이 있어도 무관' },
  { item: '수강료, 부대비용, 할인', status: 'sample', note: '과목·연령별 시세 범위와 지역 물가 지수로 만든 예시' },
  { item: '평점, 후기, 가격 변동 이력', status: 'sample', note: '가상' },
];

const BADGE = {
  real: 'bg-cheap-soft text-cheap',
  live: 'bg-accent-soft text-accent',
  sample: 'bg-surface-2 text-ink-2',
} as const;
const LABEL = { real: '실제', live: '실시간 실제', sample: '예시' } as const;

export function DataInfoPage() {
  const academies = useAcademies();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="데이터 안내" subtitle="무엇이 실제이고 무엇이 예시인지" back />

      <div className="card p-4 text-[14px] text-ink-2">
        지금 앱은 데모예요. 전국 {SIDOS.length}개 시·도 {DISTRICTS.length}개 시·군·구에 예시 학원 {academies.length.toLocaleString()}곳을 만들어 검색·비교 기능을
        보여줍니다. 가격 비교 계산 방식은 실제 데이터를 넣어도 그대로 쓰입니다.
      </div>

      <Section title="항목별 출처">
        <ul className="card divide-y divide-line">
          {ROWS.map((r) => (
            <li key={r.item} className="flex items-start gap-3 px-4 py-3">
              <span className={`mt-0.5 w-[4.75rem] shrink-0 rounded-md py-0.5 text-center text-[11px] font-bold ${BADGE[r.status]}`}>{LABEL[r.status]}</span>
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold">{r.item}</span>
                <span className="block text-[12px] text-ink-3">{r.note}</span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="실제 데이터로 바꾸려면" desc="분야마다 쓸 수 있는 공개 자료가 달라요">
        <div className="flex flex-col gap-2">
          <div className="card p-4">
            <h3 className="text-[15px] font-bold">교과·예능 학원 (국영수, 외국어, 음악·미술·무용, 코딩)</h3>
            <p className="mt-1 text-[13px] text-ink-2">
              교육청에 등록된 학원·교습소 목록과 과정별 교습비는 나이스 교육정보 개방 포털 API로 받을 수 있어요. 인증키를 넣으면{' '}
              <Link to="/neis" className="font-semibold text-accent">
                교육청 실데이터
              </Link>{' '}
              화면에서 지역 전체를 불러와 과정 이름으로 과목·대상(초등·중등·고등)을 가려 예시 데이터와 나란히 비교해요. 수업 횟수·시간은 과정 이름에 적힌 경우(주2회 등)만 알 수 있어서, 시간당 단가는 학원 확인이 필요해요.
            </p>
          </div>
          <div className="card p-4">
            <h3 className="text-[15px] font-bold">체육 (수영, 태권도, 복싱, 주짓수, 구기 등)</h3>
            <p className="mt-1 text-[13px] text-ink-2">
              체육도장·수영장 등은 체육시설법 대상이라 교육청 자료에 없어요. 시설 목록은 지자체 인허가 공개 데이터로, 가격은 학원 직접 등록과 이용자 제보로 채워야 해요.
            </p>
          </div>
          <div className="card p-4">
            <h3 className="text-[15px] font-bold">위치·전화번호</h3>
            <p className="mt-1 text-[13px] text-ink-2">카카오·네이버 지도 검색 API로 학원 위치와 전화번호를 찾을 수 있어요. 가격 정보는 없어요.</p>
          </div>
          <div className="card p-4">
            <h3 className="text-[15px] font-bold">후기</h3>
            <p className="mt-1 text-[13px] text-ink-2">다른 서비스의 후기를 긁어 오는 건 약관·법적 문제가 있어요. 앱 안에서 직접 받는 후기(영수증 인증 등)가 안전해요.</p>
          </div>
        </div>
      </Section>

      <Section title="최근 행정구역 변화" desc="2026년 10월 기준">
        <ul className="card flex list-disc flex-col gap-1.5 py-4 pl-9 pr-4 text-[13px] text-ink-2">
          <li>2026-07-01 광주광역시·전라남도가 전남광주통합특별시로 통합됐어요. 광주 5개 구와 전남 22개 시·군은 이름 그대로라 앱에서는 '광주', '전남'으로 나눠 보여줘요.</li>
          <li>2026-07-01 인천 중구·동구·서구가 제물포구·영종구·서해구·검단구로 바뀌었어요. 교육청 학원 자료에는 옛 이름이 섞여 있어 주소의 동으로 나눠 담아요.</li>
          <li>2026-02-01 화성시에 일반구 4곳(만세·효행·병점·동탄구)이 생겼어요.</li>
        </ul>
      </Section>

      <p className="mt-4 text-[12px] text-ink-3">
        행정구역 데이터:{' '}
        <a href="https://github.com/vuski/admdongkor" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-accent">
          vuski/admdongkor <ExternalLink aria-hidden="true" className="h-3 w-3" />
        </a>{' '}
        · 교습비:{' '}
        <a href="https://open.neis.go.kr" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-accent">
          나이스 교육정보 개방 포털 <ExternalLink aria-hidden="true" className="h-3 w-3" />
        </a>
      </p>
    </div>
  );
}
