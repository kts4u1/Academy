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
          {SIDOS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
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
