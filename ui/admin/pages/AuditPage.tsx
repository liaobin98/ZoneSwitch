import { useConsoleI18n } from '../i18n.tsx';
import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Callout, Card, Table, Spinner } from '@radix-ui/themes';
import { ChevronLeft, ChevronRight, History, Info, RefreshCw } from 'lucide-react';
import type { AuditEntry, AuditPage as AuditPageData } from '../../../shared/contracts.ts';
import { ModeBadge } from '../components/ServiceControls.tsx';
import { SelectControl } from '../components/SelectControl.tsx';


function Results({ entry }: { entry: AuditEntry }) {
  const { t } = useConsoleI18n();
  return <ul className="space-y-2">{entry.results.map(result => <li key={result.zoneId + ':' + result.hostname} className="flex flex-wrap items-start gap-2 text-sm leading-6">
    <Badge color={result.success ? 'green' : result.uncertain ? 'amber' : 'red'}>{t(result.success ? '成功' : result.uncertain ? '待核实' : '失败')}</Badge>
    <span className="min-w-0 flex-1 break-all text-slate-700">{result.hostname}{!result.success && <span className="mt-0.5 block text-xs leading-5 text-red-700">{t(result.error || '操作失败')}</span>}</span>
  </li>)}</ul>;
}

export function AuditPage({ compact, request }: { compact: boolean; request: (path: string) => Promise<AuditPageData> }) {
  const { t, locale } = useConsoleI18n();
  const formatTime = (time: string) => new Date(time).toLocaleString(locale, { hour12: false });
  const [data, setData] = useState<AuditPageData | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    let live = true;
    setLoading(true); setError('');
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    void request('audit?' + params).then(result => {
      if (!live) return;
      setData(result);
    }).catch(cause => { if (live) setError(cause instanceof Error ? cause.message : '日志查询失败，请重试。'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [page, pageSize, revision, request]);
  function refresh() { setPage(1); setRevision(value => value + 1); }

  return <>
    <header className="page-header"><div className="min-w-0"><p className="eyebrow">WORKSPACE / LOGS</p><h1 ref={heading} tabIndex={-1} className="page-title">{t("操作记录")}</h1><p className="page-description">{t("保留最近 100 批操作，包含每个域名的处理结果。")}</p></div><Button variant="outline" color="gray" disabled={loading} onClick={refresh}><RefreshCw size={15} aria-hidden />{t("刷新日志")}</Button></header>
    <section className="domains-panel" aria-labelledby="audit-title" aria-busy={loading}>
      <div className="panel-toolbar"><div><h2 id="audit-title" className="text-base font-semibold text-slate-800">{t("最近日志")}</h2><p className="mt-1 text-xs text-slate-500">{t("按操作时间从新到旧排列，以批次分页。")}</p></div><SelectControl label={t("每页日志批数")} value={String(pageSize)} disabled={loading} onChange={value => { setPageSize(Number(value)); setPage(1); }} options={[20, 50, 100].map(size => ({ value: String(size), label: t('每页 {count} 批', { count: size }) }))} /></div>
      {loading ? <div className="empty-state flex items-center justify-center gap-2 text-sm text-slate-500" role="status"><Spinner />{t("正在查询日志…")}</div> : error ? <div className="px-5 pb-5"><Callout.Root color="red" role="alert"><Callout.Icon><Info size={15} /></Callout.Icon><Callout.Text>{t(error)}</Callout.Text></Callout.Root><Button className="mt-4" variant="outline" onClick={() => setRevision(value => value + 1)}>{t("重新查询")}</Button></div> : !data?.entries.length ? <div className="empty-state"><History size={30} className="mx-auto mb-4 text-slate-400" aria-hidden /><p className="text-sm text-slate-500">{t("暂无操作记录。")}</p></div> : compact ? <div className="divide-y divide-slate-100">{data.entries.map((entry, index) => <Card key={entry.time + index} className="mobile-host" variant="ghost"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-slate-500">{formatTime(entry.time)}</span><ModeBadge mode={entry.mode} /></div><p className="mb-3 break-all text-sm text-slate-700">{t("操作人：")}{entry.username}</p><Results entry={entry} /></Card>)}</div> : <Table.Root className="domain-table" variant="surface" size="2">
        <Table.Header><Table.Row><Table.ColumnHeaderCell>{t("操作时间")}</Table.ColumnHeaderCell><Table.ColumnHeaderCell>{t("操作人")}</Table.ColumnHeaderCell><Table.ColumnHeaderCell>{t("目标状态")}</Table.ColumnHeaderCell><Table.ColumnHeaderCell>{t("域名与处理结果")}</Table.ColumnHeaderCell></Table.Row></Table.Header>
        <Table.Body>{data.entries.map((entry, index) => <Table.Row key={entry.time + index}><Table.Cell className="whitespace-nowrap text-xs text-slate-500">{formatTime(entry.time)}</Table.Cell><Table.RowHeaderCell className="break-all text-sm text-slate-700">{entry.username}</Table.RowHeaderCell><Table.Cell><ModeBadge mode={entry.mode} /></Table.Cell><Table.Cell><Results entry={entry} /></Table.Cell></Table.Row>)}</Table.Body>
      </Table.Root>}
      <footer className="audit-pagination"><p className="text-xs text-slate-500" role="status">{data ? t('共 {total} 批操作 · 第 {page} / {pages} 页', { total: data.total, page: data.page, pages: data.totalPages }) : t('尚未加载日志')}</p><nav aria-label={t("操作日志分页")} className="flex flex-wrap items-center gap-2">
        <Button variant="outline" color="gray" size="1" disabled={loading || Boolean(error) || !data || data.page <= 1} onClick={() => setPage(1)}>{t("首页")}</Button>
        <Button variant="outline" color="gray" size="1" disabled={loading || Boolean(error) || !data || data.page <= 1} onClick={() => setPage(data!.page - 1)}><ChevronLeft size={14} aria-hidden />{t("上一页")}</Button>
        <Button variant="outline" color="gray" size="1" disabled={loading || Boolean(error) || !data || data.page >= data.totalPages} onClick={() => setPage(data!.page + 1)}>{t("下一页")}<ChevronRight size={14} aria-hidden /></Button>
        <Button variant="outline" color="gray" size="1" disabled={loading || Boolean(error) || !data || data.page >= data.totalPages} onClick={() => setPage(data!.totalPages)}>{t("末页")}</Button>
      </nav></footer>
    </section>
  </>;
}
