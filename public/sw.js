// 학원비교 서비스 워커: 홈 화면 앱으로 쓸 때 빠르게 열리고, 인터넷이 끊겨도 본 적 있는 화면·지역을 보여 준다.
//
// - 화면(index.html): 먼저 네트워크, 안 되면 보관본
// - 빌드 파일(assets/): 파일 이름에 해시가 있어 한 번 받으면 그대로 쓴다
// - 데이터 목록(data/manifest.json): 먼저 네트워크(매주 바뀜), 안 되면 보관본. 시세(market.json)는 최근 판만 따로 보관
// - 지역 데이터(data/...json?v=갱신시각): 주소에 갱신 시각이 붙어 있어 보관본을 쓰고, 최근 것 40개만 남긴다
// - 글꼴(Google Fonts): 보관본을 쓰면서 뒤에서 새로 받는다

const VERSION = 'v1';
const SHELL = `shell-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const DATA = `data-${VERSION}`;
const META = `meta-${VERSION}`;
const MARKET = `market-${VERSION}`;
const FONTS = `fonts-${VERSION}`;
const KEEP = [SHELL, ASSETS, DATA, META, MARKET, FONTS];
const MAX_DATA_FILES = 40;

const scope = new URL(self.registration.scope);
const SHELL_FILES = ['./', './index.html', './manifest.webmanifest', './favicon.svg', './icons/icon-192.png'].map((p) => new URL(p, scope).href);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(SHELL_FILES))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const hit = (await cache.match(request)) || (fallbackUrl && (await cache.match(fallbackUrl)));
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) {
    await cache.put(request, res.clone());
    if (maxEntries) {
      const keys = await cache.keys();
      // 오래 넣은 것부터 지운다 (Cache API 는 넣은 순서를 유지한다)
      for (const key of keys.slice(0, Math.max(0, keys.length - maxEntries))) await cache.delete(key);
    }
  }
  return res;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const refresh = fetch(request)
    .then((res) => {
      if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || refresh;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(request, FONTS));
    return;
  }
  if (url.origin !== scope.origin || !url.href.startsWith(scope.href)) return;
  const path = url.pathname.slice(scope.pathname.length);

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL, new URL('./index.html', scope).href));
  } else if (path.startsWith('assets/')) {
    event.respondWith(cacheFirst(request, ASSETS));
  } else if (path === 'data/manifest.json') {
    event.respondWith(networkFirst(request, META));
  } else if (path === 'data/market.json') {
    // 시세 파일은 지역 파일 정리(최근 40개)에 휩쓸리지 않게 따로 둔다
    event.respondWith(url.searchParams.has('v') ? cacheFirst(request, MARKET, 2) : networkFirst(request, MARKET));
  } else if (path.startsWith('data/')) {
    // 갱신 시각(?v=)이 붙은 파일만 오래 보관한다
    event.respondWith(url.searchParams.has('v') ? cacheFirst(request, DATA, MAX_DATA_FILES) : networkFirst(request, DATA));
  } else if (SHELL_FILES.includes(url.href) || path.startsWith('icons/')) {
    event.respondWith(staleWhileRevalidate(request, SHELL));
  }
});
