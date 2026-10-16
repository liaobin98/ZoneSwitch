import { Cloudflare, hasPendingRoute, inspectRouting, loadAccountInventory, loadInventory, noticeWorkers, ownsRoute, routeHost, routeMatchesHost } from './cloudflare.ts';
import type { AccountInventory } from './cloudflare.ts';
import { demoInventory } from './demo.ts';
import type { AuditEntry, ChangeResult, Env, Inventory, ManagedRoute, ManagedRoutes, Mode, Target, WorkerRoute } from './types.ts';
import { HttpError } from './types.ts';
import { equal, hostMatches, isHostname, json, normalizeHost, policyFor, randomToken, sha256, verifyPassword } from './utils.ts';

interface Session { username: string; csrf: string; expiresAt: number; credential: string }
interface Limit { attempts: number; until: number }
const SESSION_SECONDS = 8 * 60 * 60;
export class ZoneSwitchState {
  ctx: DurableObjectState;
  env: Env;
  queue: Promise<unknown> = Promise.resolve();
  batchAccount?: { id: string; username: string; expiresAt: number; data: AccountInventory };
  constructor(ctx: DurableObjectState, env: Env) { this.ctx = ctx; this.env = env; }
  async policies(): Promise<Record<string, Mode>> { return await this.ctx.storage.get<Record<string, Mode>>('policies') || {}; }
  async managedRoutes(): Promise<ManagedRoutes> { return await this.ctx.storage.get<ManagedRoutes>('managedRoutes') || {}; }
  async session(token: string): Promise<Session | undefined> {
    if (!/^[a-f0-9]{64}$/.test(token || '')) return;
    const key = 'session:' + await sha256(token);
    const session = await this.ctx.storage.get<Session>(key);
    if (session && (session.expiresAt <= Date.now() || session.credential !== await sha256(this.env.ADMIN_PASSWORD_HASH + ':' + this.env.ADMIN_USERNAME))) { await this.ctx.storage.delete(key); return; }
    return session;
  }
  async login(data: { username: string; password: string; ip: string }): Promise<Response> {
    if (typeof data.username !== 'string' || typeof data.password !== 'string' || data.username.length > 100 || data.password.length > 256) throw new HttpError(400, '账号或密码格式不正确。');
    const limitKey = 'limit:' + await sha256(data.ip);
    const allowed = await this.ctx.storage.transaction(async txn => {
      let limit = await txn.get<Limit>(limitKey);
      if (!limit || limit.until < Date.now()) limit = { attempts: 0, until: Date.now() + 15 * 60 * 1000 };
      if (limit.attempts >= 8) return false;
      limit.attempts++; await txn.put(limitKey, limit); return true;
    });
    if (await this.ctx.storage.getAlarm() === null) await this.ctx.storage.setAlarm(Date.now() + 60 * 60 * 1000);
    if (!allowed) throw new HttpError(429, '登录尝试过多，请 15 分钟后重试。');
    const passwordCorrect = await verifyPassword(data.password, this.env.ADMIN_PASSWORD_HASH);
    if (!passwordCorrect || !equal(data.username, this.env.ADMIN_USERNAME)) throw new HttpError(401, '账号或密码不正确。');
    const token = randomToken();
    const session: Session = { username: data.username, csrf: randomToken(), expiresAt: Date.now() + SESSION_SECONDS * 1000, credential: await sha256(this.env.ADMIN_PASSWORD_HASH + ':' + this.env.ADMIN_USERNAME) };
    await this.ctx.storage.put('session:' + await sha256(token), session);
    await this.ctx.storage.delete(limitKey);
    if (await this.ctx.storage.getAlarm() === null) await this.ctx.storage.setAlarm(Date.now() + 60 * 60 * 1000);
    return json({ token, ...session, credential: undefined, maxAge: SESSION_SECONDS });
  }
  async refresh(demo: boolean): Promise<Inventory> {
    this.batchAccount = undefined;
    const policies = await this.policies();
    const managed = await this.managedRoutes();
    const routesByZone = new Map<string, WorkerRoute[]>();
    const inventory = demo ? demoInventory(this.env, policies, managed) : await loadInventory(new Cloudflare(this.env), this.env, policies, undefined, managed, undefined, routesByZone);
    // 同步成功的域重新核实未完成的写入；查询失败时继续保留待核实标记。
    for (const [hostname, record] of Object.entries(managed)) {
      const routes = routesByZone.get(record.zoneId);
      if (!record.pending || !routes) continue;
      const names = noticeWorkers(this.env);
      const mode = record.pendingMode ?? (record.pendingScript === names.maintenance ? 'maintenance' : record.pendingScript === names.billing ? 'billing' : 'normal');
      const needsRoute = record.pendingDelete === undefined ? record.pendingScript !== undefined || routes.some(route => route.pattern === record.pattern && !route.script) : !record.pendingDelete;
      await this.settleChange({ zoneId: record.zoneId, hostname }, mode, needsRoute, routes, managed, policies);
    }
    const previous = await this.ctx.storage.get<Inventory>('inventory');
    for (const zone of inventory.zones) {
      if (zone.error) zone.hosts = (previous?.zones.find(item => item.id === zone.id)?.hosts || []).map(host => ({ ...host, mode: policyFor(policies, host.hostname), needsVerification: hasPendingRoute(host.hostname, zone.id, managed), actionable: false, reason: '同步失败，保留上次列表；仅可恢复服务' }));
      else if (routesByZone.has(zone.id)) for (const host of zone.hosts) {
        const routing = inspectRouting(host.hostname, zone.id, routesByZone.get(zone.id)!, this.env, managed, policies);
        host.mode = routing.mode; host.connected = routing.connected; host.needsVerification = routing.needsVerification;
        host.actionable = !host.reason && !host.needsVerification;
      }
    }
    await this.ctx.storage.put('inventory', inventory);
    return inventory;
  }
  serial<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.queue.then(operation, operation);
    this.queue = next.catch(() => undefined);
    return next;
  }
  async auditPage(data: Record<string, unknown>): Promise<Response> {
    const page = Number(data.page ?? 1);
    const pageSize = Number(data.pageSize ?? 20);
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new HttpError(400, '日志分页参数不正确。');
    const audit = await this.ctx.storage.get<AuditEntry[]>('audit') || [];
    const total = audit.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const current = Math.min(page, totalPages);
    const offset = (current - 1) * pageSize;
    return json({ entries: audit.slice(offset, offset + pageSize), page: current, pageSize, total, totalPages });
  }
  async accountForBatch(api: Cloudflare, id: string | undefined, username: string): Promise<AccountInventory> {
    if (id && this.batchAccount?.id === id && this.batchAccount.username === username && this.batchAccount.expiresAt > Date.now()) return this.batchAccount.data;
    const account = await loadAccountInventory(api);
    // 仅同一次批量任务短时复用账号基础清单；DNS 和路由每批仍重新读取。
    this.batchAccount = id ? { id, username, expiresAt: Date.now() + 2 * 60 * 1000, data: account } : undefined;
    return account;
  }
  async settleChange(target: Target, mode: Mode, needsRoute: boolean, routes: WorkerRoute[], managed: ManagedRoutes, policies: Record<string, Mode>): Promise<boolean> {
    const record = managed[target.hostname];
    const exact = routes.filter(route => route.pattern === target.hostname + '/*');
    const current = exact.length === 1 ? exact[0] : undefined;
    const desiredScript = mode === 'normal' ? undefined : noticeWorkers(this.env)[mode];
    const achieved = needsRoute
      ? Boolean(current && ownsRoute(record, current, target.zoneId) && (current.script || undefined) === desiredScript)
      : exact.length === 0 && !routes.some(route => route.id === record?.id);
    if (current && ownsRoute(record, current, target.zoneId)) managed[target.hostname] = { zoneId: target.zoneId, pattern: current.pattern, id: current.id, script: current.script || undefined };
    else if (record?.id && routes.some(route => route.id === record.id)) {
      // 外部修改仍保留原归属记录，后续操作继续拒绝覆盖或删除。
      managed[target.hostname] = { zoneId: record.zoneId, pattern: record.pattern, id: record.id, script: record.script };
    } else delete managed[target.hostname];
    if (achieved) policies[target.hostname] = mode;
    await this.ctx.storage.transaction(async txn => { await txn.put('managedRoutes', managed); await txn.put('policies', policies); });
    return achieved;
  }
  async apply(data: { targets: Target[]; mode: Mode; username: string; demo: boolean; batchId?: string }): Promise<Response> {
    if (!['normal', 'maintenance', 'billing'].includes(data.mode) || !Array.isArray(data.targets) || !data.targets.length || data.targets.length > 20) throw new HttpError(400, '请选择 1 到 20 个域名及有效状态。');
    if (data.batchId !== undefined && (typeof data.batchId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(data.batchId))) throw new HttpError(400, '批量任务标识不正确。');
    const targets: Target[] = [];
    const seen = new Set<string>();
    for (const target of data.targets) {
      if (!target || typeof target.zoneId !== 'string' || !/^[a-f0-9]{32}$/i.test(target.zoneId) && !(data.demo && /^demo-zone-[12]$/.test(target.zoneId)) || typeof target.hostname !== 'string' || !isHostname(target.hostname)) throw new HttpError(400, '域名参数不正确。');
      const hostname = normalizeHost(target.hostname);
      if (!seen.has(hostname)) { targets.push({ zoneId: target.zoneId, hostname }); seen.add(hostname); }
    }
    const policies = await this.policies();
    const managed = await this.managedRoutes();
    const api = new Cloudflare(this.env);
    const workers = noticeWorkers(this.env);
    // 开启重新校验业务配置；恢复使用已存入口，但也必须校验并修改真实路由。
    const fresh = data.mode === 'normal'
      ? await this.ctx.storage.get<Inventory>('inventory')
      : data.demo ? demoInventory(this.env, policies, managed) : await loadInventory(api, this.env, policies, [...new Set(targets.map(item => item.zoneId))], managed, await this.accountForBatch(api, data.batchId, data.username));
    if (!fresh) throw new HttpError(409, '请先同步域名列表。');
    const results: ChangeResult[] = [];
    const routesByZone = new Map<string, WorkerRoute[]>();
    for (const target of targets) {
      let mutation: { needsRoute: boolean; record: ManagedRoute } | undefined;
      try {
        const zone = fresh.zones.find(item => item.id === target.zoneId);
        const host = zone?.hosts.find(item => item.hostname === target.hostname);
        if (!zone || !host || zone.error && data.mode !== 'normal') throw new HttpError(400, zone?.error || '域名已移除或不在授权范围内，请刷新列表。');
        if (hostMatches(host.hostname, normalizeHost(this.env.CONTROL_HOST)) || [this.env.WORKER_NAME, ...Object.values(workers)].includes(host.service)) throw new HttpError(400, '管理后台或提示页入口不能切换维护状态。');
        if (data.mode !== 'normal' && !host.actionable) throw new HttpError(409, host.needsVerification ? '操作结果待核实，请同步域名后确认。' : host.reason);
        let routes = routesByZone.get(zone.id);
        if (!routes) {
          routes = data.demo ? Object.values(managed).filter(route => route.zoneId === zone.id).map(route => ({ id: route.id || route.pattern, pattern: route.pattern, script: route.script })) : await api.routes(zone.id);
          routesByZone.set(zone.id, routes);
        }
        const pattern = host.hostname + '/*';
        const exact = routes.filter(route => route.pattern === pattern);
        if (exact.length > 1) throw new HttpError(409, '存在重复路由，请先在 Cloudflare 核查。');
        const current = exact[0];
        const previousRoute = JSON.stringify(managed[host.hostname]);
        const previousPolicy = policies[host.hostname];
        const recordedId = managed[host.hostname]?.id;
        const recordedRoute = recordedId ? routes.find(route => route.id === recordedId) : undefined;
        if (recordedRoute && !ownsRoute(managed[host.hostname], recordedRoute, zone.id)) throw new HttpError(409, '路由已被其他配置修改，未覆盖或删除，请在 Cloudflare 核查。');
        // 迁移旧版已记录主机的后台 Route；不接管其他 Worker 或人工创建的提示路由。
        if (!managed[host.hostname] && current?.script === this.env.WORKER_NAME && Object.hasOwn(policies, host.hostname)) {
          managed[host.hostname] = { zoneId: zone.id, pattern, id: current.id, script: current.script };
          await this.ctx.storage.put('managedRoutes', managed);
        }
        if (current && !ownsRoute(managed[host.hostname], current, zone.id)) throw new HttpError(409, '路由已被其他配置修改，未覆盖或删除，请在 Cloudflare 核查。');
        const routing = inspectRouting(host.hostname, zone.id, routes, this.env, managed, policies);
        if (data.mode !== 'normal' && routing.conflict) throw new HttpError(409, '存在路由冲突，未修改原配置。');
        const covering = routes.filter(route => route !== current && route.pattern === routeHost(route) + '/*' && routeMatchesHost(route, host.hostname))
          .sort((a, b) => routeHost(b).length - routeHost(a).length)[0];
        // 通配维护下恢复具体主机，用无脚本 Route 排除该主机，不执行任何 Worker。
        const bypass = data.mode === 'normal' && Boolean(covering?.script) && inspectRouting(host.hostname, zone.id, [covering], this.env, managed, policies).connected;
        if (bypass && routing.conflict) throw new HttpError(409, '通配维护存在其他路由冲突，无法安全添加恢复例外。');
        const script = data.mode === 'normal' ? undefined : workers[data.mode];
        const needsRoute = data.mode !== 'normal' || bypass;
        if (needsRoute && (!current || (current.script || undefined) !== script)) {
          // 先持久化意图；API 超时或实例重启后，可以重新查询路由并继续操作。
          managed[host.hostname] = { zoneId: zone.id, pattern, ...(current ? { id: current.id, script: current.script || undefined } : {}), pending: true, pendingScript: script, pendingMode: data.mode, pendingDelete: false };
          await this.ctx.storage.put('managedRoutes', managed);
          mutation = { needsRoute: true, record: { ...managed[host.hostname] } };
          const changed = data.demo ? { id: current?.id || pattern, pattern, script } : current ? await api.replace(zone.id, current, script) : await api.attach(zone.id, host.hostname, script);
          if (!changed?.id || changed.pattern !== pattern || (changed.script || undefined) !== script) throw new HttpError(502, 'Cloudflare 路由响应不完整，请同步后核查。');
          if (current) routes.splice(routes.indexOf(current), 1, changed); else routes.push(changed);
          managed[host.hostname] = { zoneId: zone.id, pattern, id: changed.id, script };
        } else if (!needsRoute && current) {
          managed[host.hostname] = { zoneId: zone.id, pattern, id: current.id, script: current.script || undefined, pending: true, pendingMode: data.mode, pendingDelete: true };
          await this.ctx.storage.put('managedRoutes', managed);
          mutation = { needsRoute: false, record: { ...managed[host.hostname] } };
          if (!data.demo) await api.detach(zone.id, current.id);
          routes.splice(routes.indexOf(current), 1);
          delete managed[host.hostname];
        } else if (!needsRoute) {
          delete managed[host.hostname];
        } else if (current) {
          managed[host.hostname] = { zoneId: zone.id, pattern, id: current.id, script };
        }
        // 路由变更成功才提交状态；DO 不再用于访客逐请求判断。
        policies[host.hostname] = data.mode;
        if (previousRoute !== JSON.stringify(managed[host.hostname]) || previousPolicy !== data.mode) {
          await this.ctx.storage.transaction(async txn => { await txn.put('managedRoutes', managed); await txn.put('policies', policies); });
        }
        results.push({ ...target, success: true, mode: data.mode });
      } catch (error) {
        if (mutation && !data.demo) {
          managed[target.hostname] = mutation.record;
          try {
            // 写入可能已经生效，只读查询核实，不自动重复写入。
            const observed = await api.routes(target.zoneId);
            const achieved = await this.settleChange(target, data.mode, mutation.needsRoute, observed, managed, policies);
            routesByZone.set(target.zoneId, observed);
            results.push(achieved ? { ...target, success: true, mode: data.mode } : { ...target, success: false, error: '路由已核实，但未达到目标状态，请同步后重试。' });
          } catch {
            managed[target.hostname] = mutation.record;
            // 后续主机不再使用这一域的旧路由快照，必须重新查询。
            routesByZone.delete(target.zoneId);
            results.push({ ...target, success: false, uncertain: true, error: '操作结果待核实，请同步域名后确认。' });
          }
        } else results.push({ ...target, success: false, error: error instanceof Error ? error.message : '操作失败' });
      }
    }
    const audit = await this.ctx.storage.get<AuditEntry[]>('audit') || [];
    audit.unshift({ time: new Date().toISOString(), username: data.username, mode: data.mode, results });
    await this.ctx.storage.put('audit', audit.slice(0, 100));
    const cached = await this.ctx.storage.get<Inventory>('inventory');
    if (cached) {
      for (const zone of cached.zones) for (const host of zone.hosts) {
        const routes = routesByZone.get(zone.id);
        if (routes) {
          const routing = inspectRouting(host.hostname, zone.id, routes, this.env, managed, policies);
          host.mode = routing.mode; host.connected = routing.connected; host.needsVerification = routing.needsVerification;
          host.actionable = !host.reason && !host.needsVerification;
        } else {
          host.mode = policyFor(policies, host.hostname);
          host.needsVerification = hasPendingRoute(host.hostname, zone.id, managed);
          host.actionable = !host.reason && !host.needsVerification;
        }
      }
      await this.ctx.storage.put('inventory', cached);
    }
    return json({ results });
  }
  async fetch(request: Request): Promise<Response> {
    try {
      const path = new URL(request.url).pathname;
      const data = request.method === 'POST' ? await request.json() as Record<string, any> : {};
      if (path === '/login') return await this.login(data as { username: string; password: string; ip: string });
      if (path === '/session') { const session = await this.session(String(data.token)); return session ? json({ username: session.username, csrf: session.csrf, expiresAt: session.expiresAt }) : json({ error: '请先登录。' }, 401); }
      if (path === '/logout') { await this.ctx.storage.delete('session:' + await sha256(String(data.token))); return json({ success: true }); }
      if (path === '/inventory') {
        const inventory = await this.ctx.storage.get<Inventory>('inventory');
        // 实例可能在写入意图后、更新快照前中断，不能只相信旧快照的状态标记。
        if (inventory) {
          const managed = await this.managedRoutes();
          for (const zone of inventory.zones) for (const host of zone.hosts) if (hasPendingRoute(host.hostname, zone.id, managed)) {
            host.needsVerification = true; host.actionable = false;
          }
        }
        return json(inventory || { zones: [], syncedAt: null, demo: Boolean(data.demo) });
      }
      if (path === '/refresh') return json(await this.serial(() => this.refresh(Boolean(data.demo))));
      if (path === '/apply') return await this.serial(() => this.apply(data as { targets: Target[]; mode: Mode; username: string; demo: boolean; batchId?: string }));
      if (path === '/audit') return await this.auditPage(data);
      return json({ error: '接口不存在。' }, 404);
    } catch (error) { return json({ error: error instanceof Error ? error.message : '操作失败。' }, error instanceof HttpError ? error.status : 500); }
  }
  async alarm(): Promise<void> {
    for (const prefix of ['session:', 'limit:']) {
      let startAfter: string | undefined;
      while (true) {
        const rows = await this.ctx.storage.list<Session | Limit>({ prefix, limit: 500, ...(startAfter ? { startAfter } : {}) });
        if (!rows.size) break;
        const expired = [...rows].filter(([, value]) => ('expiresAt' in value ? value.expiresAt : value.until) < Date.now()).map(([key]) => key);
        if (expired.length) await this.ctx.storage.delete(expired);
        startAfter = [...rows.keys()].at(-1);
        if (rows.size < 500) break;
      }
    }
    await this.ctx.storage.setAlarm(Date.now() + 60 * 60 * 1000);
  }
}
