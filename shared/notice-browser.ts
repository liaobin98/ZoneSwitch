import { noticeGroupLabels, noticeMessages } from './notice-i18n.ts';
import type { NoticeMode } from './notice-i18n.ts';

// 同步内联在 head；不依赖网络、浏览器存储或外部脚本，首次绘制前选好语言。
export function noticeLocaleScript(mode: NoticeMode): string {
  const titles = Object.fromEntries(Object.entries(noticeMessages).map(([locale, messages]) => [locale, messages[mode].title]));
  return `(()=>{let locale='en';try{const preferences=navigator.languages?.length?navigator.languages:[navigator.language];for(const value of preferences){const language=String(value).toLowerCase().replaceAll('_','-');if(/^zh-(hant(?:-|$)|tw(?:-|$)|hk(?:-|$)|mo(?:-|$))/.test(language)){locale='zh-Hant';break}if(/^ja(?:-|$)/.test(language)){locale='ja';break}if(/^en(?:-|$)/.test(language)){break}}}catch{}document.documentElement.lang=locale;document.title=${JSON.stringify(titles)}[locale]})();`;
}

// 位于正文末尾，同步补齐域名和无障碍状态；文案显示由 head 的语言和 CSS 决定。
export const noticeReadyScript = `(()=>{const locale=document.documentElement.lang;const container=document.getElementById('notice-languages');container.dataset.locale=locale;container.querySelector('[role="group"]').setAttribute('aria-label',${JSON.stringify(noticeGroupLabels)}[locale]);for(const button of container.querySelectorAll('button[data-locale]')){const selected=button.dataset.locale===locale;button.setAttribute('aria-pressed',String(selected));button.dataset.state=selected?'on':'off';button.tabIndex=selected?0:-1}document.getElementById('notice-host').textContent=location.hostname})();`;
