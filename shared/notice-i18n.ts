import type { Mode } from './contracts.ts';

export const noticeLanguages = [
  { value: 'zh-Hant', label: '繁體中文' },
  { value: 'ja', label: '日本語' },
  { value: 'en', label: 'English' },
] as const;
export type NoticeLocale = typeof noticeLanguages[number]['value'];
export type NoticeMode = Exclude<Mode, 'normal'>;

export const noticeMessages: Record<NoticeLocale, Record<NoticeMode, { title: string; message: string }>> = {
  'zh-Hant': {
    maintenance: { title: '服務維護中', message: '服務正在維護中，請稍後再試。感謝您的理解與耐心等候。' },
    billing: { title: '服務已欠費', message: '服務已欠費，請及時聯絡管理員續費。' },
  },
  ja: {
    maintenance: { title: 'メンテナンス中', message: '現在、サービスのメンテナンスを行っています。しばらくしてから再度お試しください。ご理解とご協力をお願いいたします。' },
    billing: { title: 'サービス料金が未払いです', message: 'サービス料金が未払いのため、現在ご利用いただけません。管理者に連絡して、サービスの更新を依頼してください。' },
  },
  en: {
    maintenance: { title: 'Service under maintenance', message: 'This service is temporarily unavailable due to maintenance. Please try again later. Thank you for your patience.' },
    billing: { title: 'Service payment overdue', message: 'This service is unavailable because its payment is overdue. Please contact the administrator to renew the service.' },
  },
};

export function isNoticeLocale(value: unknown): value is NoticeLocale {
  return noticeLanguages.some(language => language.value === value);
}
export function localeForCountry(country: unknown): NoticeLocale {
  if (typeof country !== 'string') return 'en';
  switch (country.toUpperCase()) {
    case 'TW': case 'HK': case 'MO': return 'zh-Hant';
    case 'JP': return 'ja';
    default: return 'en';
  }
}

export function localeForTrace(trace: string): NoticeLocale {
  // loc 是访客出口地区，colo 是数据中心；不要把节点所在地误当成访客地区。
  return localeForCountry(/^loc=([A-Z]{2})\r?$/m.exec(trace)?.[1]);
}
