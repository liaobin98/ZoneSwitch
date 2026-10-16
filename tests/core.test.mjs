import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import worker from '../src/index.ts';
import { ZoneSwitchState } from '../src/state.ts';
import { Cloudflare } from '../src/cloudflare.ts';
import { sha256 } from '../src/utils.ts';
import { passwordHash } from '../scripts/password.mjs';
import { deploymentFingerprint } from '../scripts/deploy-state.mjs';
import { translateConsole } from '../shared/console-i18n.ts';

const zoneId = 'a'.repeat(32);
const password = 'fixture-password';
const hash = passwordHash(password);

// API 和 DO 均为测试替身，不加载个人配置，不访问 Cloudflare。
function fixture() {
  const rows = new Map();
  const storage = {
    async get(key) { return structuredClone(rows.get(key)); },
    async put(key, value) { rows.set(key, structuredClone(value)); },
    async delete(key) { if (storage.failDelete) throw new Error('storage unavailable'); return rows.delete(key); },
    async transaction(callback) { return callback(storage); },
    async getAlarm() { return storage.alarm ?? null; },
    async setAlarm(value) { storage.alarm = value; },
  };
  const env = { CF_ACCOUNT_ID: 'b'.repeat(32), CF_API_TOKEN: 'fixture-token', CONTROL_HOST: '127.0.0.1', WORKER_NAME: 'zone-switch', ADMIN_USERNAME: 'admin', ADMIN_PASSWORD_HASH: hash };
  const routes = [];
  const records = ['app.example.com', 'www.example.com', '*.example.com'].map((name, index) => ({ id: String(index), name, type: 'A', content: '192.0.2.1', proxied: true }));
  const calls = { zones: 0, domains: 0, dns: 0, routes: 0, writes: 0 };
  const control = { loseResponse: false, rejectWrite: false, failReadAfterWrite: false, failRoutes: false, incompleteResponse: false };
  let routeId = 0;
  const fetcher = async (url, init = {}) => {
    assert.equal(new URL(url).origin, 'https://api.cloudflare.com');
    const path = new URL(url).pathname;
    let result;
    if (path === '/client/v4/zones') { calls.zones++; result = [{ id: zoneId, name: 'example.com', status: 'active' }]; }
    else if (path.endsWith('/workers/domains')) { calls.domains++; result = [{ hostname: 'app.example.com', zone_id: zoneId, service: 'business-worker' }]; }
    else if (path.endsWith('/dns_records')) { calls.dns++; result = records; }
    else if (path.includes('/workers/routes')) {
      if (!init.method || init.method === 'GET') {
        calls.routes++;
        if (control.failRoutes) throw new Error('simulated route query failure');
        result = routes;
      } else {
        calls.writes++;
        if (!control.rejectWrite) {
          if (init.method === 'POST') { result = { id: 'route-' + ++routeId, ...JSON.parse(init.body) }; routes.push(result); }
          else {
            const index = routes.findIndex(route => route.id === path.split('/').at(-1));
            assert(index >= 0);
            if (init.method === 'DELETE') { routes.splice(index, 1); result = null; }
            else { result = { id: routes[index].id, ...JSON.parse(init.body) }; routes[index] = result; }
          }
        }
        if (control.failReadAfterWrite) control.failRoutes = true;
        if (control.loseResponse || control.rejectWrite) throw new Error('simulated lost response');
        if (control.incompleteResponse) result = {};
      }
    } else throw new Error('unexpected API path: ' + path);
    return new Response(JSON.stringify({ success: true, result, result_info: { total_pages: 1 } }), { headers: { 'Content-Type': 'application/json' } });
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetcher;
  let state = new ZoneSwitchState({ storage }, env);
  env.STATE = { idFromName: name => name, get: () => ({ fetch: (url, init) => state.fetch(new Request(url, init)) }) };
  const apply = async (mode, hostname = 'app.example.com', batchId) => (await state.apply({ targets: [{ zoneId, hostname }], mode, username: 'admin', demo: false, batchId })).json();
  const request = (path, data, headers = {}) => worker.fetch(new Request('http://127.0.0.1:8787/api/' + path, {
    method: data === undefined ? 'GET' : 'POST', headers: { Origin: 'http://127.0.0.1:8787', 'Content-Type': 'application/json', ...headers }, ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  }), env);
  const login = async () => {
    const response = await request('login', { username: 'admin', password });
    assert.equal(response.status, 200);
    const data = await response.json();
    return { Cookie: response.headers.get('Set-Cookie').split(';')[0], 'X-CSRF-Token': data.csrf };
  };
  return { env, rows, storage, routes, records, calls, control, apply, request, login, get state() { return state; }, restart() { state = new ZoneSwitchState({ storage }, env); }, close() { globalThis.fetch = originalFetch; } };
}

async function usingFixture(callback) { const f = fixture(); try { await callback(f); } finally { f.close(); } }

test('登录、Origin/CSRF、密码更新撤销和退出重试', async () => usingFixture(async f => {
  assert.equal((await f.request('inventory')).status, 401);
  assert.equal((await f.request('login', { username: 'admin', password }, { Origin: 'http://invalid.example' })).status, 403);
  const headers = await f.login();
  assert.equal((await f.request('refresh', {}, { ...headers, 'X-CSRF-Token': 'invalid' })).status, 403);
  f.storage.failDelete = true;
  const failed = await f.request('logout', {}, headers);
  assert.equal(failed.status, 503);
  assert.equal(failed.headers.get('Set-Cookie'), null);
  assert.equal((await f.request('session', undefined, headers)).status, 200);
  f.storage.failDelete = false;
  assert.equal((await f.request('logout', {}, headers)).status, 200);
  assert.equal((await f.request('session', undefined, headers)).status, 401);
  const renewed = await f.login();
  f.env.ADMIN_PASSWORD_HASH = passwordHash('different-password');
  assert.equal((await f.request('session', undefined, renewed)).status, 401);
}));

test('登录限流与过期会话', async () => usingFixture(async f => {
  for (let i = 0; i < 8; i++) assert.equal((await f.request('login', { username: 'admin', password: 'wrong' })).status, 401);
  assert.equal((await f.request('login', { username: 'admin', password })).status, 429);
  f.rows.clear();
  const headers = await f.login();
  const token = headers.Cookie.split('=')[1];
  const key = 'session:' + await sha256(token);
  f.rows.get(key).expiresAt = Date.now() - 1;
  assert.equal((await f.request('session', undefined, headers)).status, 401);
}));

test('会话查询异常或撤销响应无效时，不伪装为已过期或退出成功', async () => usingFixture(async f => {
  const headers = await f.login();
  const normalState = f.env.STATE;
  f.env.STATE = { idFromName: name => name, get: () => ({ fetch: async () => new Response('{}', { status: 500 }) }) };
  assert.equal((await f.request('session', undefined, headers)).status, 503);
  for (const payload of ['{}', '{"success":false}', 'invalid-json']) {
    f.env.STATE = { idFromName: name => name, get: () => ({ fetch: async (url, init) => new URL(url).pathname === '/logout' ? new Response(payload) : normalState.get().fetch(url, init) }) };
    const result = await f.request('logout', {}, headers);
    assert.equal(result.status, 503); assert.equal(result.headers.get('Set-Cookie'), null);
  }
}));

test('Worker、代理入口维护、欠费、恢复，日志持久化', async () => usingFixture(async f => {
  await f.state.refresh(false);
  for (const hostname of ['app.example.com', 'www.example.com']) for (const mode of ['maintenance', 'billing', 'normal']) {
    const result = await f.apply(mode, hostname);
    assert.equal(result.results[0].success, true);
  }
  assert.equal(f.routes.length, 0);
  f.restart();
  const audit = await (await f.state.auditPage({ pageSize: 2 })).json();
  assert.equal(audit.total, 6); assert.equal(audit.entries.length, 2); assert.equal(audit.totalPages, 3);
}));

test('演示环境跨 Zone 批量操作不调用 API', async () => usingFixture(async f => {
  await f.state.refresh(true);
  const targets = [{ zoneId: 'demo-zone-1', hostname: 'api.example.com' }, { zoneId: 'demo-zone-2', hostname: 'app.example.net' }];
  for (const mode of ['maintenance', 'billing', 'normal']) {
    const result = await (await f.state.apply({ targets, mode, username: 'admin', demo: true })).json();
    assert(result.results.every(item => item.success && item.mode === mode));
  }
  assert(Object.values(f.calls).every(count => count === 0));
}));

for (const mode of ['maintenance', 'billing', 'normal']) test(`${mode} 写入后响应丢失，重新查询确认成功`, async () => usingFixture(async f => {
  await f.state.refresh(false);
  if (mode !== 'maintenance') await f.apply('maintenance');
  f.control.loseResponse = true;
  const result = await f.apply(mode);
  assert.equal(result.results[0].success, true);
  assert.equal(result.results[0].mode, mode);
  const host = (await f.storage.get('inventory')).zones[0].hosts.find(host => host.hostname === 'app.example.com');
  assert.equal(host.mode, mode); assert.equal(host.needsVerification, false);
}));

test('写入未发生且查询成功，报告失败并清除待核实标记', async () => usingFixture(async f => {
  await f.state.refresh(false);
  f.control.rejectWrite = true;
  const result = await f.apply('maintenance');
  assert.equal(result.results[0].success, false); assert.equal(result.results[0].uncertain, undefined);
  assert.deepEqual(await f.storage.get('managedRoutes'), {});
  assert.equal((await f.storage.get('inventory')).zones[0].hosts[0].needsVerification, false);
}));

test('不完整写入响应通过路由查询核实', async () => usingFixture(async f => {
  await f.state.refresh(false);
  f.control.incompleteResponse = true;
  assert.equal((await f.apply('maintenance')).results[0].success, true);
}));

for (const mode of ['maintenance', 'billing', 'normal']) test(`${mode} 写入与核实响应均失败，重启后同步恢复`, async () => usingFixture(async f => {
  await f.state.refresh(false);
  if (mode !== 'maintenance') await f.apply('maintenance');
  f.control.loseResponse = true; f.control.failReadAfterWrite = true;
  const result = await f.apply(mode);
  assert.equal(result.results[0].uncertain, true);
  const host = (await f.storage.get('inventory')).zones[0].hosts.find(host => host.hostname === 'app.example.com');
  assert.equal(host.needsVerification, true); assert.equal(host.actionable, false);
  assert.equal((await f.storage.get('audit'))[0].results[0].uncertain, true);
  f.restart();
  const failedSync = await f.state.refresh(false);
  assert.equal(failedSync.zones[0].hosts.find(host => host.hostname === 'app.example.com').needsVerification, true);
  f.control.failRoutes = false;
  const synced = await f.state.refresh(false);
  const verified = synced.zones[0].hosts.find(host => host.hostname === 'app.example.com');
  assert.equal(verified.mode, mode); assert.equal(verified.needsVerification, false);
  assert(Object.values(await f.storage.get('managedRoutes')).every(route => !route.pending));
}));

test('通配维护下恢复具体域名，响应丢失仍保留无脚本例外', async () => usingFixture(async f => {
  await f.state.refresh(false);
  await f.apply('maintenance', '*.example.com');
  f.control.loseResponse = true;
  assert.equal((await f.apply('normal')).results[0].success, true);
  const bypass = f.routes.find(route => route.pattern === 'app.example.com/*');
  assert(bypass); assert.equal(bypass.script, undefined);
  assert.equal((await f.apply('billing')).results[0].success, true);
  assert.equal(f.routes.find(route => route.pattern === 'app.example.com/*').script, 'zone-switch-billing');
}));

test('写入意图已保存但旧快照未更新时，重启仍显示待核实', async () => usingFixture(async f => {
  const original = await f.state.refresh(false);
  f.control.loseResponse = true; f.control.failReadAfterWrite = true;
  await f.apply('maintenance', '*.example.com');
  // 模拟实例在更新快照之前中断，保留旧快照与已保存的写入意图。
  await f.storage.put('inventory', original);
  f.restart();
  const cached = await (await f.state.fetch(new Request('https://internal/inventory', { method: 'POST', body: '{}' }))).json();
  assert(cached.zones[0].hosts.every(host => host.needsVerification));
  const failedSync = await f.state.refresh(false);
  assert(failedSync.zones[0].hosts.every(host => host.needsVerification));
  f.control.failRoutes = false;
  const verified = await f.state.refresh(false);
  assert(verified.zones[0].hosts.every(host => !host.needsVerification && host.mode === 'maintenance'));
}));

test('外部修改路由脚本或 pattern 后拒绝覆盖和删除', async () => usingFixture(async f => {
  await f.state.refresh(false);
  await f.apply('maintenance');
  for (const alteration of [{ script: 'external-worker' }, { pattern: 'www.example.com/*', script: 'zone-switch-maintenance' }]) {
    Object.assign(f.routes[0], alteration);
    const before = structuredClone(f.routes);
    for (const mode of ['normal', 'billing']) assert.equal((await f.apply(mode)).results[0].success, false);
    assert.deepEqual(f.routes, before);
  }
}));

test('人工冲突、仅 DNS、后台及通配后台入口受保护', async () => usingFixture(async f => {
  f.records.push({ id: 'mail', name: 'mail.example.com', type: 'A', content: '192.0.2.2', proxied: false });
  f.env.CONTROL_HOST = 'www.example.com';
  f.routes.push({ id: 'external', pattern: 'app.example.com/*', script: 'external-worker' });
  await f.state.refresh(false);
  for (const host of ['app.example.com', 'mail.example.com', 'www.example.com', '*.example.com']) assert.equal((await f.apply('maintenance', host)).results[0].success, false);
  assert.equal(f.calls.writes, 0);
}));

test('同任务复用基础清单，新任务、过期和同步会重新读取，路由持续核验', async () => usingFixture(async f => {
  await f.state.refresh(false);
  const batchId = randomUUID();
  const before = { ...f.calls };
  await f.apply('maintenance', 'app.example.com', batchId);
  await f.apply('maintenance', 'www.example.com', batchId);
  assert.equal(f.calls.zones - before.zones, 1); assert.equal(f.calls.domains - before.domains, 1);
  assert.equal(f.calls.dns - before.dns, 2); assert.equal(f.calls.routes - before.routes, 4);
  await f.apply('billing', 'app.example.com', randomUUID());
  assert.equal(f.calls.zones - before.zones, 2);
  f.state.batchAccount.expiresAt = Date.now() - 1;
  await f.apply('billing', 'www.example.com', f.state.batchAccount.id);
  assert.equal(f.calls.zones - before.zones, 3);
  await f.state.refresh(false); assert.equal(f.state.batchAccount, undefined);
  await assert.rejects(f.apply('maintenance', 'app.example.com', 'invalid'), /批量任务标识/);
}));

test('分页 API 完整读取所有页', async () => {
  const paths = [];
  const api = new Cloudflare({ CF_ACCOUNT_ID: 'b'.repeat(32), CF_API_TOKEN: 'fixture' }, async url => {
    const parsed = new URL(url); paths.push(parsed.searchParams.get('page'));
    return new Response(JSON.stringify({ success: true, result: [parsed.searchParams.get('page')], result_info: { total_pages: 2 } }));
  });
  assert.deepEqual(await api.zones(), ['1', '2']); assert.deepEqual(paths, ['1', '2']);
});

test('三套部署摘要可计算，待核实文案支持英文', async () => {
  assert.equal((await readFile('.node-version', 'utf8')).trim(), '24');
  const base = resolve('.cache');
  await mkdir(base, { recursive: true });
  const root = await mkdtemp(resolve(base, 'test-deploy-'));
  try {
    for (const path of ['src', 'shared', 'dist/client', 'dist/static-maintenance', 'dist/static-billing']) await mkdir(resolve(root, path), { recursive: true });
    for (const path of ['wrangler.jsonc', 'wrangler.maintenance.jsonc', 'wrangler.billing.jsonc', 'package-lock.json', 'tsconfig.json', 'src/index.ts', 'shared/contracts.ts']) await writeFile(resolve(root, path), '{}');
    await writeFile(resolve(root, '.node-version'), '24\n');
    for (const kind of ['admin', 'maintenance', 'billing']) {
      const config = kind === 'admin' ? 'wrangler.jsonc' : `wrangler.${kind}.jsonc`;
      const assets = kind === 'admin' ? 'dist/client' : `dist/static-${kind}`;
      await writeFile(resolve(root, assets, 'index.html'), '<html>fixture</html>');
      const target = { kind, name: kind, config, assets };
      const digest = await deploymentFingerprint(target, root, { CLOUDFLARE_ACCOUNT_ID: 'b'.repeat(32) });
      assert.match(digest, /^[a-f0-9]{64}$/);
      await writeFile(resolve(root, assets, 'index.html'), '<html>changed</html>');
      assert.notEqual(await deploymentFingerprint(target, root, { CLOUDFLARE_ACCOUNT_ID: 'b'.repeat(32) }), digest);
    }
  } finally {
    // 只清理刚创建且位于本项目 .cache 内的测试目录。
    assert(root.startsWith(base + sep));
    await rm(root, { recursive: true, force: true });
  }
  assert.equal(translateConsole('en', '待核实'), 'Needs verification');
  assert.equal(translateConsole('en', '操作完成：1 个成功，2 个失败，3 个待核实。'), 'Completed: 1 succeeded, 2 failed, 3 need verification.');
});
