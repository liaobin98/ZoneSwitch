import { build } from 'vite';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
await build();
// 首次构建清理旧产物；监听时保留 index.html，避免 Wrangler 读到空目录并持续返回 404。
const watcher = await build({ build: { watch: {}, emptyOutDir: false } });
const wranglerPath = join(dirname(require.resolve('wrangler/package.json')), 'bin/wrangler.js');
const worker = spawn(process.execPath, [wranglerPath, 'dev', '--ip', '127.0.0.1', '--port', '8787'], { stdio: 'inherit' });
let stopping = false;
async function stop(code = 0) {
  if (stopping) return; stopping = true;
  worker.kill(); await watcher.close(); process.exit(code);
}
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
worker.on('error', error => { console.error(error.message); void stop(1); });
worker.on('exit', code => { void stop(code || 0); });
console.log('前端修改会自动重新构建；浏览器刷新后生效。');
