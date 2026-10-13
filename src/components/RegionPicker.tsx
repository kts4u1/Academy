import { districtsOf, SIDOS } from '../data/regions';

interface Props {
  sido: string;
  sigungu: string;
  onChange: (sido: string, sigungu: string) => void;
  allowAll?: boolean;
  idPrefix: string;
}

export function RegionPicker({ sido, sigungu, onChange, allowAll = true, idPrefix }: Props) {
  const districts = sido ? districtsOf(sido) : [];
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className="label" htmlFor={`${idPrefix}-sido`}>
          시·도
        </label>
        <select
          id={`${idPrefix}-sido`}
          className="field"
          value={sido}
          onChange={(e) => {
            const next = e.target.value;
            onChange(next, allowAll ? '' : (districtsOf(next)[0]?.sigungu ?? ''));
          }}
        >
          {allowAll && <option value="">전국</option>}
          {/* 아직 고르지 않았을 때 첫 항목(서울)이 골라진 것처럼 보이면 서울을 고를 수 없게 된다 */}
          {!allowAll && !sido && (
            <option value="" disabled>
              시·도 선택
            </option>
          )}
          {SIDOS.filter((s) => s !== '전남').map((s) =>
            s === '광주' ? (
              // 2026-07-01 통합: 시·도는 하나지만 사람들은 여전히 '광주'와 '전남'으로 찾는다
              <optgroup key="전남광주" label="전남광주통합특별시">
                <option value="광주">광주</option>
                <option value="전남">전남</option>
              </optgroup>
            ) : (
              <option key={s} value={s}>
                {s}
              </option>
            ),
          )}
        </select>
      </div>
      <div>
        <label className="label" htmlFor={`${idPrefix}-sigungu`}>
          시·군·구
        </label>
        <select
          id={`${idPrefix}-sigungu`}
          className="field"
          value={sigungu}
          disabled={!sido}
          onChange={(e) => onChange(sido, e.target.value)}
        >
          {allowAll && <option value="">전체</option>}
          {!allowAll && !sigungu && (
            <option value="" disabled>
              시·군·구 선택
            </option>
          )}
          {districts.map((d) => (
            <option key={d.sigungu} value={d.sigungu}>
              {d.sigungu}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
