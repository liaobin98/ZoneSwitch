import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { noticeWorkers } from '../src/cloudflare.ts';
import { deploymentFingerprint, githubDeploymentState } from './deploy-state.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

export function deploymentPlan(env = {}) {
  const worker = env.WORKER_NAME || 'zone-switch';
  if (!/^[a-zA-Z0-9-]{1,63}$/.test(worker)) throw new Error('后台 Worker 名称格式不正确。');
  const notices = noticeWorkers({ ...env, WORKER_NAME: worker });
  // 静态入口先就绪；中间任何一步失败都停止，不更新后续 Worker。
  return [
    { kind: 'maintenance', name: notices.maintenance, config: 'wrangler.maintenance.jsonc', assets: 'dist/static-maintenance' },
    { kind: 'billing', name: notices.billing, config: 'wrangler.billing.jsonc', assets: 'dist/static-billing' },
    { kind: 'admin', name: worker, config: 'wrangler.jsonc', assets: 'dist/client' },
  ];
}

function runWrangler(args, { cwd, env }) {
  const cli = resolve(dirname(require.resolve('wrangler/package.json')), 'bin/wrangler.js');
  return new Promise((resolveRun, reject) => {
    // 名称作为独立参数传入，不拼接 shell 命令，不打印 Token。
    const child = spawn(process.execPath, [cli, ...args], { cwd, env: { ...env, WRANGLER_SEND_METRICS: 'false' }, stdio: 'inherit' });
    child.once('error', () => reject(new Error('无法启动 Wrangler，请先运行 npm ci。')));
    child.once('exit', code => code === 0 ? resolveRun() : reject(new Error('Wrangler 操作失败，后续部署已停止；已完成的 Worker 不会自动回滚。')));
  });
}

export async function runDeployment({ env = process.env, root = projectRoot, dryRun = false, incremental = false, target = 'auto', state, fingerprint = deploymentFingerprint, run = runWrangler, log = console.log } = {}) {
  if (!['auto', 'all', 'admin', 'maintenance', 'billing'].includes(target)) throw new Error('部署目标不正确。');
  if (dryRun && incremental) throw new Error('dry-run 不能访问线上部署记录。');
  const plan = deploymentPlan(env).filter(item => ['auto', 'all'].includes(target) || target === item.kind);
  if (!dryRun && (!env.CLOUDFLARE_API_TOKEN?.trim() || !/^[a-f0-9]{32}$/i.test(env.CLOUDFLARE_ACCOUNT_ID || ''))) {
    throw new Error('请配置部署用 CLOUDFLARE_API_TOKEN 和 32 位 CLOUDFLARE_ACCOUNT_ID，未执行任何部署。');
  }
  // 在第一步部署前检查全部产物，避免构建缺失时只更新部分 Worker。
  for (const target of plan) {
    try {
      await access(resolve(root, target.config));
      await access(resolve(root, target.assets, 'index.html'));
      if (target.kind !== 'admin') {
        await access(resolve(root, target.assets, '_headers'));
        await access(resolve(root, target.assets, '__zoneswitch_notice/controls.js'));
      }
    } catch { throw new Error('缺少 ' + target.kind + ' 部署配置或产物，请先运行 npm run build:ci。'); }
  }
  const tracker = incremental ? state || githubDeploymentState(env) : undefined;
  // 先完成全部摘要与记录查询，再上传，避免检查错误造成不必要的部分更新。
  const pending = [];
  for (const item of plan) {
    const digest = tracker ? await fingerprint(item, root, env) : undefined;
    const current = tracker ? await tracker.current(item) : undefined;
    if (tracker && target === 'auto' && digest === current) { log('内容未变化，跳过：' + item.name); continue; }
    pending.push({ item, digest });
  }
  for (const { item, digest } of pending) {
    log((dryRun ? '本地检查：' : '部署：') + item.name);
    const args = ['deploy', '--config', resolve(root, item.config), '--name', item.name];
    if (dryRun) args.push('--dry-run', '--outdir', resolve(root, 'dist/dry-run-' + item.kind));
    const id = tracker ? await tracker.start(item, digest) : undefined;
    try { await run(args, { cwd: root, env }); }
    catch (error) {
      if (tracker) { try { await tracker.finish(id, 'failure'); } catch { log('部署失败记录未能保存，下次将重新检查。'); } }
      throw error;
    }
    if (tracker) await tracker.finish(id, 'success');
  }
  log(dryRun ? '部署产物检查完成，没有上传。' : '已更新 ' + pending.length + ' 个 Worker。');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const flags = process.argv.slice(2);
  try {
    if (flags.some(flag => !['--dry-run', '--incremental'].includes(flag)) || new Set(flags).size !== flags.length) throw new Error('仅支持 --dry-run 或 --incremental 参数。');
    await runDeployment({ dryRun: flags.includes('--dry-run'), incremental: flags.includes('--incremental'), target: process.env.DEPLOY_TARGET || 'auto' });
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
