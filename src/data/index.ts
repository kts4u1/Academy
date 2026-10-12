import type { Academy } from '../types';
import { generateAcademies } from './generator';

// 데이터 접근 계층. 지금은 시드 고정 샘플 데이터를 메모리에 올리지만,
// 백엔드가 생기면 이 파일만 API 호출로 바꾸면 된다.

let cache: Academy[] | null = null;
let byId: Map<string, Academy> | null = null;

export function getAcademies(): Academy[] {
  if (!cache) {
    cache = generateAcademies();
    byId = new Map(cache.map((a) => [a.id, a]));
  }
  return cache;
}

export function getAcademy(id: string): Academy | undefined {
  getAcademies();
  return byId!.get(id);
}
