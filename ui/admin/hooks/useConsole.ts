import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeResult, Host, Inventory, Mode } from '../../../shared/contracts.ts';
import { api, ApiError } from '../api.ts';
import type { Session } from '../api.ts';
import { canChangeMode, hostKey, selectable } from '../model/services.ts';

const emptyInventory: Inventory = { zones: [], syncedAt: null, demo: false };
interface Pending { hosts: Host[]; mode: Mode; batch: boolean; results: ChangeResult[]; error: string; finished: boolean; progress: string }
interface Notice { text: string; error: boolean; details?: string[] }
const messageOf = (error: unknown) => error instanceof Error ? error.message : '操作失败，请稍后重试。';


// 统一管理会话、清单、筛选、选择和分批操作，页面组件只负责展示。
export function useConsole() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [inventory, setInventory] = useState<Inventory>(emptyInventory);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeZone, setActiveZone] = useState('all');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [view, setView] = useState<'domains' | 'audit'>('domains');
  const changeTrigger = useRef<HTMLElement | null>(null);

  const clearSession = useCallback((message = '') => {
    setSession(null); setInventory(emptyInventory); setSelected(new Set()); setPending(null); setView('domains'); setNotice(null); setLoginError(message); setLogoutError('');
  }, []);
  const request = useCallback(async <T,>(path: string, data?: unknown): Promise<T> => {
    try { return await api<T>(path, session?.csrf, data); }
    catch (error) { if (error instanceof ApiError && error.status === 401) clearSession('登录已过期，请重新登录。'); throw error; }
  }, [session?.csrf, clearSession]);
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const auth = await api<Session>('session');
        if (!live) return; setSession(auth);
        try { const cached = await api<Inventory>('inventory'); if (live) setInventory(cached); }
        catch (error) { if (live) { if (error instanceof ApiError && error.status === 401) clearSession('登录已过期，请重新登录。'); else setNotice({ text: messageOf(error), error: true }); } }
      } catch (error) { if (live && !(error instanceof ApiError && error.status === 401)) setLoginError(messageOf(error)); }
      finally { if (live) setChecking(false); }
    })();
    return () => { live = false; };
  }, []);

  const allHosts = inventory.zones.flatMap(zone => zone.hosts);
  const serviceHosts = allHosts.filter(host => host.type !== 'dns' && !host.reason.includes('管理后台'));
  const query = search.trim().toLowerCase();
  const groups = inventory.zones.filter(zone => activeZone === 'all' || zone.id === activeZone).map(zone => ({
    zone,
    hosts: zone.hosts
      .filter(host => (typeFilter === 'all' || host.type === typeFilter) && (modeFilter === 'all' || (modeFilter === 'verification' ? host.needsVerification : !host.needsVerification && host.mode === modeFilter)) && (!query || [host.hostname, host.service, zone.name].some(value => value.toLowerCase().includes(query))))
      .sort((a, b) => Number(b.actionable) - Number(a.actionable)),
  })).filter(group => group.hosts.length || group.zone.error);
  const visible = groups.flatMap(group => group.hosts);
  const selectableVisible = visible.filter(selectable);
  const checkedCount = selectableVisible.filter(host => selected.has(hostKey(host))).length;
  const selectionState: boolean | 'indeterminate' = checkedCount === 0 ? false : checkedCount === selectableVisible.length ? true : 'indeterminate';
  function selectHost(host: Host, checked: boolean) { setSelected(previous => { const next = new Set(previous); checked ? next.add(hostKey(host)) : next.delete(hostKey(host)); return next; }); }
  function selectHosts(hosts: Host[], checked = true) { setSelected(previous => { const next = new Set(previous); for (const host of hosts.filter(selectable)) checked ? next.add(hostKey(host)) : next.delete(hostKey(host)); return next; }); }
  function openChange(hosts: Host[], mode: Mode, trigger: HTMLElement | null, batch = false) {
    const targets = hosts.filter(host => canChangeMode(host, mode));
    if (busy || !targets.length) return;
    changeTrigger.current = trigger; setPending({ hosts: targets, mode, batch, results: [], error: '', finished: false, progress: '' });
  }
  async function login(username: string, password: string) {
    setLoginError(''); setLoginBusy(true);
    try { const auth = await api<Session>('login', '', { username, password }); setSession(auth); try { setInventory(await api<Inventory>('inventory')); } catch (error) { setNotice({ text: messageOf(error), error: true }); } }
    catch (error) { setLoginError(messageOf(error)); }
    finally { setLoginBusy(false); }
  }
  async function sync() {
    if (busy) return; setBusy(true); setNotice({ text: '正在同步 Cloudflare 域名和服务入口…', error: false });
    try {
      const fresh = await request<Inventory>('refresh', {}); setInventory(fresh); setSelected(new Set());
      if (activeZone !== 'all' && !fresh.zones.some(zone => zone.id === activeZone)) setActiveZone('all');
      const failures = fresh.zones.filter(zone => zone.error).length;
      setNotice({ text: failures ? `同步完成，${failures} 个域读取失败，请查看列表中的原因。` : `已同步 ${fresh.zones.length} 个域、${fresh.zones.flatMap(zone => zone.hosts).length} 个域名。`, error: failures > 0 });
    } catch (error) { setNotice({ text: messageOf(error), error: true }); }
    finally { setBusy(false); }
  }
  async function applyChange() {
    if (!pending || busy) return;
    const { hosts, mode, batch: showProgress } = pending;
    setBusy(true);
    // 单个操作确认后立即关闭；批量入口即使只选一个域名，也保留进度窗口。
    if (!showProgress) setPending(null);
    setNotice(showProgress ? null : { text: '处理中…', error: false });
    const results: ChangeResult[] = [];
    let completed = false;
    let completionNotice: Notice = { text: '', error: false };
    const batchId = crypto.randomUUID();
    try {
      for (let offset = 0; offset < hosts.length; offset += 20) {
        setPending(current => current && ({ ...current, progress: `处理中 ${offset + 1}–${Math.min(offset + 20, hosts.length)} / ${hosts.length}` }));
        const targets = hosts.slice(offset, offset + 20).map(host => ({ zoneId: host.zoneId, hostname: host.hostname }));
        const batch = await request<{ results: ChangeResult[] }>('modes', { targets, mode, batchId }); results.push(...batch.results);
        setPending(current => current && ({ ...current, results: [...results], progress: `已处理 ${results.length} / ${hosts.length}` }));
        setSelected(previous => { const next = new Set(previous); for (const result of batch.results) if (result.success) next.delete(result.zoneId + ':' + result.hostname); return next; });
      }
      const successes = results.filter(result => result.success).length;
      const uncertain = results.filter(result => result.uncertain).length;
      const failures = results.length - successes - uncertain;
      completed = results.length === hosts.length && results.every(result => result.success);
      completionNotice = { text: `操作完成：${successes} 个成功，${failures} 个失败，${uncertain} 个待核实。`, error: !completed };
      const error = uncertain ? '部分操作结果待核实，请同步域名后确认。' : !completed ? '部分域名未完成切换，请查看原因后重试。' : '';
      if (error && !showProgress) completionNotice.details = [results[0]?.error || error];
      setPending(current => current && ({ ...current, finished: true, error }));
    } catch (error) {
      const text = messageOf(error) + ' 请同步域名后确认实际状态。';
      setPending(current => current && ({ ...current, finished: true, error: text }));
      completionNotice = { text, error: true };
    } finally {
      try { setInventory(await request<Inventory>('inventory')); }
      catch {
        completed = false;
        const text = '列表更新失败，请同步域名后确认实际状态。';
        completionNotice = { ...completionNotice, details: [...(completionNotice.details || []), text], error: true };
        setPending(current => current && ({ ...current, finished: true, error: current.error || text }));
      }
      if (showProgress && completed) {
        // 让最后一批结果与 100% 进度先完成绘制，再自动关闭。
        await new Promise(resolve => window.setTimeout(resolve, 500));
        setPending(null);
      }
      setBusy(false);
      setNotice(completionNotice);
    }
  }
  async function logout() {
    if (busy) return;
    setBusy(true); setLogoutError('');
    try { await request('logout', {}); clearSession(); }
    catch (error) { setLogoutError(messageOf(error)); }
    finally { setBusy(false); }
  }

  return { session, checking, loginError, loginBusy, logoutError, inventory, selected, setSelected, activeZone, setActiveZone,
    search, setSearch, typeFilter, setTypeFilter, modeFilter, setModeFilter, busy, notice, setNotice, pending, setPending,
    view, setView, changeTrigger, allHosts, serviceHosts, groups, visible, selectableVisible, selectionState,
    selectHost, selectHosts, openChange, login, sync, applyChange, logout, request };
}
export type ConsoleController = ReturnType<typeof useConsole>;
