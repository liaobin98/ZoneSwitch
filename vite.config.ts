import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { NOTICE_ASSET_PREFIX } from './shared/notice-assets.ts';
// @ts-expect-error 构建脚本由 Node.js 执行，不进入前端 TypeScript 项目。
import { buildStaticNotices } from './scripts/static-notices.mjs';

const noticeDirectory = NOTICE_ASSET_PREFIX.slice(1);

export default defineConfig({
  plugins: [react(), tailwindcss(), { name: 'zone-switch-static-notices', async closeBundle() { await buildStaticNotices(); } }],
  build: {
    outDir: 'dist/client', emptyOutDir: true, sourcemap: false,
    rolldownOptions: {
      input: { console: 'index.html', notice: 'ui/notice/notice-controls.tsx' },
      output: {
        entryFileNames: chunk => chunk.name === 'notice' ? noticeDirectory + 'controls.js' : 'assets/[name]-[hash].js',
        chunkFileNames: noticeDirectory + 'chunks/[name]-[hash].js',
        assetFileNames: asset => asset.names.includes('notice.css') ? noticeDirectory + 'controls.css' : 'assets/[name]-[hash][extname]',
      },
    },
  },
});
