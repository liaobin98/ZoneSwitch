import { useConsoleI18n } from '../i18n.tsx';
import { useState } from 'react';
import { Button, Card } from '@radix-ui/themes';
import { ArrowUpRight, ReceiptText, Wrench } from 'lucide-react';
import { isNoticeLocale, noticeLanguages, noticeMessages } from '../../../shared/notice-i18n.ts';
import { SelectControl } from './SelectControl.tsx';

export function NoticePreviews() {
  const { t } = useConsoleI18n();
  const [language, setLanguage] = useState('auto');
  const locale = isNoticeLocale(language) ? language : null;
  return <section className="mt-5" aria-label={t("访客提示预览")}>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-base font-semibold text-slate-800">{t("访客提示预览")}</h2><p className="mt-1 text-xs leading-6 text-slate-500">{t("台湾、香港、澳门显示繁体中文，日本显示日文，其他地区显示英文。")}</p></div>
      <SelectControl label={t("提示预览语言")} value={language} onChange={setLanguage} options={[{ value: 'auto', label: '按访问地区' }, ...noticeLanguages]} />
    </div>
    <div className="grid gap-3 lg:grid-cols-2">
      {(['maintenance', 'billing'] as const).map(mode => {
        const Icon = mode === 'maintenance' ? Wrench : ReceiptText;
        const notice = locale ? noticeMessages[locale][mode] : {
          title: mode === 'maintenance' ? '服务维护中' : '服务已欠费',
          message: mode === 'maintenance' ? '维护期间向访客展示友好提示。' : '提示访客联系管理员续费。',
        };
        return <Card key={mode} className="notice-card">
          <div className="flex items-center gap-3"><span className={'notice-icon notice-' + mode}><Icon size={18} aria-hidden /></span>
            <div className="min-w-0"><h3 className="text-sm font-medium leading-6 text-slate-700" lang={locale ?? undefined}>{locale ? notice.title : t(notice.title)}</h3><p className="mt-1 text-xs leading-6 text-slate-500" lang={locale ?? undefined}>{locale ? notice.message : t(notice.message)}</p></div>
            <Button asChild size="1" variant="ghost" className="ml-auto shrink-0"><a href={'/api/preview?mode=' + mode + (locale ? '&lang=' + locale : '')} target="_blank" rel="noopener" aria-label={t(mode === 'maintenance' ? '预览维护提示' : '预览欠费提示')}>{t("预览")}<ArrowUpRight size={13} aria-hidden /></a></Button>
          </div>
        </Card>;
      })}
    </div>
  </section>;
}
