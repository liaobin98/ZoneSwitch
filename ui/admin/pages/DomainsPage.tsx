import { Button, Card, Checkbox, TextField } from '@radix-ui/themes';
import { CircleCheck, CircleDollarSign, Globe2, RefreshCw, Search, ShieldCheck, Wrench } from 'lucide-react';
import { useConsoleI18n } from '../i18n.tsx';
import type { ConsoleController } from '../hooks/useConsole.ts';
import { actionLabels, canChangeMode, colors, hostKey, labels, modes } from '../model/services.ts';
import { DomainGroup } from '../components/DomainGroup.tsx';
import { NoticePreviews } from '../components/NoticePreviews.tsx';
import { SelectControl } from '../components/SelectControl.tsx';

export function DomainsPage({ controller, compact }: { controller: ConsoleController; compact: boolean }) {
  const { t, locale } = useConsoleI18n();
  const { inventory, selected, setSelected, activeZone, setActiveZone, search, setSearch, typeFilter, setTypeFilter,
    modeFilter, setModeFilter, busy, allHosts, serviceHosts, groups, visible, selectableVisible, selectionState,
    selectHost, selectHosts, openChange, sync } = controller;
  const selectedHosts = allHosts.filter(host => selected.has(hostKey(host)));
  return <>
        <header className="page-header"><div className="min-w-0"><p className="eyebrow">WORKSPACE / DOMAINS</p><h1 className="page-title">{t("服务控制台")}</h1><p className="page-description">{t("查看域名入口，统一切换服务状态。")}</p></div><Button variant="outline" color="gray" disabled={busy} onClick={() => void sync()}><RefreshCw size={15} className={busy ? 'animate-spin' : ''} aria-hidden />{t("同步域名")}</Button></header>
        {compact && <div className="mb-5"><SelectControl label={t("选择域")} value={activeZone} onChange={setActiveZone} options={[{ value: 'all', label: t('所有域 ({count})', { count: inventory.zones.length }) }, ...inventory.zones.map(zone => ({ value: zone.id, label: `${zone.name} (${zone.hosts.length})` }))]} /></div>}
        <section className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label={t("服务状态概览")}>
          <Card className="stat-card"><p className="stat-label"><Globe2 size={14} aria-hidden />{t("服务域名")}</p><strong className="stat-value">{serviceHosts.length}</strong><p className="stat-detail">{t("Worker 与代理服务入口")}{serviceHosts.some(host => host.needsVerification) && <span className="block text-amber-800">{t("待核实 {count} 个", { count: serviceHosts.filter(host => host.needsVerification).length })}</span>}</p></Card>
          {modes.map(mode => { const Icon = mode === 'normal' ? CircleCheck : mode === 'maintenance' ? Wrench : CircleDollarSign; return <Card key={mode} className="stat-card"><p className={'stat-label stat-' + mode}><Icon size={14} aria-hidden />{t(labels[mode])}</p><strong className="stat-value">{serviceHosts.filter(host => !host.needsVerification && host.mode === mode).length}</strong><p className="stat-detail">{t(mode === 'normal' ? '正常转发业务请求' : mode === 'maintenance' ? '展示服务维护提示' : '展示联系管理员续费提示')}</p></Card>; })}
        </section>
        <section className="domains-panel" aria-labelledby="domains-title">
          <div className="panel-toolbar"><div><h2 id="domains-title" className="text-base font-semibold text-slate-800">{activeZone === 'all' ? t('所有域名') : inventory.zones.find(zone => zone.id === activeZone)?.name}</h2><p className="mt-1 text-xs text-slate-500">{inventory.syncedAt ? t('最近同步 ') + new Date(inventory.syncedAt).toLocaleString(locale, { hour12: false }) : t('尚未同步')}</p></div>
            <div className="domain-filters"><TextField.Root type="search" aria-label={t("搜索域名或 Worker")} placeholder={t("搜索域名或 Worker…")} value={search} onChange={event => setSearch(event.target.value)} className="search-field"><TextField.Slot><Search size={14} /></TextField.Slot></TextField.Root><SelectControl label={t("服务类型")} value={typeFilter} onChange={setTypeFilter} options={[{ value: 'all', label: '全部类型' }, { value: 'worker', label: 'Worker' }, { value: 'proxy', label: '服务器代理' }, { value: 'dns', label: '仅 DNS' }]} /><SelectControl label={t("服务状态")} value={modeFilter} onChange={setModeFilter} options={[{ value: 'all', label: '全部状态' }, { value: 'verification', label: '待核实' }, ...modes.map(mode => ({ value: mode, label: labels[mode] }))]} /></div>
          </div>
          <div className="batch-toolbar"><span className="flex items-center gap-2 text-xs text-slate-600"><Checkbox id="select-all" aria-label={t("选择当前列表")} checked={selectionState} disabled={busy || !selectableVisible.length} onCheckedChange={checked => selectHosts(selectableVisible, checked === true)} /><label htmlFor="select-all">{t("选择当前列表")}</label></span><span className="text-xs text-slate-500">{t('已选择 {count} 个', { count: selected.size })}</span><div className="batch-actions">{modes.map(mode => { const Icon = mode === 'normal' ? CircleCheck : mode === 'maintenance' ? Wrench : CircleDollarSign; return <Button key={mode} size="1" color={colors[mode]} variant="outline" className="mode-action" disabled={busy || !selectedHosts.some(host => canChangeMode(host, mode))} onClick={event => openChange(selectedHosts, mode, event.currentTarget)}><Icon size={13} aria-hidden />{t(actionLabels[mode])}</Button>; })}<Button variant="outline" size="1" color="gray" className="mode-action" disabled={busy || !selected.size} onClick={() => setSelected(new Set())}>{t("清空")}</Button></div></div>
          <div aria-busy={busy} className={busy ? 'opacity-70' : ''}><div className="zone-list">{groups.map(({ zone, hosts }, index) => <DomainGroup key={zone.id} zone={zone} hosts={hosts} defaultOpen={index === 0} compact={compact} busy={busy} selected={selected} onSelect={selectHost} onSelectZone={selectHosts} onChange={(host, mode, trigger) => openChange([host], mode, trigger)} />)}</div>
            {!groups.length && <div className="empty-state"><Globe2 size={30} className="mx-auto mb-4 text-slate-400" aria-hidden /><h3 className="text-base font-medium text-slate-700">{t(inventory.syncedAt ? '没有符合条件的域名' : '从你的 Cloudflare 域名开始')}</h3><p className="mt-2 mb-5 text-sm leading-7 text-slate-500">{t(inventory.syncedAt ? '调整筛选条件，或同步最新域名配置。' : '同步账号中的域，查看 Worker 与服务器代理入口。')}</p><Button disabled={busy} onClick={() => void sync()}><RefreshCw size={15} aria-hidden />{t("同步域名")}</Button></div>}
          </div><footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-3.5 text-xs text-slate-500"><span>{t('{count} 个域名', { count: visible.length })}</span><span className="flex items-center gap-1.5"><ShieldCheck size={12} aria-hidden />{t("管理后台入口自动保护")}</span></footer>
        </section>
        <NoticePreviews />
        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs leading-6 text-slate-500"><ShieldCheck size={12} className="shrink-0" aria-hidden />{t("维护时展示静态提示页；恢复后直接访问原服务。路由生效以 Cloudflare 配置传播为准。")}</p>
  </>;
}
