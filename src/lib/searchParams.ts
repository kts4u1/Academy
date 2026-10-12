// 검색 조건 ↔ URL 쿼리 문자열. 검색 결과를 링크로 공유하거나 뒤로가기 했을 때 조건이 유지된다.

import type { AgeGroup, CategoryGroup, ClassType } from '../types';
import { EMPTY_FILTERS, SORTS, type SearchFilters, type SortKey } from './search';

const FLAG_KEYS = ['shuttle', 'trial', 'publicOnly', 'verifiedOnly', 'discountOnly'] as const;
const FLAG_PARAM: Record<(typeof FLAG_KEYS)[number], string> = {
  shuttle: 'shuttle',
  trial: 'trial',
  publicOnly: 'public',
  verifiedOnly: 'verified',
  discountOnly: 'discount',
};

const list = (v: string | null) => (v ? v.split(',').filter(Boolean) : []);
const num = (v: string | null) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

export function filtersFromParams(params: URLSearchParams): { filters: SearchFilters; sort: SortKey } {
  const flags = new Set(list(params.get('f')));
  const g = params.get('g');
  const sort = params.get('sort') as SortKey | null;
  const filters: SearchFilters = {
    ...EMPTY_FILTERS,
    q: params.get('q') ?? '',
    group: g === 'academic' || g === 'sports' || g === 'arts' ? (g as CategoryGroup) : 'all',
    subjectIds: list(params.get('subject')),
    sido: params.get('sido') ?? '',
    sigungu: params.get('gu') ?? '',
    ages: list(params.get('age')) as AgeGroup[],
    classTypes: list(params.get('ct')) as ClassType[],
    sessions: list(params.get('ses')).map(Number).filter((n) => Number.isFinite(n)),
    priceMin: num(params.get('pmin')),
    priceMax: num(params.get('pmax')),
    minRating: num(params.get('rating')) ?? 0,
    maxDistanceKm: num(params.get('dist')),
  };
  for (const key of FLAG_KEYS) filters[key] = flags.has(FLAG_PARAM[key]);
  return { filters, sort: sort && SORTS.some((s) => s.id === sort) ? sort : 'price_asc' };
}

export function paramsFromFilters(f: SearchFilters, sort: SortKey): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.group !== 'all') p.set('g', f.group);
  if (f.subjectIds.length) p.set('subject', f.subjectIds.join(','));
  if (f.sido) p.set('sido', f.sido);
  if (f.sigungu) p.set('gu', f.sigungu);
  if (f.ages.length) p.set('age', f.ages.join(','));
  if (f.classTypes.length) p.set('ct', f.classTypes.join(','));
  if (f.sessions.length) p.set('ses', f.sessions.join(','));
  if (f.priceMin != null) p.set('pmin', String(f.priceMin));
  if (f.priceMax != null) p.set('pmax', String(f.priceMax));
  if (f.minRating > 0) p.set('rating', String(f.minRating));
  if (f.maxDistanceKm != null) p.set('dist', String(f.maxDistanceKm));
  const flags = FLAG_KEYS.filter((k) => f[k]).map((k) => FLAG_PARAM[k]);
  if (flags.length) p.set('f', flags.join(','));
  if (sort !== 'price_asc') p.set('sort', sort);
  return p;
}
