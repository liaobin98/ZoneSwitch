import type { Env } from './types.ts';
import { HttpError } from './types.ts';
import { body, equal, json, normalizeHost } from './utils.ts';
import { maintenanceResponse } from './maintenance.ts';
import { isNoticeLocale, localeForCountry } from '../shared/notice-i18n.ts';
import { isNoticeAsset } from '../shared/notice-assets.ts';
export { ZoneSwitchState } from './state.ts';

function state(env: Env, path: string, data: unknown = {}): Promise<Response> {
  return env.STATE.get(env.STATE.idFromName('zone-switch')).fetch('https://internal' + path, { method: 'POST', body: JSON.stringify(data) });
}
function token(request: Request): string {
  return /(?:^|;\s*)zone_switch_session=([a-f0-9]{64})(?:;|$)/.exec(request.headers.get('Cookie') || '')?.[1] || '';
}
function local(request: Request): boolean { return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname); }
function demo(request: Request, env: Env): boolean { return local(request) && env.DEMO_MODE === 'true'; }
function cookie(request: Request, value: string, maxAge: number): string {
  return 'zone_switch_session=' + value + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' + maxAge + (local(request) ? '' : '; Secure');
}
function secure(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Frame-Options', 'DENY');
  // Radix 的浮层定位通过行内样式设置，脚本仍仅允许同源构建资源。
  headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  return new Response(response.body, { status: response.status, headers });
}
async function control(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (!local(request) && url.protocol !== 'https:') throw new HttpError(400, '管理后台必须通过 HTTPS 访问。');
  if (url.pathname.startsWith('/api/')) {
    const write = request.method !== 'GET';
    if (write && request.method !== 'POST') throw new HttpError(405, '请求方法不支持。');
    if (write && request.headers.get('Origin') !== url.origin) throw new HttpError(403, '请求来源不正确。');
    if (url.pathname === '/api/login' && request.method === 'POST') {
      const input = await body<{ username: string; password: string }>(request);
      const response = await state(env, '/login', { username: input.username, password: input.password, ip: request.headers.get('CF-Connecting-IP') || 'local' });
      const result = await response.json() as { token?: string; username?: string; csrf?: string; expiresAt?: number; maxAge?: number; error?: string };
      if (!response.ok) return json({ error: result.error }, response.status);
      return json({ username: result.username, csrf: result.csrf, expiresAt: result.expiresAt }, 200, { 'Set-Cookie': cookie(request, result.token!, result.maxAge!) });
    }
    const sessionResponse = await state(env, '/session', { token: token(request) });
    if (!sessionResponse.ok) {
      if (sessionResponse.status === 401) return json({ error: '登录已过期，请重新登录。' }, 401);
      throw new HttpError(503, '检查登录状态失败，请稍后重试。');
    }
    const session = await sessionResponse.json() as { username: string; csrf: string; expiresAt: number };
    if (write && !equal(request.headers.get('X-CSRF-Token') || '', session.csrf)) throw new HttpError(403, '操作校验失败，请刷新页面后重试。');
    if (url.pathname === '/api/session' && request.method === 'GET') return json({ ...session, demo: demo(request, env) });
    if (url.pathname === '/api/logout' && request.method === 'POST') {
      await body(request);
      const revoked = await state(env, '/logout', { token: token(request) });
      // 会话撤销失败时保留当前登录，允许用户重试，不返回虚假的退出成功。
      if (!revoked.ok) throw new HttpError(503, '退出登录未完成，请重试。');
      const result = await revoked.json().catch(() => ({})) as { success?: boolean };
      if (result.success !== true) throw new HttpError(503, '退出登录未完成，请重试。');
      return json({ success: true }, 200, { 'Set-Cookie': cookie(request, '', 0) });
    }
    if (url.pathname === '/api/inventory' && request.method === 'GET') return state(env, '/inventory', { demo: demo(request, env) });
    if (url.pathname === '/api/refresh' && request.method === 'POST') { await body(request); return state(env, '/refresh', { demo: demo(request, env) }); }
    if (url.pathname === '/api/modes' && request.method === 'POST') { const input = await body<{ targets: unknown; mode: unknown; batchId?: unknown }>(request); return state(env, '/apply', { targets: input.targets, mode: input.mode, batchId: input.batchId, username: session.username, demo: demo(request, env) }); }
    if (url.pathname === '/api/audit' && request.method === 'GET') return state(env, '/audit', { page: url.searchParams.get('page') ?? undefined, pageSize: url.searchParams.get('pageSize') ?? undefined });
    if (url.pathname === '/api/preview' && request.method === 'GET') {
      const mode = url.searchParams.get('mode');
      if (mode !== 'maintenance' && mode !== 'billing') throw new HttpError(400, '提示类型不正确。');
      const lang = url.searchParams.get('lang');
      if (lang !== null && !isNoticeLocale(lang)) throw new HttpError(400, '预览语言不支持。');
      const preview = new Request(request, { headers: { Accept: 'text/html' } });
      return maintenanceResponse(preview, mode, lang ?? localeForCountry(request.cf?.country));
    }
    return json({ error: '接口不存在。' }, 404);
  }
  if (!['GET', 'HEAD'].includes(request.method)) throw new HttpError(405, '请求方法不支持。');
  if (!['/', '/index.html', '/favicon.svg'].includes(url.pathname) && !url.pathname.startsWith('/assets/')) return json({ error: '页面不存在。' }, 404);
  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const hostname = normalizeHost(url.hostname);
    // 后台不承担业务转发或访客状态查询；业务域名仅接入独立的纯静态 Worker。
    if (hostname !== normalizeHost(env.CONTROL_HOST || '')) return secure(json({ error: '页面不存在。' }, 404));
    if (isNoticeAsset(url.pathname)) {
      if (!['GET', 'HEAD'].includes(request.method)) return secure(json({ error: '请求方法不支持。' }, 405));
      try { return secure(await env.ASSETS.fetch(request)); }
      catch { return secure(json({ error: '页面资源暂时不可用。' }, 503)); }
    }
    try {
      const response = await control(request, env);
      return url.pathname === '/api/preview' && response.ok ? response : secure(response);
    } catch (error) { return secure(json({ error: error instanceof HttpError ? error.message : '后台暂时不可用，请稍后重试。' }, error instanceof HttpError ? error.status : 500)); }
  },
};
