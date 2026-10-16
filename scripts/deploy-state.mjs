import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

// 只对公开源码、配置和构建产物取摘要，不读取 .dev.vars 或其他个人文件。
export async function deploymentFingerprint(target, root, env) {
  const hash = createHash('sha256');
  hash.update(JSON.stringify(['zoneswitch-v1', target.kind, target.name, env.CLOUDFLARE_ACCOUNT_ID]));
  async function visit(path) {
    const entries = await readdir(resolve(root, path), { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      const child = path + '/' + entry.name;
      if (entry.isDirectory()) await visit(child);
      else if (entry.isFile()) await file(child);
      else throw new Error('部署输入不能包含符号链接：' + child);
    }
  }
  async function file(path) {
    const data = await readFile(resolve(root, path));
    hash.update(JSON.stringify([path, data.length]));
    hash.update(data);
  }
  for (const path of [target.config, 'package-lock.json', '.node-version']) await file(path);
  await visit(target.assets);
  // 后台还有动态代码；静态 Worker 只受自己的最终静态产物和配置影响。
  if (target.kind === 'admin') { await file('tsconfig.json'); await visit('src'); await visit('shared'); }
  return hash.digest('hex');
}

export function githubDeploymentState(env, request = fetch) {
  if (!env.GITHUB_TOKEN || !/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY || '') || !/^[a-f0-9]{40}$/i.test(env.GITHUB_SHA || '')) {
    throw new Error('增量部署仅在配置完整的 GitHub Actions 环境运行。');
  }
  const base = 'https://api.github.com/repos/' + env.GITHUB_REPOSITORY + '/deployments';
  const environment = target => 'zoneswitch-' + target.kind + '-' + target.name;
  async function api(path, body) {
    const response = await request(base + path, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: 'Bearer ' + env.GITHUB_TOKEN, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30_000),
    });
    // 不输出响应正文，避免服务端错误回显秘密。
    if (!response.ok) throw new Error('GitHub 部署记录操作失败（HTTP ' + response.status + '）。');
    return response.json();
  }
  return {
    async current(target) {
      const records = await api('?environment=' + encodeURIComponent(environment(target)) + '&per_page=1');
      const latest = records[0];
      if (!latest || latest.payload?.system !== 'zoneswitch-v1' || !Number.isSafeInteger(latest.id)) return undefined;
      const statuses = await api('/' + latest.id + '/statuses?per_page=1');
      // 只认最近一次成功。失败/中断可能已部分上传，必须重新部署；回退也不能命中旧记录。
      return statuses[0]?.state === 'success' ? latest.payload.fingerprint : undefined;
    },
    async start(target, fingerprint) {
      const deployment = await api('', {
        ref: env.GITHUB_SHA, auto_merge: false, required_contexts: [],
        environment: environment(target), production_environment: true,
        payload: { system: 'zoneswitch-v1', fingerprint },
        description: 'ZoneSwitch ' + target.kind,
      });
      if (!Number.isSafeInteger(deployment.id)) throw new Error('GitHub 返回了无效部署记录。');
      return deployment.id;
    },
    async finish(id, state) {
      await api('/' + id + '/statuses', { state, auto_inactive: false, description: 'ZoneSwitch ' + state });
    },
  };
}
