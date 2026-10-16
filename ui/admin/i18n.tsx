import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { DropdownMenu, IconButton, Tooltip } from '@radix-ui/themes';
import { Languages } from 'lucide-react';
import { translateConsole } from '../../shared/console-i18n.ts';
import type { ConsoleLocale } from '../../shared/console-i18n.ts';

const storageKey = 'zoneswitch-console-language';
interface ConsoleI18n {
  locale: ConsoleLocale;
  setLocale: (locale: ConsoleLocale) => void;
  t: (text: string, values?: Record<string, string | number>) => string;
}
const Context = createContext<ConsoleI18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<ConsoleLocale>(() => {
    try { return localStorage.getItem(storageKey) === 'en' ? 'en' : 'zh-CN'; } catch { return 'zh-CN'; }
  });
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = locale === 'en' ? 'ZoneSwitch · Service console' : 'ZoneSwitch · 服务控制台';
    try { localStorage.setItem(storageKey, locale); } catch { /* 禁用本地存储时仍可在当前页面切换。 */ }
  }, [locale]);
  const value = useMemo(() => ({ locale, setLocale, t: (text: string, values?: Record<string, string | number>) => translateConsole(locale, text, values) }), [locale]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useConsoleI18n() {
  const value = useContext(Context);
  if (!value) throw new Error('Missing console language provider');
  return value;
}

export function LanguageSwitch() {
  const { locale, setLocale, t } = useConsoleI18n();
  return <DropdownMenu.Root>
    <Tooltip content={t('切换语言')}><DropdownMenu.Trigger>
      <IconButton variant="ghost" color="gray" aria-label={t('切换语言')}><Languages size={16} aria-hidden /></IconButton>
    </DropdownMenu.Trigger></Tooltip>
    <DropdownMenu.Content align="end">
      <DropdownMenu.RadioGroup value={locale} onValueChange={value => { if (value === 'en' || value === 'zh-CN') setLocale(value); }}>
        <DropdownMenu.RadioItem value="zh-CN"><span lang="zh-CN">简体中文</span></DropdownMenu.RadioItem>
        <DropdownMenu.RadioItem value="en"><span lang="en">English</span></DropdownMenu.RadioItem>
      </DropdownMenu.RadioGroup>
    </DropdownMenu.Content>
  </DropdownMenu.Root>;
}
