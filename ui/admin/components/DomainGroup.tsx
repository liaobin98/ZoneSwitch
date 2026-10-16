import { useState } from 'react';
import type { MouseEvent } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { Badge, Button, Callout, Card, Checkbox, Table } from '@radix-ui/themes';
import { ChevronDown, Globe2, Info } from 'lucide-react';
import type { Host, Mode, ZoneGroup } from '../../../shared/contracts.ts';
import { useConsoleI18n } from '../i18n.tsx';
import { hostKey, selectable } from '../model/services.ts';
import { Connection, ModeActions, ModeBadge, ServiceDetails, ServiceLabel } from './ServiceControls.tsx';

export function DomainGroup({ zone, hosts, defaultOpen, compact, busy, selected, onSelect, onSelectZone, onChange }: { zone: ZoneGroup; defaultOpen: boolean; hosts: Host[]; compact: boolean; busy: boolean; selected: Set<string>; onSelect: (host: Host, checked: boolean) => void; onSelectZone: (hosts: Host[], checked: boolean) => void; onChange: (host: Host, mode: Mode, trigger: HTMLElement | null) => void }) {
  const { t } = useConsoleI18n();
  const [expanded, setExpanded] = useState<boolean | undefined>();
  const selectableHosts = hosts.filter(selectable);
  const selectedCount = selectableHosts.filter(host => selected.has(hostKey(host))).length;
  const selectionState = selectedCount === 0 ? false : selectedCount === selectableHosts.length ? true : 'indeterminate';
  const zoneCheckbox = <Checkbox aria-label={t('选择 {zone} 当前列表', { zone: zone.name })} checked={selectionState} disabled={busy || !selectableHosts.length} onCheckedChange={checked => onSelectZone(selectableHosts, checked === true)} />;
  const checkbox = (host: Host) => <Checkbox aria-label={t('选择 {hostname}', { hostname: host.hostname })} disabled={busy || !selectable(host)} checked={selected.has(hostKey(host))} onCheckedChange={checked => onSelect(host, checked === true)} />;
  function selectRow(event: MouseEvent<HTMLElement>, host: Host) {
    if (busy || !selectable(host)) return;
    // 行内控件各自处理事件，避免点击复选框或状态按钮时又触发行选择。
    if (event.target instanceof Element && event.target.closest('button, input, a, label, [role="checkbox"], [role="button"], [role="combobox"]')) return;
    if (window.getSelection()?.toString()) return;
    onSelect(host, !selected.has(hostKey(host)));
  }
  return <Collapsible.Root open={expanded ?? defaultOpen} onOpenChange={setExpanded} asChild><section className="zone-section" aria-label={t('{zone} 域名服务', { zone: zone.name })}>
    <div className="zone-header"><h3 className="zone-heading"><Collapsible.Trigger asChild><Button variant="ghost" color="gray" className="zone-toggle" aria-label={t('{zone} 域名列表', { zone: zone.name })}><ChevronDown size={18} className="zone-chevron" aria-hidden /><Globe2 size={18} className="shrink-0 text-blue-600" aria-hidden /><span className="truncate font-bold text-slate-900">{zone.name}</span><Badge color="gray" variant="outline" className="zone-count">{t('{count} 个域名', { count: hosts.length })}</Badge>{zone.error && <span className="shrink-0 text-xs font-normal text-red-700">{t("同步失败")}</span>}</Button></Collapsible.Trigger></h3></div>
    <Collapsible.Content className="zone-content">
    {zone.error && <Callout.Root color="red" size="1" className="mx-5 mb-3"><Callout.Icon><Info size={14} /></Callout.Icon><Callout.Text>{t(zone.error)}</Callout.Text></Callout.Root>}
    {compact ? <div className="divide-y divide-slate-100"><label className="mobile-zone-select">{zoneCheckbox}<span>{t("选择当前域名")}</span></label>{hosts.map(host => <Card key={hostKey(host)} className={'mobile-host' + (!busy && selectable(host) ? ' selectable-row' : '')} data-selected={selected.has(hostKey(host))} variant="ghost" onClick={event => selectRow(event, host)}>
      <div className="flex items-start gap-3"><span className="pt-1">{checkbox(host)}</span><div className="min-w-0 flex-1"><h4 className="break-all text-sm font-semibold text-slate-800">{host.hostname}</h4><ServiceDetails host={host} /></div><ModeBadge mode={host.mode} needsVerification={host.needsVerification} /></div>
      <div className="mt-4"><ServiceLabel host={host} /></div>
      <div className="mt-3"><Connection host={host} /></div>
      <div className="mt-4"><ModeActions host={host} disabled={busy} onChange={onChange} /></div>
    </Card>)}</div> : <Table.Root className="domain-table" variant="surface" size="2">
      <Table.Header><Table.Row><Table.ColumnHeaderCell className="check-cell">{zoneCheckbox}</Table.ColumnHeaderCell><Table.ColumnHeaderCell>{t("域名")}</Table.ColumnHeaderCell><Table.ColumnHeaderCell>{t("服务类型")}</Table.ColumnHeaderCell><Table.ColumnHeaderCell>{t("当前状态")}</Table.ColumnHeaderCell><Table.ColumnHeaderCell>{t("接入状态")}</Table.ColumnHeaderCell><Table.ColumnHeaderCell align="right">{t("切换状态")}</Table.ColumnHeaderCell></Table.Row></Table.Header>
      <Table.Body>{hosts.map(host => <Table.Row key={hostKey(host)} className={!busy && selectable(host) ? 'selectable-row' : undefined} data-selected={selected.has(hostKey(host))} aria-selected={selected.has(hostKey(host))} onClick={event => selectRow(event, host)}>
        <Table.Cell className="check-cell">{checkbox(host)}</Table.Cell>
        <Table.RowHeaderCell className="min-w-60"><div className="break-all text-sm font-medium text-slate-800">{host.hostname}</div><ServiceDetails host={host} /></Table.RowHeaderCell>
        <Table.Cell><ServiceLabel host={host} /></Table.Cell><Table.Cell><ModeBadge mode={host.mode} needsVerification={host.needsVerification} /></Table.Cell><Table.Cell><Connection host={host} /></Table.Cell><Table.Cell align="right"><ModeActions host={host} disabled={busy} onChange={onChange} /></Table.Cell>
      </Table.Row>)}</Table.Body>
    </Table.Root>}
    </Collapsible.Content>
  </section></Collapsible.Root>;
}
