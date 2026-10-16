import type { DnsRecord, Env, Host, Inventory, ManagedRoute, ManagedRoutes, Mode, WorkerDomain, WorkerRoute, Zone, ZoneGroup } from './types.ts';
import { HttpError } from './types.ts';
import { hostInZone, hostMatches, normalizeHost, policyFor } from './utils.ts';

interface ApiResult<T> { success: boolean; result: T; errors?: { message: string }[]; result_info?: { total_pages?: number; total_count?: number; page?: number; per_page?: number } }
export class Cloudflare {
  env: Env;
  fetcher: typeof fetch;
  // Workers 原生 fetch 不能以 Cloudflare 实例作为 this 调用。
  constructor(env: Env, fetcher: typeof fetch = (...args) => fetch(...args)) { this.env = env; this.fetcher = fetcher; }
  async request<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
    if (!this.env.CF_API_TOKEN || !/^[a-f0-9]{32}$/i.test(this.env.CF_ACCOUNT_ID)) throw new HttpError(503, '请先配置 Cloudflare 账号 ID 和 API Token。');
    let response: Response;
    try {
      response = await this.fetcher('https://api.cloudflare.com/client/v4' + path, {
        ...init, headers: { Authorization: 'Bearer ' + this.env.CF_API_TOKEN, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(12000),
      });
    } catch { throw new HttpError(502, 'Cloudflare API 暂时无法连接，请稍后重试。'); }
    let result: ApiResult<T>;
    try { result = await response.json() as ApiResult<T>; } catch { throw new HttpError(502, 'Cloudflare API 返回了无效响应。'); }
    if (!response.ok || !result.success) {
      const detail = (result.errors || []).map(item => item.message).join('；').slice(0, 300);
      throw new HttpError(response.status === 429 ? 429 : 502, 'Cloudflare API 请求失败（' + response.status + '）' + (detail ? '：' + detail : '。'));
    }
    return result;
  }
  async list<T>(path: string, paginated = true): Promise<T[]> {
    if (!paginated) return (await this.request<T[]>(path)).result;
    const all: T[] = [];
    for (let page = 1; ; page++) {
      const separator = path.includes('?') ? '&' : '?';
      const data = await this.request<T[]>(path + separator + 'page=' + page + '&per_page=50');
      if (!Array.isArray(data.result)) throw new HttpError(502, 'Cloudflare 列表响应异常。');
      all.push(...data.result);
      const pages = data.result_info?.total_pages;
      if (pages !== undefined ? page >= pages : data.result.length < 50) break;
      if (page >= 1000) throw new HttpError(502, '域名列表过大，请缩小 API Token 的授权范围。');
    }
    return all;
  }
  zones(): Promise<Zone[]> { return this.list<Zone>('/zones?account.id=' + this.env.CF_ACCOUNT_ID); }
  domains(): Promise<WorkerDomain[]> { return this.list<WorkerDomain>('/accounts/' + this.env.CF_ACCOUNT_ID + '/workers/domains'); }
  dns(zoneId: string): Promise<DnsRecord[]> { return this.list<DnsRecord>('/zones/' + zoneId + '/dns_records'); }
  routes(zoneId: string): Promise<WorkerRoute[]> { return this.list<WorkerRoute>('/zones/' + zoneId + '/workers/routes', false); }
  async attach(zoneId: string, hostname: string, script?: string): Promise<WorkerRoute> {
    return (await this.request<WorkerRoute>('/zones/' + zoneId + '/workers/routes', { method: 'POST', body: JSON.stringify({ pattern: hostname + '/*', ...(script ? { script } : {}) }) })).result;
  }
  async replace(zoneId: string, route: WorkerRoute, script?: string): Promise<WorkerRoute> {
    return (await this.request<WorkerRoute>('/zones/' + zoneId + '/workers/routes/' + encodeURIComponent(route.id), { method: 'PUT', body: JSON.stringify({ pattern: route.pattern, ...(script ? { script } : {}) }) })).result;
  }
  async detach(zoneId: string, id: string): Promise<void> {
    await this.request('/zones/' + zoneId + '/workers/routes/' + encodeURIComponent(id), { method: 'DELETE' });
  }
}

export function routeHost(route: WorkerRoute): string { return normalizeHost(route.pattern.replace(/^https?:\/\//i, '').split('/')[0]); }
export function routeMatchesHost(route: WorkerRoute, host: string): boolean {
  const pattern = routeHost(route);
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp('^' + escaped + '$', 'i').test(host);
}
export function overlaps(route: WorkerRoute, host: string): boolean {
  if (!host.startsWith('*.')) return routeMatchesHost(route, host);
  const candidate = routeHost(route);
  if (candidate.startsWith('*')) {
    const a = candidate.replace(/^\*\.?/, ''); const b = host.slice(2);
    return !a || a === b || hostInZone(a, b) || hostInZone(b, a);
  }
  return hostMatches(host, candidate);
}

export function noticeWorkers(env: Env): { maintenance: string; billing: string } {
  const names = { maintenance: env.MAINTENANCE_WORKER_NAME || env.WORKER_NAME + '-maintenance', billing: env.BILLING_WORKER_NAME || env.WORKER_NAME + '-billing' };
  if (!env.WORKER_NAME || Object.values(names).some(name => !/^[a-zA-Z0-9-]{1,63}$/.test(name)) || new Set([env.WORKER_NAME, ...Object.values(names)]).size !== 3) throw new HttpError(503, '后台、维护页和欠费页必须配置三个不同的 Worker 名称。');
  return names;
}
export function ownsRoute(record: ManagedRoute | undefined, route: WorkerRoute, zoneId: string): boolean {
  return Boolean(record && record.zoneId === zoneId && record.pattern === route.pattern && (record.id ? record.id === route.id : record.pending && (route.script || undefined) === record.pendingScript)
    && ((route.script || undefined) === record.script || record.pending && (route.script || undefined) === record.pendingScript));
}
export function hasPendingRoute(hostname: string, zoneId: string, managed: ManagedRoutes): boolean {
  return Object.values(managed).some(record => record.zoneId === zoneId && record.pending && overlaps({ id: record.id || '', pattern: record.pattern }, hostname));
}
export function inspectRouting(hostname: string, zoneId: string, routes: WorkerRoute[], env: Env, managed: ManagedRoutes, policies: Record<string, Mode>): { connected: boolean; conflict: boolean; mode: Mode; needsVerification: boolean } {
  const names = noticeWorkers(env);
  const owned = (route: WorkerRoute) => ownsRoute(managed[routeHost(route)], route, zoneId)
    // 旧版本保存过精确主机状态的后台 Route，可由管理操作迁移或移除。
    || route.script === env.WORKER_NAME && route.pattern === routeHost(route) + '/*' && Object.hasOwn(policies, routeHost(route));
  const touching = routes.filter(route => overlaps(route, hostname));
  const conflict = touching.some(route => !owned(route));
  const matching = touching.filter(route => owned(route) && route.pattern === routeHost(route) + '/*' && routeMatchesHost(route, hostname)).sort((a, b) => routeHost(b).length - routeHost(a).length);
  const winner = matching[0];
  const mode: Mode = winner?.script === names.maintenance ? 'maintenance' : winner?.script === names.billing ? 'billing' : winner?.script === env.WORKER_NAME ? policyFor(policies, hostname) : 'normal';
  const needsVerification = hasPendingRoute(hostname, zoneId, managed);
  return { connected: Boolean(winner?.script), conflict, mode, needsVerification };
}
export function mergeHosts(zone: Zone, records: DnsRecord[], domains: WorkerDomain[], routes: WorkerRoute[], env: Env, policies: Record<string, Mode>, managed: ManagedRoutes = {}): Host[] {
  const hosts = new Map<string, Host>();
  for (const record of records) {
    if (!['A', 'AAAA', 'CNAME'].includes(record.type)) continue;
    const hostname = normalizeHost(record.name);
    if (!hostInZone(hostname, zone.name)) continue;
    const previous = hosts.get(hostname);
    hosts.set(hostname, {
      hostname, zoneId: zone.id, type: record.proxied || previous?.type === 'proxy' ? 'proxy' : 'dns',
      service: '', records: [...new Set([...(previous?.records || []), record.type])],
      dnsRecords: [...(previous?.dnsRecords || []), ...(record.content ? [{ type: record.type, content: record.content }] : [])].filter((value, index, all) => all.findIndex(item => item.type === value.type && item.content === value.content) === index),
      mode: policyFor(policies, hostname), connected: false, actionable: false, reason: '',
    });
  }
  for (const domain of domains.filter(item => item.zone_id === zone.id)) {
    const hostname = normalizeHost(domain.hostname);
    hosts.set(hostname, { hostname, zoneId: zone.id, type: 'worker', service: domain.service, records: hosts.get(hostname)?.records || [], dnsRecords: hosts.get(hostname)?.dnsRecords || [], mode: policyFor(policies, hostname), connected: false, actionable: false, reason: domain.enabled === false ? 'Worker 自定义域名尚未启用' : '' });
  }
  // 服务 DNS 或 Custom Domain 已移除时，仍列出本系统残留入口以便安全恢复。
  for (const [hostname, route] of Object.entries(managed)) {
    if (route.zoneId === zone.id && !hosts.has(hostname)) hosts.set(hostname, { hostname, zoneId: zone.id, type: 'dns', service: '', records: [], mode: 'normal', connected: false, actionable: false, reason: '原服务入口已移除，仅可移除提示路由' });
  }
  for (const host of hosts.values()) {
    const routing = inspectRouting(host.hostname, zone.id, routes, env, managed, policies);
    host.connected = routing.connected;
    host.mode = routing.mode;
    host.needsVerification = routing.needsVerification;
    if (hostMatches(host.hostname, normalizeHost(env.CONTROL_HOST)) || [env.WORKER_NAME, ...Object.values(noticeWorkers(env))].includes(host.service)) host.reason = '管理后台或提示页入口，已保护';
    else if (host.type === 'dns') host.reason ||= '仅 DNS，未开启 Cloudflare 代理';
    else if (zone.status !== 'active') host.reason = '域尚未在 Cloudflare 激活';
    else if (routing.conflict) host.reason = '存在其他 Worker 或绕过规则，需要先处理路由冲突';
    host.actionable = !host.reason && !host.needsVerification;
  }
  return [...hosts.values()].sort((a, b) => a.hostname.localeCompare(b.hostname));
}

export interface AccountInventory { zones: Zone[]; domains: WorkerDomain[] }
export async function loadAccountInventory(api: Cloudflare): Promise<AccountInventory> {
  const [zones, domains] = await Promise.all([api.zones(), api.domains()]);
  return { zones, domains };
}
export async function loadInventory(api: Cloudflare, env: Env, policies: Record<string, Mode>, onlyZones?: string[], managed: ManagedRoutes = {}, account?: AccountInventory, routesByZone?: Map<string, WorkerRoute[]>): Promise<Inventory> {
  const { zones: allZones, domains } = account ?? await loadAccountInventory(api);
  const zones = allZones.filter(zone => !onlyZones || onlyZones.includes(zone.id)).sort((a, b) => a.name.localeCompare(b.name));
  const groups: ZoneGroup[] = [];
  // 限制并发，避免账号包含多个域时瞬间打满 Cloudflare API。
  for (let offset = 0; offset < zones.length; offset += 4) {
    const batch = await Promise.all(zones.slice(offset, offset + 4).map(async zone => {
      try {
        const [dns, routes] = await Promise.all([api.dns(zone.id), api.routes(zone.id)]);
        routesByZone?.set(zone.id, routes);
        return { ...zone, hosts: mergeHosts(zone, dns, domains, routes, env, policies, managed) };
      } catch (error) { return { ...zone, hosts: [], error: error instanceof Error ? error.message : '域名读取失败' }; }
    }));
    groups.push(...batch);
  }
  return { zones: groups, syncedAt: new Date().toISOString(), demo: false };
}
