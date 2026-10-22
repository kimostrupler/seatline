'use client';

import { APP_ROLES, type AppRole } from '@seatline/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreatePerson, useUpdatePerson } from '@/lib/queries';
import type { DirectoryPerson } from '@/lib/types';

const NONE = 'none';
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Add someone by hand: name, e-mail, team, role — and, with e-mail sign-in, an invitation. */
export function AddPersonDialog({
  teams,
  canInvite,
  onClose,
}: {
  teams: string[];
  /** the workspace signs in by e-mail (Microsoft workspaces sign in with Microsoft) */
  canInvite: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('admin.add');
  const tRole = useTranslations('devLogin.role');
  const locale = useLocale().slice(0, 2); // 'de-CH' → 'de' (e-mail language)
  const create = useCreatePerson();
  const id = useId();
  const [form, setForm] = useState({ name: '', email: '', team: '', role: 'viewer', invite: true });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const appRole = form.role === NONE ? null : (form.role as AppRole);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('body')}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            create
              .mutateAsync({
                displayName: form.name.trim(),
                email: form.email.trim(),
                department: form.team.trim() || null,
                appRole,
                invite: canInvite && !!appRole && form.invite,
                language: locale,
              })
              .then(
                (person) => {
                  toast.success(
                    person.invited
                      ? t('addedInvited', { name: person.displayName })
                      : t('added', { name: person.displayName }),
                  );
                  onClose();
                },
                (error: unknown) => toast.error(errorText(error)),
              );
          }}
        >
          <Field id={`${id}-name`} label={t('name')}>
            <Input
              id={`${id}-name`}
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              maxLength={200}
              required
              autoComplete="off"
            />
          </Field>
          <Field id={`${id}-email`} label={t('email')}>
            <Input
              id={`${id}-email`}
              type="email"
              value={form.email}
              onChange={(e) => set({ email: e.target.value })}
              maxLength={320}
              required
              autoComplete="off"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id={`${id}-team`} label={t('team')}>
              <Input
                id={`${id}-team`}
                list={`${id}-teams`}
                value={form.team}
                onChange={(e) => set({ team: e.target.value })}
                maxLength={100}
              />
              <datalist id={`${id}-teams`}>
                {teams.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </Field>
            <Field id={`${id}-role`} label={t('role')}>
              <Select value={form.role} onValueChange={(role) => set({ role })}>
                <SelectTrigger id={`${id}-role`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APP_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {tRole(role)}
                    </SelectItem>
                  ))}
                  <SelectItem value={NONE}>{t('noRole')}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">{t('roleHint')}</p>
          {canInvite && appRole && (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.invite} onCheckedChange={(invite) => set({ invite })} />
              {t('invite')}
            </label>
          )}
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {t('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Correct someone added by hand (people from Microsoft 365 change there). */
export function EditPersonDialog({
  person,
  onClose,
}: {
  person: DirectoryPerson;
  onClose: () => void;
}) {
  const t = useTranslations('admin.add');
  const update = useUpdatePerson();
  const id = useId();
  const [name, setName] = useState(person.displayName);
  const [email, setEmail] = useState(person.email);
  const [jobTitle, setJobTitle] = useState(person.jobTitle ?? '');
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('editTitle', { name: person.displayName })}</DialogTitle>
          <DialogDescription>{t('editBody')}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            update
              .mutateAsync({
                id: person.id,
                displayName: name.trim(),
                ...(email.trim().toLowerCase() !== person.email.toLowerCase() && {
                  email: email.trim(),
                }),
                jobTitle: jobTitle.trim() || null,
              })
              .then(
                () => {
                  toast.success(t('saved'));
                  onClose();
                },
                (error: unknown) => toast.error(errorText(error)),
              );
          }}
        >
          <Field id={`${id}-name`} label={t('name')}>
            <Input
              id={`${id}-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              required
            />
          </Field>
          <Field id={`${id}-email`} label={t('email')}>
            <Input
              id={`${id}-email`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={320}
              required
            />
          </Field>
          <Field id={`${id}-job`} label={t('jobTitle')}>
            <Input
              id={`${id}-job`}
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              maxLength={200}
            />
          </Field>
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
