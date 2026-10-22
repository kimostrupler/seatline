'use client';

import { APP_ROLES, type AppRole } from '@seatline/shared';
import { Download, FileSpreadsheet } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ApiError } from '@/lib/api';
import { useImportPeople, useReadImport, type ImportRow } from '@/lib/queries';
import { cn } from '@/lib/utils';

const NONE = 'none';
const STATUSES = ['new', 'exists', 'duplicate', 'invalid'] as const;
const IMPORT_ERRORS = ['no_columns', 'bad_format', 'empty', 'too_many'] as const;

/** A starter file in the admin's language (";" so Excel in Switzerland opens it in columns). */
function downloadTemplate(columns: string[], example: string[]) {
  const csv = `﻿${columns.join(';')}\r\n${example.join(';')}\r\n`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: 'people.csv' });
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Add many people at once from an Excel or CSV file: pick the file → check what will happen to
 * each row → choose their role (and an invitation) → import. Nothing is saved before that.
 */
export function ImportPeopleDialog({
  canInvite,
  onClose,
}: {
  canInvite: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('admin.import');
  const tRole = useTranslations('devLogin.role');
  const locale = useLocale().slice(0, 2);
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const read = useReadImport();
  const save = useImportPeople();
  const [file, setFile] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [role, setRole] = useState<string>('viewer');
  const [invite, setInvite] = useState(true);
  const appRole = role === NONE ? null : (role as AppRole);
  const fresh = rows?.filter((r) => r.status === 'new') ?? [];
  const count = (status: ImportRow['status']) => rows?.filter((r) => r.status === status).length;

  const pick = (f: File | undefined) => {
    if (!f) return;
    setFile(f.name);
    setRows(null);
    read.mutateAsync(f).then(
      (res) => setRows(res.rows),
      (error: unknown) => {
        const code = error instanceof ApiError ? error.code : undefined;
        toast.error(
          code && (IMPORT_ERRORS as readonly string[]).includes(code)
            ? t(`errors.${code as (typeof IMPORT_ERRORS)[number]}`)
            : error instanceof Error
              ? error.message
              : String(error),
        );
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('body')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={input}
            id={`${id}-file`}
            type="file"
            accept=".csv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = '';
            }}
            data-testid="import-file"
          />
          <Button
            type="button"
            variant={rows ? 'outline' : 'default'}
            onClick={() => input.current?.click()}
            disabled={read.isPending}
          >
            <FileSpreadsheet /> {rows ? t('otherFile') : t('pick')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              downloadTemplate(
                [t('columns.name'), t('columns.email'), t('columns.team'), t('columns.jobTitle')],
                [t('example.name'), t('example.email'), t('example.team'), t('example.jobTitle')],
              )
            }
          >
            <Download /> {t('template')}
          </Button>
          {file && (
            <span className="min-w-0 truncate text-sm text-muted-foreground">
              {read.isPending ? t('reading', { file }) : file}
            </span>
          )}
        </div>
        {!rows && <p className="text-xs text-muted-foreground">{t('hint')}</p>}

        {rows && (
          <>
            <p className="text-sm" data-testid="import-summary">
              {STATUSES.filter((s) => count(s))
                .map((s) => t(`summary.${s}`, { count: count(s) ?? 0 }))
                .join(' · ')}
            </p>
            <div className="max-h-64 overflow-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t('columns.name')}</th>
                    <th className="px-3 py-2 font-medium">{t('columns.email')}</th>
                    <th className="hidden px-3 py-2 font-medium sm:table-cell">
                      {t('columns.team')}
                    </th>
                    <th className="px-3 py-2 font-medium">
                      <span className="sr-only">{t('columns.status')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.line}
                      className={cn('border-t', r.status !== 'new' && 'text-muted-foreground')}
                    >
                      <td className="px-3 py-1.5">{r.displayName || '—'}</td>
                      <td className="max-w-48 truncate px-3 py-1.5">{r.email || '—'}</td>
                      <td className="hidden px-3 py-1.5 sm:table-cell">{r.department}</td>
                      <td className="px-3 py-1.5 text-right whitespace-nowrap">
                        <Badge
                          variant={
                            r.status === 'new'
                              ? 'secondary'
                              : r.status === 'invalid'
                                ? 'destructive'
                                : 'outline'
                          }
                        >
                          {r.problem
                            ? t(`problems.${r.problem}`, { line: r.line })
                            : t(`status.${r.status}`)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {fresh.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
                <div className="grid gap-1.5">
                  <Label htmlFor={`${id}-role`}>{t('role')}</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger id={`${id}-role`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {APP_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {tRole(r)}
                        </SelectItem>
                      ))}
                      <SelectItem value={NONE}>{t('noRole')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {canInvite && appRole && (
                  <label className="flex items-center gap-2 pb-2 text-sm">
                    <Switch checked={invite} onCheckedChange={setInvite} />
                    {t('invite')}
                  </label>
                )}
              </div>
            )}
          </>
        )}

        <DialogFooter className="mt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button
            type="button"
            disabled={!fresh.length || save.isPending}
            onClick={() =>
              save
                .mutateAsync({
                  people: fresh.map((r) => ({
                    displayName: r.displayName,
                    email: r.email,
                    department: r.department,
                    jobTitle: r.jobTitle,
                  })),
                  appRole,
                  invite: canInvite && !!appRole && invite,
                  language: locale,
                })
                .then(
                  (res) => {
                    toast.success(
                      res.invited
                        ? t('doneInvited', { count: res.created, invited: res.invited })
                        : t('done', { count: res.created }),
                    );
                    onClose();
                  },
                  (error: unknown) =>
                    toast.error(error instanceof Error ? error.message : String(error)),
                )
            }
          >
            {t('submit', { count: fresh.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
