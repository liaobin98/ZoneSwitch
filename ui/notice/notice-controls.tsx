import { isNoticeLocale, noticeGroupLabels, noticeMessages } from '../../shared/notice-i18n.ts';
import type { NoticeLocale, NoticeMode } from '../../shared/notice-i18n.ts';
import './notice-controls.css';

const container = document.getElementById('notice-languages');
if (container && isNoticeLocale(container.dataset.locale)) {
  const mode = container.dataset.mode;
  if (mode === 'maintenance' || mode === 'billing') enableLanguageControls(container, mode);
}

function enableLanguageControls(container: HTMLElement, mode: NoticeMode) {
  const buttons = [...container.querySelectorAll<HTMLButtonElement>('button[data-locale]')];
  const group = container.querySelector('[role="group"]');
  function displayLanguage(locale: NoticeLocale) {
    const notice = noticeMessages[locale][mode];
    document.documentElement.lang = locale;
    document.title = notice.title;
    const title = document.getElementById('notice-title');
    const message = document.getElementById('notice-message');
    if (title) title.textContent = notice.title;
    if (message) message.textContent = notice.message;
    container.dataset.locale = locale;
    group?.setAttribute('aria-label', noticeGroupLabels[locale]);
    for (const button of buttons) {
      const selected = button.dataset.locale === locale;
      button.setAttribute('aria-pressed', String(selected));
      button.dataset.state = selected ? 'on' : 'off';
      button.tabIndex = selected ? 0 : -1;
    }
  }
  // 首屏已同步选好语言；外部脚本只处理访客主动切换，不进行异步定位。
  for (const [index, button] of buttons.entries()) {
    button.addEventListener('click', () => {
      if (isNoticeLocale(button.dataset.locale)) displayLanguage(button.dataset.locale);
    });
    button.addEventListener('keydown', event => {
      let next: number;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % buttons.length;
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index + buttons.length - 1) % buttons.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = buttons.length - 1;
      else return;
      event.preventDefault();
      buttons[next].focus();
      buttons[next].click();
    });
  }
}
