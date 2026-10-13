// 아주 작은 IndexedDB 키-값 저장소. 지역별 교육청 데이터(수 MB)를 브라우저에 보관한다.
// 사생활 보호 모드처럼 IndexedDB 를 못 쓰면 이번 세션 동안 메모리에만 둔다.

const DB_NAME = 'hakwon-compare';
const STORE = 'kv';
const memory = new Map<string, unknown>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  if (!db) return memory.get(key) as T | undefined;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => resolve(memory.get(key) as T | undefined);
    } catch {
      resolve(memory.get(key) as T | undefined);
    }
  });
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  memory.set(key, value);
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      // 저장 공간이 모자라면 error 없이 abort 만 온다
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function idbClear(): Promise<void> {
  memory.clear();
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      // 저장 공간이 모자라면 error 없이 abort 만 온다
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}
