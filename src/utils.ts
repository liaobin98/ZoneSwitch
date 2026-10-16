import { HttpError } from './types.ts';
import type { Mode } from './types.ts';

export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
}
export function normalizeHost(host: string): string { return host.toLowerCase().replace(/\.$/, ''); }
export function hostMatches(pattern: string, host: string): boolean {
  return pattern.startsWith('*.') ? host.endsWith(pattern.slice(1)) && host !== pattern.slice(2) : pattern === host;
}
export function hostInZone(host: string, zone: string): boolean {
  return host === zone || host.endsWith('.' + zone);
}
export function isHostname(host: string): boolean {
  const value = host.startsWith('*.') ? host.slice(2) : host;
  return value.length <= 253 && value.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) && value.includes('.');
}
export function policyFor(policies: Record<string, Mode>, host: string): Mode {
  if (policies[host]) return policies[host];
  const matches = Object.keys(policies).filter(key => hostMatches(key, host)).sort((a, b) => b.length - a.length);
  return policies[matches[0]] || 'normal';
}
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}
export async function body<T>(request: Request): Promise<T> {
  if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) throw new HttpError(415, '请使用 JSON 请求。');
  if (Number(request.headers.get('Content-Length')) > 32768) throw new HttpError(413, '请求内容过大。');
  const text = await request.text();
  if (text.length > 32768) throw new HttpError(413, '请求内容过大。');
  try { const result = JSON.parse(text); if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error(); return result; }
  catch { throw new HttpError(400, '请求内容不是有效的 JSON 对象。'); }
}
export async function sha256(value: string): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
export function randomToken(): string { return [...crypto.getRandomValues(new Uint8Array(32))].map(byte => byte.toString(16).padStart(2, '0')).join(''); }
export function equal(a: string, b: string): boolean {
  let difference = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) difference |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return difference === 0;
}
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, iterationsText, salt, digest] = (encoded || '').split('$');
  const iterations = Number(iterationsText);
  if (algorithm !== 'pbkdf2-sha256' || !Number.isInteger(iterations) || iterations < 100000 || iterations > 1000000 || !/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{64}$/.test(digest || '')) throw new HttpError(503, '管理员密码尚未正确配置。');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const saltBytes = new Uint8Array(salt.match(/../g)!.map(hex => parseInt(hex, 16)));
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations }, key, 256);
  const computed = [...new Uint8Array(bits)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return equal(computed, digest);
}
