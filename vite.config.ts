/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `--mode single` 은 모든 JS/CSS 를 index.html 하나에 인라인한 데모 빌드를 만든다.
// (정적 호스팅이 어려운 곳에서 파일 하나로 공유할 때 사용)
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
  },
  define: {
    __SINGLE_FILE__: JSON.stringify(mode === 'single'),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
}));
