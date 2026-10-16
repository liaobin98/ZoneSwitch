import { Avatar, Badge, Button, IconButton, ScrollArea, Separator } from '@radix-ui/themes';
import { Cloud, Globe2, History, LogOut } from 'lucide-react';
import { LanguageSwitch, useConsoleI18n } from '../i18n.tsx';
import type { ConsoleController } from '../hooks/useConsole.ts';
import { Brand } from './Brand.tsx';

export function Sidebar({ controller }: { controller: ConsoleController }) {
  const { t } = useConsoleI18n();
  const { session, inventory, view, setView, activeZone, setActiveZone, busy, logout, logoutError } = controller;
  if (!session) return null;
  return <aside className="sidebar" aria-label={t("域导航")}>
        <div className="sidebar-brand"><Brand /></div>
        <p className="workspace-label"><Cloud size={16} aria-hidden />{t("Cloudflare 工作空间")}</p>
        <div className="sidebar-navigation">
          <p className="sidebar-section-title">{t("域名管理")}</p>
          <Button variant={view === 'domains' && activeZone === 'all' ? 'soft' : 'ghost'} color={view === 'domains' && activeZone === 'all' ? 'blue' : 'gray'} className="nav-button" onClick={() => { setView('domains'); setActiveZone('all'); }} aria-pressed={view === 'domains' && activeZone === 'all'}>
            <Globe2 size={16} aria-hidden />{t("所有域")}<Badge variant="soft" size="1" className="nav-count">{inventory.zones.length}</Badge>
          </Button>
          <ScrollArea scrollbars="vertical" className="zone-navigation">
            <div className="space-y-1 pt-2">
              {inventory.zones.map(zone => <Button key={zone.id} variant={view === 'domains' && activeZone === zone.id ? 'soft' : 'ghost'} color={view === 'domains' && activeZone === zone.id ? 'blue' : 'gray'} className="nav-button" onClick={() => { setView('domains'); setActiveZone(zone.id); }} aria-pressed={view === 'domains' && activeZone === zone.id}>
                <Globe2 size={16} aria-hidden /><span className="min-w-0 truncate">{zone.name}</span><span className="nav-count">{zone.hosts.length}</span>
              </Button>)}
            </div>
          </ScrollArea>
        </div>
        <div className="sidebar-account">
          <Button variant={view === 'audit' ? 'soft' : 'ghost'} color={view === 'audit' ? 'blue' : 'gray'} className="audit-nav" aria-label={t("操作记录")} aria-pressed={view === 'audit'} disabled={busy} onClick={() => setView('audit')}><History size={16} aria-hidden /><span>{t("操作记录")}</span></Button>
          <Separator size="4" className="account-separator" />
          {logoutError && <p className="mb-3 text-sm leading-6 text-red-700" role="alert">{t(logoutError)}</p>}
          <div className="account-row">
            <Avatar fallback={session.username.slice(0, 1).toUpperCase()} size="2" radius="full" color="gray" />
            <div className="account-text"><strong>{session.username}</strong><p>{t("管理员")}</p></div>
            <LanguageSwitch />
            <IconButton variant="ghost" color="gray" aria-label={t("退出登录")} disabled={busy} onClick={() => void logout()}><LogOut size={16} /></IconButton>
          </div>
        </div>
      </aside>;
}
