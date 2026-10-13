import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// 홈 화면 앱: 빠르게 열리고, 인터넷이 끊겨도 본 적 있는 화면을 보여 주도록 서비스 워커를 등록한다.
// (개발 서버·테스트·단일 파일 데모에서는 쓰지 않는다)
const singleFile = typeof __SINGLE_FILE__ !== 'undefined' && __SINGLE_FILE__;
if (import.meta.env.PROD && !singleFile && 'serviceWorker' in navigator) {
  // 처음 방문이면 화면이 서비스 워커보다 먼저 파일(빌드 파일·데이터 목록·지역 파일)을 받는다.
  // 서비스 워커가 켜지면 이미 받은 파일 목록을 보내 보관하게 해서, 한 번만 열어 본 뒤에도 인터넷 없이 열리게 한다.
  const firstVisit = !navigator.serviceWorker.controller;
  const sendLoaded = (sw: ServiceWorker) => {
    const urls = performance
      .getEntriesByType('resource')
      .map((e) => e.name)
      .filter((u) => u.startsWith(location.origin));
    sw.postMessage({ type: 'cache-urls', urls });
  };
  const activated = (sw: ServiceWorker) =>
    new Promise<ServiceWorker>((resolve) => {
      if (sw.state === 'activated') resolve(sw);
      else sw.addEventListener('statechange', () => sw.state === 'activated' && resolve(sw));
    });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => undefined);
    if (!firstVisit) return;
    navigator.serviceWorker.ready
      .then((reg) => (reg.active ? activated(reg.active) : null))
      .then((sw) => {
        if (!sw) return;
        sendLoaded(sw);
        // 그때 받는 중이던 파일도 끝난 뒤 한 번 더
        window.setTimeout(() => sendLoaded(sw), 5000);
      })
      .catch(() => undefined);
  });
}
