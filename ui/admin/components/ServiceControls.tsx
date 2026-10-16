import { Badge, Button, Tooltip } from '@radix-ui/themes';
import { ArrowRight, CircleCheck, CircleDollarSign, Globe2, Server, ShieldCheck, Workflow, Wrench } from 'lucide-react';
import type { Host, Mode } from '../../../shared/contracts.ts';
import { useConsoleI18n } from '../i18n.tsx';
import { actionLabels, colors, labels, modes, selectable } from '../model/services.ts';

const modeIcons = { normal: CircleCheck, maintenance: Wrench, billing: CircleDollarSign };

export function ModeBadge({ mode, needsVerification = false }: { mode: Mode; needsVerification?: boolean }) {
  const { t } = useConsoleI18n();
  if (needsVerification) return <Badge color="amber" variant="soft" size="1">{t('待核实')}</Badge>;
  const Icon = modeIcons[mode];
  return <Badge color={colors[mode]} variant="soft" size="1"><Icon size={12} aria-hidden />{t(labels[mode])}</Badge>;
}
export function ServiceLabel({ host }: { host: Host }) {
  const { t } = useConsoleI18n();
  const Icon = host.type === 'worker' ? Workflow : host.type === 'proxy' ? Server : Globe2;
  return <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm leading-5 text-slate-600"><Icon size={14} className="shrink-0" aria-hidden />{t(host.type === 'worker' ? 'Worker' : host.type === 'proxy' ? '服务器代理' : '仅 DNS')}</span>;
}
export function ServiceDetails({ host }: { host: Host }) {
  const { t } = useConsoleI18n();
  const recordLabels: Record<string, string> = { A: 'DNS A：', AAAA: 'DNS AAAA：', CNAME: 'DNS CNAME：' };
  const details = host.type === 'worker'
    ? [{ label: 'Worker：', value: host.service || t('未取得名称') }]
    : (host.dnsRecords || []).map(record => ({ label: recordLabels[record.type] || 'DNS ' + record.type + '：', value: record.content }));
  if (!details.length) return <p className="mt-1.5 text-pretty text-xs leading-5 font-normal text-slate-500">{t("同步后显示记录值")}</p>;
  return <dl className="mt-1.5 space-y-1 text-xs leading-5 font-normal">
    {details.map(detail => <div className="flex flex-wrap items-baseline gap-y-0.5" key={detail.label + ':' + detail.value}>
      <dt className="shrink-0 whitespace-nowrap text-slate-500">{t(detail.label)}</dt>
      <dd className="break-all font-mono tabular-nums text-slate-700">{detail.value}</dd>
    </div>)}
  </dl>;
}
export function Connection({ host }: { host: Host }) {
  const { t } = useConsoleI18n();
  const protectedHost = host.reason.includes('管理后台');
  if (host.needsVerification && !protectedHost) return <p className="max-w-72 text-sm leading-6 text-amber-800">{t('操作结果待核实，请同步域名后确认。')}</p>;
  const label = protectedHost ? '入口已保护' : host.reason.includes('路由冲突') ? '路由冲突' : host.type === 'dns' ? '未开启代理' : host.reason ? '暂不可开启' : host.connected ? '提示页路由' : '原服务直连';
  const Icon = protectedHost ? ShieldCheck : host.connected && !host.reason ? CircleCheck : ArrowRight;
  return <div className="max-w-72">
    <Tooltip content={t(host.reason || '开启时切换到静态提示页；恢复时移除临时路由，直接访问原服务。')}>
      <span className={'inline-flex items-center gap-1.5 text-sm leading-5 ' + (host.reason ? 'text-amber-800' : host.connected ? 'text-emerald-700' : 'text-slate-500')}><Icon size={14} aria-hidden />{t(label)}</span>
    </Tooltip>
    {host.reason && <p className="mt-1 text-xs leading-relaxed text-slate-500">{t(host.reason)}</p>}
    {host.mode !== 'normal' && (!host.connected || host.reason) && <p className="mt-1 text-xs text-amber-800">{t("维护覆盖需核查")}</p>}
  </div>;
}

export function ModeActions({ host, disabled, onChange }: { host: Host; disabled: boolean; onChange: (host: Host, mode: Mode, trigger: HTMLElement | null) => void }) {
  const { t } = useConsoleI18n();
  return <div className="mode-actions" role="group" aria-label={t('切换 {hostname} 的服务状态', { hostname: host.hostname })}>
    {modes.map(mode => {
      const Icon = modeIcons[mode];
      const current = !host.needsVerification && mode === host.mode;
      return <Button key={mode} variant="outline" color={colors[mode]} size="1" className="mode-action" aria-label={host.hostname + ': ' + t(actionLabels[mode])} aria-pressed={current} disabled={disabled || !selectable(host) || !host.actionable && mode !== 'normal'} onClick={event => onChange(host, mode, event.currentTarget)}>
        <Icon size={13} aria-hidden />{t(actionLabels[mode])}
      </Button>;
    })}
  </div>;
}
