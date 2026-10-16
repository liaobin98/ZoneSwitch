import { createRoot } from 'react-dom/client';
import { Theme } from '@radix-ui/themes';
import { App } from './App.tsx';
import { I18nProvider } from './i18n.tsx';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <Theme accentColor="blue" grayColor="slate" radius="medium" appearance="light" panelBackground="solid">
    <I18nProvider><App /></I18nProvider>
  </Theme>,
);
