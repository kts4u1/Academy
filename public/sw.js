// 학원비교 서비스 워커: 홈 화면 앱으로 쓸 때 빠르게 열리고, 인터넷이 끊겨도 본 적 있는 화면·지역을 보여 준다.
//
// - 화면(index.html): 먼저 네트워크, 안 되면 보관본
// - 빌드 파일(assets/): 파일 이름에 해시가 있어 한 번 받으면 그대로 쓴다
// - 데이터 목록(data/manifest.json): 먼저 네트워크(매주 바뀜), 안 되면 보관본. 시세(market.json)는 최근 판만 따로 보관
// - 지역 데이터(data/...json?v=내용 해시): 내용이 바뀌면 주소가 바뀌어 보관본을 그대로 쓰고, 최근 것 40개만 남긴다
// - 글꼴(Google Fonts): 보관본을 쓰면서 뒤에서 새로 받는다
//
// 처음 방문할 때는 화면이 서비스 워커보다 먼저 파일을 받으므로, 설치할 때 index.html 이 쓰는 빌드 파일을 미리 받고
// 화면이 이미 받은 파일 목록(데이터 목록·지역 파일)을 메시지로 받아 보관한다. 그래야 한 번만 열어 봐도 오프라인에서 열린다.

const VERSION = 'v2';
const scope = new URL(self.registration.scope);
// 캐시 저장소는 주소(kts4u1.github.io) 단위라 같은 주소의 다른 사이트와 이름이 겹치지 않게 앞에 붙인다
const PREFIX = `hakwon:${scope.pathname}:`;
const SHELL = `${PREFIX}shell-${VERSION}`;
const ASSETS = `${PREFIX}assets-${VERSION}`;
const DATA = `${PREFIX}data-${VERSION}`;
const META = `${PREFIX}meta-${VERSION}`;
const MARKET = `${PREFIX}market-${VERSION}`;
const FONTS = `${PREFIX}fonts-${VERSION}`;
const KEEP = [SHELL, ASSETS, DATA, META, MARKET, FONTS];
/** 앞에 붙이는 이름이 없던 첫 판의 캐시 */
const LEGACY = ['shell-v1', 'assets-v1', 'data-v1', 'meta-v1', 'market-v1', 'fonts-v1'];
const MAX_DATA_FILES = 40;
const MAX_ASSET_FILES = 30;

const INDEX = new URL('./index.html', scope).href;
const SHELL_FILES = ['./', './index.html', './manifest.webmanifest', './favicon.svg', './icons/icon-192.png'].map((p) => new URL(p, scope).href);

/** 지금 index.html 이 쓰는 빌드 파일(./assets/...)을 미리 받아 둔다 */
async function precacheAssets() {
  const res = await fetch(INDEX, { cache: 'no-cache' });
  if (!res.ok) return;
  const html = await res.text();
  const urls = Array.from(html.matchAll(/(?:src|href)="(\.?\/?assets\/[^"]+)"/g), (m) => new URL(m[1], scope).href);
  const cache = await caches.open(ASSETS);
  await Promise.all(urls.map((u) => cache.add(u).catch(() => undefined)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .open(SHELL)
        .then((c) => c.addAll(SHELL_FILES))
        .catch(() => undefined),
      precacheAssets().catch(() => undefined),
    ]).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => (k.startsWith(PREFIX) && !KEEP.includes(k)) || LEGACY.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cache, maxEntries) {
  const keys = await cache.keys();
  // 오래 넣은 것부터 지운다 (Cache API 는 넣은 순서를 유지한다)
  for (const key of keys.slice(0, Math.max(0, keys.length - maxEntries))) await cache.delete(key);
}

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) await cache.put(request, res.clone()).catch(() => undefined);
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
    // 저장 공간이 모자라 보관에 실패해도 받은 응답은 그대로 쓴다
    try {
      await cache.put(request, res.clone());
      if (maxEntries) await trim(cache, maxEntries);
    } catch {
      // 무시
    }
  }
  return res;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const refresh = fetch(request)
    .then((res) => {
      if (res.ok || res.type === 'opaque') cache.put(request, res.clone()).catch(() => undefined);
      return res;
    })
    .catch(() => hit);
  return hit || refresh;
}

/** 주소마다 어떻게 받고 보관할지 (보관하지 않는 주소는 null) */
function strategyFor(url, navigate) {
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') return (req) => staleWhileRevalidate(req, FONTS);
  if (url.origin !== scope.origin || !url.href.startsWith(scope.href)) return null;
  const path = url.pathname.slice(scope.pathname.length);
  const versioned = url.searchParams.has('v');

  if (navigate) return (req) => networkFirst(req, SHELL, INDEX);
  if (path.startsWith('assets/')) return (req) => cacheFirst(req, ASSETS, MAX_ASSET_FILES);
  if (path === 'data/manifest.json') return (req) => networkFirst(req, META);
  // 시세 파일은 지역 파일 정리(최근 40개)에 휩쓸리지 않게 따로 둔다
  if (path === 'data/market.json') return (req) => (versioned ? cacheFirst(req, MARKET, 2) : networkFirst(req, MARKET));
  // 버전(?v=)이 붙은 파일만 오래 보관한다
  if (path.startsWith('data/')) return (req) => (versioned ? cacheFirst(req, DATA, MAX_DATA_FILES) : networkFirst(req, DATA));
  if (SHELL_FILES.includes(url.href) || path.startsWith('icons/')) return (req) => staleWhileRevalidate(req, SHELL);
  return null;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const handle = strategyFor(new URL(request.url), request.mode === 'navigate');
  if (handle) event.respondWith(handle(request));
});

// 화면이 서비스 워커가 맡기 전에 받은 파일들: 같은 규칙으로 보관한다 (대부분 브라우저 캐시에서 바로 온다)
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'cache-urls' || !Array.isArray(data.urls)) return;
  event.waitUntil(
    Promise.all(
      data.urls.slice(0, 50).map((u) => {
        let url;
        try {
          url = new URL(u, scope);
        } catch {
          return undefined;
        }
        if (url.origin !== scope.origin) return undefined;
        const handle = strategyFor(url, false);
        return handle ? handle(new Request(url.href)).catch(() => undefined) : undefined;
      }),
    ),
  );
});
