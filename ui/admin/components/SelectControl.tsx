import { Select } from '@radix-ui/themes';
import { useConsoleI18n } from '../i18n.tsx';

export function SelectControl({ label, value, options, onChange, disabled = false }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void; disabled?: boolean }) {
  const { t } = useConsoleI18n();
  return <Select.Root value={value} onValueChange={onChange} disabled={disabled}>
    <Select.Trigger aria-label={t(label)} variant="surface" className="filter-select" />
    <Select.Content position="popper">
      {options.map(option => <Select.Item key={option.value} value={option.value}>{t(option.label)}</Select.Item>)}
    </Select.Content>
  </Select.Root>;
}
