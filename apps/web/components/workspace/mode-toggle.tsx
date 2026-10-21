'use client';

import { Eye, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export function ModeToggle({
  editing,
  onChange,
}: {
  editing: boolean;
  onChange: (editing: boolean) => void;
}) {
  const t = useTranslations('mode');
  return (
    <ToggleGroup
      type="single"
      size="sm"
      variant="outline"
      aria-label={t('label')}
      value={editing ? 'edit' : 'view'}
      onValueChange={(v) => v && onChange(v === 'edit')}
    >
      <ToggleGroupItem value="view" className="px-2.5">
        <Eye /> <span className="max-sm:sr-only">{t('view')}</span>
      </ToggleGroupItem>
      <ToggleGroupItem value="edit" className="px-2.5" data-testid="mode-edit">
        <Pencil /> <span className="max-sm:sr-only">{t('edit')}</span>
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
