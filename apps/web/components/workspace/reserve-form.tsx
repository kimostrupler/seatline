'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function ReserveForm({
  disabled,
  onReserve,
}: {
  disabled?: boolean;
  onReserve: (reservedFor: string) => Promise<boolean>;
}) {
  const t = useTranslations('seat');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          {t('reserve')}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <form
          className="grid gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            if (await onReserve(name.trim())) {
              setOpen(false);
              setName('');
            }
          }}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('reservePlaceholder')}
            aria-label={t('reservePlaceholder')}
            maxLength={200}
          />
          <Button type="submit" disabled={!name.trim() || disabled}>
            {t('reserveSave')}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
