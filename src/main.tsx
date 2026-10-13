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
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => undefined);
  });
}
