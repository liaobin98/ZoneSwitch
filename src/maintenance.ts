import { escapeHtml } from './utils.ts';
import { localeForCountry, noticeMessages } from '../shared/notice-i18n.ts';
import type { NoticeLocale, NoticeMode } from '../shared/notice-i18n.ts';
import { NOTICE_ASSET_PREFIX } from '../shared/notice-assets.ts';
import { noticeIcon } from './notice-icons.ts';

export const noticeHeaders = {
  'Cache-Control': 'no-store, max-age=0', 'X-Robots-Tag': 'noindex, nofollow',
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",
};

// 静态构建与后台预览共用同一份模板；正式访客页面默认英文，由浏览器识别地区。
export function noticeMarkup(mode: NoticeMode, locale: NoticeLocale = 'en', host = '', autoLocale = true): string {
  const notice = noticeMessages[locale][mode];
  const hostname = escapeHtml(host);
  const accent = mode === 'billing' ? '#b45309' : '#2563eb';
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${notice.title}</title><link rel="stylesheet" href="${NOTICE_ASSET_PREFIX}controls.css"><script type="module" src="${NOTICE_ASSET_PREFIX}controls.js"></script><style>
  *{box-sizing:border-box}body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#f4f6f9;color:#192332;font-family:system-ui,-apple-system,"Segoe UI","Noto Sans TC","Noto Sans JP","Yu Gothic","Microsoft JhengHei",sans-serif;padding:24px}.notice{width:100%;max-width:510px;background:white;border:1px solid #e2e7ee;border-radius:16px;padding:48px 38px;text-align:center;box-shadow:0 12px 40px #1a2c4210}.mark{display:grid;place-items:center;width:60px;height:60px;border-radius:18px;background:${mode === 'billing' ? '#ffedd5' : '#eff6ff'};color:${accent};margin:0 auto 26px;font-size:30px;font-weight:500}h1{font-size:27px;line-height:1.45;overflow-wrap:anywhere;text-wrap:balance;margin:0 0 18px}p{font-size:15px;line-height:1.9;color:#596579;margin:0;text-wrap:pretty}.host{font-size:12px;padding-top:30px;margin-top:32px;border-top:1px solid #edf0f5;color:#687488;overflow-wrap:anywhere}@media(max-width:500px){.notice{padding:36px 24px}h1{font-size:24px}}
  </style></head><body><main class="notice"><div class="mark" aria-hidden="true">${noticeIcon(mode)}</div><h1 id="notice-title">${notice.title}</h1><p id="notice-message" aria-live="polite" aria-atomic="true">${notice.message}</p><div id="notice-languages" data-mode="${mode}" data-locale="${locale}" data-auto-locale="${autoLocale}"></div><div class="host" id="notice-host">${hostname}</div></main></body></html>`;
}

export function maintenanceResponse(request: Request, mode: NoticeMode, previewLocale?: NoticeLocale): Response {
  const locale = previewLocale ?? localeForCountry(request.cf?.country);
  return new Response(request.method === 'HEAD' ? null : noticeMarkup(mode, locale, new URL(request.url).hostname, false), {
    status: 200, headers: { ...noticeHeaders, 'Content-Type': 'text/html; charset=utf-8', 'Content-Language': locale },
  });
}
