export interface Session { username: string; csrf: string; expiresAt: number; demo?: boolean }
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export async function api<T>(path: string, csrf = '', data?: unknown): Promise<T> {
  const response = await fetch('/api/' + path, {
    method: data === undefined ? 'GET' : 'POST', credentials: 'same-origin',
    headers: data === undefined ? {} : { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  let result: T & { error?: string };
  try { result = await response.json(); } catch { throw new ApiError(response.status, '服务器响应异常，请稍后重试。'); }
  if (!response.ok) throw new ApiError(response.status, result.error || '请求失败。');
  return result;
}
