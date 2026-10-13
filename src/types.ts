// 공통 타입. 학원·교습비 데이터 모양은 lib/realData.ts (교육청 자료 기준)에 있다.

export type CategoryGroup = 'academic' | 'sports' | 'arts';

export type AgeGroup = 'preschool' | 'elementary' | 'middle' | 'high' | 'adult';

/** 찜·비교·내 학원비에서 학원을 다시 찾기 위한 참조. sigungu 는 그 학원이 들어 있는 지역 데이터(검색한 시·군·구) */
export interface AcademyRef {
  id: string;
  sido: string;
  sigungu: string;
  name: string;
}
