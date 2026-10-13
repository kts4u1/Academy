import { Heart, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { academyPath } from '../components/AcademyCard';
import { EmptyState, KindBadge, PageHeader, SubjectChips } from '../components/ui';
import { dotDate } from '../lib/format';
import { useApp } from '../store/AppContext';

export function FavoritesPage() {
  const { favorites, toggleFavorite, showToast } = useApp();
  return (
    <div>
      <PageHeader title="찜한 학원" subtitle={favorites.length ? `${favorites.length}곳` : undefined} back />
      {favorites.length === 0 ? (
        <EmptyState
          title="찜한 학원이 없어요"
          desc="학원 카드나 상세 화면의 하트를 누르면 여기에 모여요."
          action={
            <Link to="/search" className="btn-primary">
              학원 찾기
            </Link>
          }
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {favorites.map((f) => (
            <li key={f.id} className="card relative flex items-start gap-3 p-4">
              <div className="min-w-0 flex-1">
                <Link to={academyPath(f)} className="text-[16px] font-bold after:absolute after:inset-0 after:rounded-card hover:text-accent">
                  {f.name}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-3">
                  <KindBadge kind={f.kind} />
                  <span className="inline-flex items-center gap-0.5">
                    <MapPin aria-hidden="true" className="h-3 w-3" />
                    {f.sigungu} {f.dong}
                  </span>
                  {f.subjects.length > 0 && <SubjectChips subjectIds={f.subjects.slice(0, 4)} />}
                </div>
                <p className="mt-1 text-[11px] text-ink-3">{dotDate(f.addedAt)} 찜</p>
              </div>
              <button
                type="button"
                className="relative z-10 rounded-lg p-1.5 text-pricey hover:bg-surface-2"
                aria-label={`${f.name} 찜 해제`}
                onClick={() => {
                  toggleFavorite(f);
                  showToast('찜을 해제했어요');
                }}
              >
                <Heart aria-hidden="true" className="h-5 w-5 fill-pricey" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
