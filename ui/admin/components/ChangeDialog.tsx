import { useEffect, useRef } from 'react';
import { AlertDialog, Button, Callout, IconButton, ScrollArea, Spinner } from '@radix-ui/themes';
import { Check, CircleHelp, X } from 'lucide-react';
import { useConsoleI18n } from '../i18n.tsx';
import type { ConsoleController } from '../hooks/useConsole.ts';
import { descriptions, hostKey, labels } from '../model/services.ts';

export function ChangeDialog({ controller }: { controller: ConsoleController }) {
  const { t, locale } = useConsoleI18n();
  const { pending, setPending, busy, changeTrigger, applyChange } = controller;
  const doneButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (pending?.finished && !busy) doneButton.current?.focus(); }, [pending?.finished, busy]);
  return <AlertDialog.Root open={Boolean(pending)} onOpenChange={open => { if (!open && !busy) setPending(null); }}>
      <AlertDialog.Content maxWidth="500px" className="change-dialog" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onCloseAutoFocus={event => { event.preventDefault(); if (changeTrigger.current?.isConnected && !changeTrigger.current.matches(':disabled')) changeTrigger.current.focus(); else document.getElementById('select-all')?.focus(); }}>
        <div className="mb-3 flex items-center justify-between gap-3"><AlertDialog.Title className="mb-0">{t(pending?.mode === 'normal' ? '关闭维护，恢复服务' : pending?.mode === 'maintenance' ? '开启服务维护' : '设置服务欠费提示')}</AlertDialog.Title><AlertDialog.Cancel><IconButton variant="ghost" color="gray" aria-label={t("关闭对话框")} disabled={busy}><X size={17} /></IconButton></AlertDialog.Cancel></div>
        <AlertDialog.Description size="2" color="gray">{t('将对 {count} 个域名设置「{mode}」。', { count: pending?.hosts.length || 0, mode: pending ? t(labels[pending.mode]) : '' })}</AlertDialog.Description>
        <Callout.Root size="1" color={pending?.mode === 'billing' ? 'amber' : pending?.mode === 'normal' ? 'green' : 'blue'} className="my-4"><Callout.Text>{pending ? t(descriptions[pending.mode]) + (locale === 'en' ? ' ' : '') + t(pending.mode === 'normal' ? '将移除临时提示路由；通配维护下会添加恢复例外。' : '将域名路由切换到对应静态提示页。') : ''}</Callout.Text></Callout.Root>
        <ScrollArea scrollbars="vertical" className="target-scroll"><ul className="divide-y divide-slate-100 rounded-md border border-slate-200">{pending?.hosts.map(host => <li className="break-all px-3 py-2 text-sm text-slate-600" key={hostKey(host)}>{host.hostname}</li>)}</ul></ScrollArea>
        {pending?.error && <Callout.Root color="red" size="1" className="mt-4" role="alert"><Callout.Text>{t(pending.error)}</Callout.Text></Callout.Root>}
        {!!pending?.results.length && <ScrollArea scrollbars="vertical" className="results-scroll mt-4"><div aria-live="polite">{pending.results.map(result => <div key={result.hostname} className={'flex items-start gap-2 border-b border-slate-100 py-2 text-xs leading-6 ' + (result.success ? 'text-emerald-700' : result.uncertain ? 'text-amber-800' : 'text-red-700')}>{result.success ? <Check size={14} className="mt-1 shrink-0" aria-hidden /> : result.uncertain ? <CircleHelp size={14} className="mt-1 shrink-0" aria-hidden /> : <X size={14} className="mt-1 shrink-0" aria-hidden />}<span className="break-all">{result.hostname} · {t(result.success ? labels[pending.mode] : result.error || '操作失败')}</span></div>)}</div></ScrollArea>}
        <div className="mt-6 flex justify-end gap-3"><AlertDialog.Cancel><Button ref={doneButton} variant="outline" color="gray" disabled={busy}>{t(pending?.finished ? '完成' : '取消')}</Button></AlertDialog.Cancel>{!pending?.finished && <Button disabled={busy} onClick={() => void applyChange()}>{busy ? <><Spinner />{t(pending?.progress || '处理中…')}</> : t('确认切换')}</Button>}</div>
      </AlertDialog.Content>
    </AlertDialog.Root>;
}
