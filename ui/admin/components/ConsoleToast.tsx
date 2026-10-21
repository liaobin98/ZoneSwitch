import * as Toast from '@radix-ui/react-toast';
import { IconButton, Spinner } from '@radix-ui/themes';
import { CircleCheck, Info, X } from 'lucide-react';
import { useConsoleI18n } from '../i18n.tsx';
import type { ConsoleController } from '../hooks/useConsole.ts';

export function ConsoleToast({ controller }: { controller: ConsoleController }) {
  const { t } = useConsoleI18n();
  const { notice, setNotice, busy } = controller;
  return <>
    {notice && <Toast.Root key={notice.text} open onOpenChange={open => { if (!open) setNotice(null); }} duration={busy ? Infinity : notice.error ? 8000 : 5000} type={notice.error ? 'foreground' : 'background'} className={'toast-message ' + (notice.error ? 'toast-error' : 'toast-success')}>
      <span className="toast-icon" aria-hidden>{busy ? <Spinner size="2" /> : notice.error ? <Info size={18} /> : <CircleCheck size={18} />}</span>
      <Toast.Description className="toast-description">{t(notice.text)}{notice.details?.map((detail, index) => <span key={index}> {t(detail)}</span>)}</Toast.Description>
      <Toast.Close asChild><IconButton variant="ghost" color="gray" size="1" aria-label={t("关闭提示")}><X size={15} aria-hidden /></IconButton></Toast.Close>
    </Toast.Root>}
    <Toast.Viewport className="toast-viewport" label={t("提示消息（{hotkey}）")} />
  </>;
}
