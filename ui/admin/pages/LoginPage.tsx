import * as Form from '@radix-ui/react-form';
import { Button, Callout, Card, Spinner, TextField } from '@radix-ui/themes';
import { ArrowRight } from 'lucide-react';
import { LanguageSwitch, useConsoleI18n } from '../i18n.tsx';
import { Brand } from '../components/Brand.tsx';

export function LoginPage({ error, busy, onLogin }: { error: string; busy: boolean; onLogin: (username: string, password: string) => Promise<void> }) {
  const { t } = useConsoleI18n();
  return <main className="login-page">
    <Card className="login-card" size="4">
      <div className="flex items-center justify-between gap-3"><Brand /><LanguageSwitch /></div>
      <Form.Root className="mt-7 space-y-5" onSubmit={event => {
        event.preventDefault(); const data = new FormData(event.currentTarget);
        void onLogin(String(data.get('username') || ''), String(data.get('password') || ''));
      }}>
        <Form.Field name="username" serverInvalid={Boolean(error)}>
          <Form.Label className="form-label">{t("用户账号")}</Form.Label>
          <Form.Control asChild><TextField.Root autoComplete="username" required maxLength={100} placeholder={t("输入用户账号")} size="3" aria-describedby={error ? 'login-error' : undefined} /></Form.Control>
          <Form.Message match="valueMissing" className="field-error">{t("请输入用户账号。")}</Form.Message>
        </Form.Field>
        <Form.Field name="password" serverInvalid={Boolean(error)}>
          <Form.Label className="form-label">{t("密码")}</Form.Label>
          <Form.Control asChild><TextField.Root type="password" autoComplete="current-password" required maxLength={256} placeholder={t("输入管理员密码")} size="3" aria-describedby={error ? 'login-error' : undefined} /></Form.Control>
          <Form.Message match="valueMissing" className="field-error">{t("请输入密码。")}</Form.Message>
        </Form.Field>
        {error && <Callout.Root color="red" size="1" id="login-error" role="alert"><Callout.Text>{t(error)}</Callout.Text></Callout.Root>}
        <Form.Submit asChild><Button size="3" className="w-full justify-between" disabled={busy}>{busy ? <><Spinner />{t("正在登录…")}</> : <>{t("登录控制台")}<ArrowRight size={17} aria-hidden /></>}</Button></Form.Submit>
      </Form.Root>
    </Card>
  </main>;
}
