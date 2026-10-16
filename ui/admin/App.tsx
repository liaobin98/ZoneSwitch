import * as Toast from '@radix-ui/react-toast';
import { Link, SegmentedControl, Spinner } from '@radix-ui/themes';
import { useConsoleI18n } from './i18n.tsx';
import { useCompact } from './hooks/useCompact.ts';
import { useConsole } from './hooks/useConsole.ts';
import { LoginPage } from './pages/LoginPage.tsx';
import { DomainsPage } from './pages/DomainsPage.tsx';
import { AuditPage } from './pages/AuditPage.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { ChangeDialog } from './components/ChangeDialog.tsx';
import { ConsoleToast } from './components/ConsoleToast.tsx';

export function App() {
  const { t } = useConsoleI18n();
  const compact = useCompact();
  const controller = useConsole();
  const { checking, session, loginError, loginBusy, login, view, setView, request } = controller;
  if (checking) return <main className="grid min-h-dvh place-items-center bg-slate-50"><div className="flex items-center gap-3 text-sm text-slate-600" role="status"><Spinner />{t("正在检查登录状态…")}</div></main>;
  if (!session) return <LoginPage error={loginError} busy={loginBusy} onLogin={login} />;

  return <Toast.Provider label={t("提示消息")} swipeDirection="up">
    <Link href="#main" className="skip-link">{t("跳转到主内容")}</Link>
    <div className="app-shell">
      <Sidebar controller={controller} />
      <main id="main" className="main-content">
        {compact && <nav className="mobile-view-navigation" aria-label={t("页面导航")}><SegmentedControl.Root value={view} onValueChange={value => setView(value === 'audit' ? 'audit' : 'domains')} className="w-full" size="2"><SegmentedControl.Item value="domains">{t("服务控制台")}</SegmentedControl.Item><SegmentedControl.Item value="audit">{t("操作记录")}</SegmentedControl.Item></SegmentedControl.Root></nav>}
        {view === "audit" ? <AuditPage compact={compact} request={request} /> : <DomainsPage controller={controller} compact={compact} />}
      </main>
    </div>
    <ChangeDialog controller={controller} />
    <ConsoleToast controller={controller} />
  </Toast.Provider>;
}
