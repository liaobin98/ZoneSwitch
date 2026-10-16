import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeResult, Host, Inventory, Mode } from '../../../shared/contracts.ts';
import { api, ApiError } from '../api.ts';
import type { Session } from '../api.ts';
import { hostKey, selectable } from '../model/services.ts';

const emptyInventory: Inventory = { zones: [], syncedAt: null, demo: false };
interface Pending { hosts: Host[]; mode: Mode; results: ChangeResult[]; error: string; finished: boolean; progress: string }
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
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
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
  function openChange(hosts: Host[], mode: Mode, trigger: HTMLElement | null) { if (busy || !hosts.length) return; changeTrigger.current = trigger; setPending({ hosts, mode, results: [], error: '', finished: false, progress: '' }); }
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
    const { hosts, mode } = pending; setBusy(true); const results: ChangeResult[] = [];
    const batchId = crypto.randomUUID();
    try {
      for (let offset = 0; offset < hosts.length; offset += 20) {
        setPending(current => current && ({ ...current, progress: `处理中 ${offset + 1}–${Math.min(offset + 20, hosts.length)} / ${hosts.length}` }));
        const targets = hosts.slice(offset, offset + 20).map(host => ({ zoneId: host.zoneId, hostname: host.hostname }));
        const batch = await request<{ results: ChangeResult[] }>('modes', { targets, mode, batchId }); results.push(...batch.results);
        setPending(current => current && ({ ...current, results: [...results] }));
        setSelected(previous => { const next = new Set(previous); for (const result of batch.results) if (result.success) next.delete(result.zoneId + ':' + result.hostname); return next; });
      }
      const successes = results.filter(result => result.success).length;
      const uncertain = results.filter(result => result.uncertain).length;
      const failures = results.length - successes - uncertain;
      setNotice({ text: `操作完成：${successes} 个成功，${failures} 个失败，${uncertain} 个待核实。`, error: failures > 0 || uncertain > 0 });
      setPending(current => current && ({ ...current, finished: true, error: uncertain ? '部分操作结果待核实，请同步域名后确认。' : failures ? '部分域名未完成切换，请查看原因后重试。' : '' }));
    } catch (error) {
      setPending(current => current && ({ ...current, finished: true, error: messageOf(error) + ' 已完成的结果见下方；其余域名的状态请同步后核实。' }));
      setNotice({ text: '批量操作未全部完成，请查看处理结果并同步核实。', error: true });
    } finally {
      try { setInventory(await request<Inventory>('inventory')); } catch (error) { setNotice({ text: messageOf(error), error: true }); }
      setBusy(false);
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
