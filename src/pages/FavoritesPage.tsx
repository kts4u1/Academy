import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AcademyCard } from '../components/AcademyCard';
import { EmptyState, PageHeader } from '../components/ui';
import { getAcademy } from '../data';
import { useAcademies } from '../hooks';
import { comparePlanToPeers } from '../lib/market';
import { computeCost } from '../lib/pricing';
import { MAX_COMPARE, useApp } from '../store/AppContext';

export function FavoritesPage() {
  const academies = useAcademies();
  const navigate = useNavigate();
  const { favorites, settings, addCompare, clearCompare, showToast } = useApp();
  const metric = settings.metric;

  const results = useMemo(
    () =>
      favorites
        .map((id) => getAcademy(id))
        .filter((a) => a !== undefined)
        .map((academy) => {
          const options = academy.plans.map((plan) => ({ plan, cost: computeCost(academy, plan) }));
          const best = options.reduce((a, b) => (b.cost[metric] < a.cost[metric] ? b : a));
          return {
            academy,
            plan: best.plan,
            cost: best.cost,
            value: best.cost[metric],
            matchingPlans: academy.plans.length,
            peer: comparePlanToPeers(academies, academy, best.plan, metric, best.cost),
          };
        }),
    [favorites, metric, academies],
  );

  return (
    <div>
      <PageHeader title="찜한 학원" subtitle={`${results.length}곳`} back />
      {results.length === 0 ? (
        <EmptyState title="아직 찜한 학원이 없어요" desc="학원 카드의 하트를 누르면 여기에 모여요." action={<Link to="/search" className="btn-primary">학원 찾기</Link>} />
      ) : (
        <>
          {results.length > 1 && (
            <button
              type="button"
              className="btn-primary mb-3 w-full"
              onClick={() => {
                clearCompare();
                for (const r of results.slice(0, MAX_COMPARE)) addCompare({ academyId: r.academy.id, planId: r.plan.id });
                showToast(`찜한 학원 ${Math.min(MAX_COMPARE, results.length)}곳을 비교함에 담았어요`);
                navigate('/compare');
              }}
            >
              찜한 학원 비교하기 {results.length > MAX_COMPARE && `(앞의 ${MAX_COMPARE}곳)`}
            </button>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {results.map((r) => (
              <AcademyCard key={r.academy.id} result={r} metric={metric} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
