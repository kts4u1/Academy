import { Info } from 'lucide-react';
import { METRIC_MAP, METRICS, type Metric } from '../lib/pricing';
import { Segmented } from './ui';

/** 가격 비교 기준 선택. 앱 전체에서 같은 기준을 공유한다. */
export function MetricPicker({ value, onChange, showDesc = true, exclude = [] }: { value: Metric; onChange: (m: Metric) => void; showDesc?: boolean; exclude?: Metric[] }) {
  return (
    <div>
      <Segmented
        ariaLabel="가격 비교 기준"
        value={value}
        onChange={onChange}
        options={METRICS.filter((m) => !exclude.includes(m.id)).map((m) => ({ id: m.id, label: m.label }))}
      />
      {showDesc && (
        <p className="mt-1.5 flex items-start gap-1 text-[12px] text-ink-3">
          <Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {METRIC_MAP[value].desc}
        </p>
      )}
    </div>
  );
}
