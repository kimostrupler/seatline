'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { usePeople } from '@/lib/queries';

/** The non-drag way to assign (or move) someone: pick them from a searchable list. */
export function AssignPicker({
  seatId,
  label,
  disabled,
  onPick,
}: {
  seatId: string;
  label: string;
  disabled?: boolean;
  onPick: (personId: string) => void;
}) {
  const t = useTranslations('seat');
  const [open, setOpen] = useState(false);
  const people = usePeople('');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button disabled={disabled}>{label}</Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command>
          <CommandInput placeholder={t('assignSearch')} />
          <CommandList>
            <CommandEmpty>{t('assignEmpty')}</CommandEmpty>
            {people.data?.map((p) => {
              const current = p.assignments[0]?.seat;
              if (current?.id === seatId) return null;
              return (
                <CommandItem
                  key={p.id}
                  value={`${p.displayName} ${p.department ?? ''} ${p.email}`}
                  onSelect={() => {
                    setOpen(false);
                    onPick(p.id);
                  }}
                >
                  <span className="flex-1 truncate">{p.displayName}</span>
                  {current && (
                    <span className="text-xs text-muted-foreground">
                      {t('willMove', { label: current.label })}
                    </span>
                  )}
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
