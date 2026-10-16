import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { isNoticeLocale, localeForTrace, noticeLanguages, noticeMessages } from '../../shared/notice-i18n.ts';
import type { NoticeLocale, NoticeMode } from '../../shared/notice-i18n.ts';
import './notice-controls.css';

const groupLabels: Record<NoticeLocale, string> = { 'zh-Hant': '切換語言', ja: '言語を切り替える', en: 'Switch language' };

function NoticeLanguages({ mode, initialLocale, autoLocale }: { mode: NoticeMode; initialLocale: NoticeLocale; autoLocale: boolean }) {
  const [locale, setLocale] = useState(initialLocale);
  const manual = useRef(false);
  function displayLanguage(value: string) {
    // 单选按钮再次点击时不清空选择；文字使用共享翻译，保留原请求与维护状态。
    if (!isNoticeLocale(value)) return;
    const notice = noticeMessages[value][mode];
    document.documentElement.lang = value;
    document.title = notice.title;
    const title = document.getElementById('notice-title');
    const message = document.getElementById('notice-message');
    if (title) title.textContent = notice.title;
    if (message) message.textContent = notice.message;
    setLocale(value);
  }
  useEffect(() => {
    const host = document.getElementById('notice-host');
    if (host) host.textContent = window.location.hostname;
    if (!autoLocale) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 2000);
    // Cloudflare 自带的诊断端点，不调用管理后台、DO 或第三方定位服务。
    void fetch('/cdn-cgi/trace', { cache: 'no-store', credentials: 'omit', signal: controller.signal })
      .then(async response => {
        if (!response.ok || !response.headers.get('Content-Type')?.includes('text/plain')) return;
        const language = localeForTrace(await response.text());
        if (!manual.current && !controller.signal.aborted) displayLanguage(language);
      }).catch(() => { /* 无法识别地区时保留英文。 */ }).finally(() => window.clearTimeout(timer));
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [autoLocale, mode]);
  function changeLanguage(value: string) {
    if (!isNoticeLocale(value)) return;
    manual.current = true;
    displayLanguage(value);
  }
  return <ToggleGroup.Root type="single" value={locale} onValueChange={changeLanguage} orientation="horizontal" aria-label={groupLabels[locale]} className="notice-language-group" data-mode={mode}>
    {noticeLanguages.map(language => <ToggleGroup.Item key={language.value} value={language.value} lang={language.value} className="notice-language-button">{language.label}</ToggleGroup.Item>)}
  </ToggleGroup.Root>;
}

const container = document.getElementById('notice-languages');
if (container && isNoticeLocale(container.dataset.locale)) {
  const mode = container.dataset.mode;
  if (mode === 'maintenance' || mode === 'billing') createRoot(container).render(<NoticeLanguages mode={mode} initialLocale={container.dataset.locale} autoLocale={container.dataset.autoLocale === 'true'} />);
}
