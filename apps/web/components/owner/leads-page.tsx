'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MAX_WORDS,
  messageProblem,
  nextSendSlot,
  wordCount,
  LEAD_CHANNELS,
  LEAD_LANGUAGES,
  LEAD_STATUSES,
  type LeadMessageKind,
  type NextStep,
} from '@seatline/shared/dist/outreach';
import { Copy, Plus, Send, Trash2 } from 'lucide-react';
import { notFound, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageFrame } from '@/components/common/page-frame';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api';
import type { Lead, LeadList, LeadMessage, LeadRow } from '@/lib/types';
import { cn } from '@/lib/utils';
import { OwnerNav } from './owner-nav';

type LeadDetail = Lead & { messages: LeadMessage[] };
type Filter = 'todo' | 'waiting' | 'done' | 'all';
const FILTERS: Record<Filter, NextStep[] | null> = {
  todo: ['research', 'write_first', 'follow_up_due', 'talk'],
  waiting: ['scheduled', 'waiting'],
  done: ['done'],
  all: null,
};
const TEXT_FIELDS = [
  'company',
  'whyNow',
  'greeting',
  'contactName',
  'contactRole',
  'contactEmail',
  'address',
  'website',
  'linkedinUrl',
  'sourceUrl',
] as const;
type Draft = Partial<Record<(typeof TEXT_FIELDS)[number] | 'notes', string>> &
  Pick<Lead, 'channel' | 'language'>;
const textareaClass =
  'w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30';
const selectClass = cn(textareaClass, 'h-9 py-1');

/** The `when` of a send slot or a sent e-mail, in Zurich time. */
function useWhen() {
  const format = useFormatter();
  return (iso: string | Date) =>
    format.dateTime(new Date(iso), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Zurich',
    });
}

/** A toast with the server's reason. */
const failedMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * The operator's outreach: possible customers, what to do next with each, and one personal
 * e-mail at a time (scheduled for Tuesday–Thursday, 8 am; a reply stops what's scheduled).
 */
export function LeadsPage({ initial }: { initial: LeadList | null }) {
  const t = useTranslations('owner.leads');
  const when = useWhen();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selected = params.get('lead');
  const [filter, setFilter] = useState<Filter>('todo');
  const query = useQuery({
    queryKey: ['owner', 'leads'],
    queryFn: () => api<LeadList>('/owner/leads'),
    initialData: initial ?? undefined,
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
  });
  if (query.error instanceof ApiError && query.error.status === 404) notFound();
  const open = (id: string | null) =>
    router.replace(id ? `${pathname}?lead=${id}` : pathname, { scroll: false });
  const data = query.data;
  const shown = data?.leads.filter((l) => !FILTERS[filter] || FILTERS[filter].includes(l.nextStep));

  return (
    <PageFrame
      title={t('title')}
      wide
      actions={
        <Button onClick={() => open('new')}>
          <Plus aria-hidden /> {t('add')}
        </Button>
      }
    >
      <OwnerNav current="leads" />
      <div className="grid gap-1 text-sm text-muted-foreground">
        <p>{t('rules')}</p>
        {data && !data.mailReady && <p className="text-destructive">{t('mailOff')}</p>}
        {data && !data.repliesChecked && <p>{t('repliesOff')}</p>}
      </div>
      <div className="flex flex-wrap gap-1" role="group" aria-label={t('columns.status')}>
        {(Object.keys(FILTERS) as Filter[]).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={f === filter ? 'secondary' : 'ghost'}
            aria-pressed={f === filter}
            onClick={() => setFilter(f)}
          >
            {t(`filters.${f}`)}
            {data && (
              <span className="text-muted-foreground tabular-nums">
                {data.leads.filter((l) => !FILTERS[f] || FILTERS[f].includes(l.nextStep)).length}
              </span>
            )}
          </Button>
        ))}
      </div>
      {!shown ? (
        <Skeleton className="h-64" />
      ) : !data?.leads.length ? (
        <p className="rounded-xl border p-6 text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm" data-testid="leads">
            <thead className="bg-canvas text-xs text-muted-foreground">
              <tr>
                {(['company', 'why', 'contact', 'status', 'next'] as const).map((c) => (
                  <th key={c} scope="col" className="px-3 py-2 font-medium">
                    {t(`columns.${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {shown.map((lead) => (
                <tr
                  key={lead.id}
                  className="cursor-pointer align-top hover:bg-muted/50"
                  onClick={() => open(lead.id)}
                >
                  <td className="px-3 py-2 font-medium">
                    <button
                      type="button"
                      className="text-left hover:underline"
                      onClick={() => open(lead.id)}
                    >
                      {lead.company}
                    </button>
                  </td>
                  <td className="max-w-xs px-3 py-2 text-muted-foreground">
                    <span className="line-clamp-2">{lead.whyNow}</span>
                  </td>
                  <td className="px-3 py-2">
                    {lead.contactName ?? lead.greeting}
                    {lead.contactRole && (
                      <span className="block text-xs text-muted-foreground">
                        {lead.contactRole}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary">{t(`status.${lead.status}`)}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <NextStepLabel lead={lead} when={when} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Sheet open={!!selected} onOpenChange={(o) => !o && open(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-2xl">
          <SheetTitle className="sr-only">{t('title')}</SheetTitle>
          {selected === 'new' ? (
            <NewLead onCreated={open} />
          ) : (
            selected && <LeadPanel key={selected} id={selected} onDeleted={() => open(null)} />
          )}
        </SheetContent>
      </Sheet>
    </PageFrame>
  );
}

function NextStepLabel({ lead, when }: { lead: LeadRow; when: (d: string) => string }) {
  const t = useTranslations('owner.leads');
  const due = lead.nextStep === 'follow_up_due';
  return (
    <span className={cn(due && 'font-medium text-destructive')}>
      {t(`next.${lead.nextStep}`, { when: lead.scheduledFor ? when(lead.scheduledFor) : '' })}
    </span>
  );
}

function NewLead({ onCreated }: { onCreated: (id: string) => void }) {
  const t = useTranslations('owner.leads');
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: (draft: Draft) => api<Lead>('/owner/leads', { method: 'POST', body: draft }),
    onSuccess: (lead) => {
      void qc.invalidateQueries({ queryKey: ['owner', 'leads'] });
      toast.success(t('created'));
      onCreated(lead.id);
    },
    onError: (error) => toast.error(t('failed', { message: failedMessage(error) })),
  });
  return (
    <div className="grid gap-4 p-6 pt-12">
      <h2 className="text-lg font-semibold">{t('add')}</h2>
      <LeadForm
        initial={{ channel: 'email', language: 'de' }}
        busy={create.isPending}
        submitLabel={t('create')}
        onSubmit={(d) => create.mutate(d)}
      />
    </div>
  );
}

function LeadForm({
  initial,
  busy,
  submitLabel,
  onSubmit,
}: {
  initial: Draft;
  busy: boolean;
  submitLabel: string;
  onSubmit: (draft: Draft) => void;
}) {
  const t = useTranslations('owner.leads');
  const [draft, setDraft] = useState<Draft>(initial);
  const set = (k: keyof Draft, v: string) => setDraft((d) => ({ ...d, [k]: v }));
  const hints: Partial<Record<keyof Draft, string>> = {
    whyNow: t('fields.whyNowHint'),
    greeting: t('fields.greetingHint'),
    contactEmail: t('fields.contactEmailHint'),
  };
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(draft);
      }}
    >
      {TEXT_FIELDS.map((k) => (
        <div key={k} className={cn('grid gap-1', k === 'whyNow' && 'sm:col-span-2')}>
          <Label htmlFor={`lead-${k}`}>{t(`fields.${k}`)}</Label>
          {k === 'whyNow' ? (
            <textarea
              id={`lead-${k}`}
              rows={2}
              className={textareaClass}
              value={draft[k] ?? ''}
              onChange={(e) => set(k, e.target.value)}
              maxLength={500}
            />
          ) : (
            <Input
              id={`lead-${k}`}
              type={k === 'contactEmail' ? 'email' : 'text'}
              value={draft[k] ?? ''}
              onChange={(e) => set(k, e.target.value)}
              required={k === 'company'}
              maxLength={k === 'company' ? 200 : 1000}
            />
          )}
          {hints[k] && <p className="text-xs text-muted-foreground">{hints[k]}</p>}
        </div>
      ))}
      <div className="grid gap-1">
        <Label htmlFor="lead-channel">{t('fields.channel')}</Label>
        <select
          id="lead-channel"
          className={selectClass}
          value={draft.channel}
          onChange={(e) => set('channel', e.target.value)}
        >
          {LEAD_CHANNELS.map((c) => (
            <option key={c} value={c}>
              {t(`channels.${c}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1">
        <Label htmlFor="lead-language">{t('fields.language')}</Label>
        <select
          id="lead-language"
          className={selectClass}
          value={draft.language}
          onChange={(e) => set('language', e.target.value)}
        >
          {LEAD_LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {t(`languages.${l}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1 sm:col-span-2">
        <Label htmlFor="lead-notes">{t('fields.notes')}</Label>
        <textarea
          id="lead-notes"
          rows={3}
          className={textareaClass}
          value={draft.notes ?? ''}
          onChange={(e) => set('notes', e.target.value)}
          maxLength={4000}
        />
      </div>
      <Button
        type="submit"
        disabled={busy || !draft.company?.trim()}
        className="justify-self-start"
      >
        {submitLabel}
      </Button>
    </form>
  );
}

function LeadPanel({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const t = useTranslations('owner.leads');
  const when = useWhen();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const query = useQuery({
    queryKey: ['owner', 'lead', id],
    queryFn: () => api<LeadDetail>(`/owner/leads/${id}`),
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['owner', 'lead', id] });
    void qc.invalidateQueries({ queryKey: ['owner', 'leads'] });
  };
  const save = useMutation({
    mutationFn: (body: Partial<Draft> | { status: Lead['status'] }) =>
      api<Lead>(`/owner/leads/${id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      refresh();
      toast.success(t('saved'));
    },
    onError: (error) => toast.error(t('failed', { message: failedMessage(error) })),
  });
  const remove = useMutation({
    mutationFn: () => api(`/owner/leads/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['owner', 'leads'] });
      toast.success(t('deleted'));
      onDeleted();
    },
    onError: (error) => toast.error(t('failed', { message: failedMessage(error) })),
  });
  const cancel = useMutation({
    mutationFn: (messageId: string) =>
      api(`/owner/leads/${id}/messages/${messageId}`, { method: 'DELETE' }),
    onSuccess: () => {
      refresh();
      toast.success(t('compose.canceled'));
    },
    onError: (error) => toast.error(t('failed', { message: failedMessage(error) })),
  });
  const lead = query.data;
  if (!lead) return <Skeleton className="m-6 mt-12 h-96" />;

  const live = lead.messages.filter((m) => !m.canceledAt);
  const pending = live.find((m) => !m.sentAt);
  const first = live.find((m) => m.kind === 'first');
  const closed = ['replied', 'meeting', 'customer', 'no', 'no_answer'].includes(lead.status);
  const kind: LeadMessageKind | null =
    pending || closed
      ? null
      : lead.channel !== 'email'
        ? // reached by hand (form, LinkedIn): the text to copy follows the status
          lead.status === 'sent'
          ? 'follow_up'
          : lead.status === 'followed_up'
            ? null
            : 'first'
        : !first
          ? 'first'
          : first.sentAt && !live.some((m) => m.kind === 'follow_up')
            ? 'follow_up'
            : null;

  return (
    <div className="grid gap-6 p-6 pt-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{lead.company}</h2>
        <div className="flex items-center gap-2">
          <Label htmlFor="lead-status" className="sr-only">
            {t('fields.status')}
          </Label>
          <select
            id="lead-status"
            className={cn(selectClass, 'w-auto')}
            value={lead.status}
            onChange={(e) => save.mutate({ status: e.target.value as Lead['status'] })}
          >
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </select>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('delete')}
            onClick={() => setConfirm(true)}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      {pending && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
          <span>
            {t(`kind.${pending.kind}`)} · {t('scheduledFor', { when: when(pending.scheduledFor) })}
          </span>
          <Button size="sm" variant="outline" onClick={() => cancel.mutate(pending.id)}>
            {t('compose.cancel')}
          </Button>
        </div>
      )}
      {kind && <Composer lead={lead} kind={kind} onScheduled={refresh} />}

      {lead.messages.length > 0 && (
        <section className="grid gap-2">
          <h3 className="font-medium">{t('messages')}</h3>
          <ol className="grid gap-2">
            {lead.messages.map((m) => (
              <li key={m.id} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{t(`kind.${m.kind}`)}</span>
                  <span>
                    {m.canceledAt
                      ? t('canceledMsg')
                      : m.sentAt
                        ? t('sentAt', { when: when(m.sentAt) })
                        : t('scheduledFor', { when: when(m.scheduledFor) })}
                  </span>
                </div>
                <details className="mt-1">
                  <summary className="cursor-pointer">{m.subject}</summary>
                  <p className="mt-2 whitespace-pre-line text-muted-foreground">{m.body}</p>
                </details>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="grid gap-3">
        <LeadForm
          key={lead.updatedAt}
          initial={{
            ...Object.fromEntries(TEXT_FIELDS.map((k) => [k, lead[k] ?? ''])),
            notes: lead.notes ?? '',
            channel: lead.channel,
            language: lead.language,
          }}
          busy={save.isPending}
          submitLabel={t('save')}
          onSubmit={(d) => save.mutate(d)}
        />
      </section>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogTitle>{t('delete')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('deleteConfirm', { company: lead.company })}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('keep')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate()}>{t('delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Writing one e-mail: starts from the filled-in template, must stay personal and short. */
function Composer({
  lead,
  kind,
  onScheduled,
}: {
  lead: LeadDetail;
  kind: LeadMessageKind;
  onScheduled: () => void;
}) {
  const t = useTranslations('owner.leads');
  const when = useWhen();
  const [writing, setWriting] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const draft = useQuery({
    queryKey: ['owner', 'lead', lead.id, 'draft', kind, lead.updatedAt],
    queryFn: () =>
      api<{ subject: string; body: string }>(`/owner/leads/${lead.id}/draft?kind=${kind}`),
    enabled: writing,
  });
  useEffect(() => {
    if (draft.data) {
      setSubject(draft.data.subject);
      setBody(draft.data.body);
    }
  }, [draft.data]);
  const schedule = useMutation({
    mutationFn: () =>
      api<LeadMessage>(`/owner/leads/${lead.id}/messages`, {
        method: 'POST',
        body: { kind, subject, body },
      }),
    onSuccess: (m) => {
      toast.success(t('compose.scheduled', { when: when(m.scheduledFor) }));
      setWriting(false);
      onScheduled();
    },
    onError: (error) => toast.error(t('failed', { message: failedMessage(error) })),
  });

  if (!writing)
    return (
      <Button className="justify-self-start" onClick={() => setWriting(true)}>
        <Send aria-hidden /> {t(`compose.${kind}`)}
      </Button>
    );
  const words = wordCount(body);
  const manual = lead.channel !== 'email';
  const problem = messageProblem(lead, body);
  return (
    <section className="grid gap-3 rounded-xl border p-4" aria-label={t(`compose.${kind}`)}>
      <div className="grid gap-1">
        <Label htmlFor="compose-subject">{t('compose.subject')}</Label>
        <Input
          id="compose-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="compose-body">{t('compose.body')}</Label>
        <textarea
          id="compose-body"
          rows={16}
          className={textareaClass}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <p
          className={cn(
            'text-xs tabular-nums',
            words > MAX_WORDS ? 'font-medium text-destructive' : 'text-muted-foreground',
          )}
          data-testid="word-count"
        >
          {t('compose.words', { count: String(words), max: String(MAX_WORDS) })}
        </p>
      </div>
      {manual ? (
        <>
          <p className="text-sm text-muted-foreground">
            {t('compose.manualHint', { channel: t(`channels.${lead.channel}`) })}
          </p>
          <Button
            variant="outline"
            className="justify-self-start"
            onClick={() =>
              void navigator.clipboard
                .writeText(`${subject}\n\n${body}`)
                .then(() => toast.success(t('compose.copied')))
            }
          >
            <Copy aria-hidden /> {t('compose.copy')}
          </Button>
        </>
      ) : (
        <>
          {problem && (
            <p className="text-sm text-destructive" role="status">
              {t(`problems.${problem}`, { max: String(MAX_WORDS) })}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              disabled={!!problem || !subject.trim() || schedule.isPending}
              onClick={() => schedule.mutate()}
            >
              <Send aria-hidden /> {t('compose.schedule')}
            </Button>
            <span className="text-xs text-muted-foreground">
              {t('compose.scheduleHint', { when: when(nextSendSlot(new Date())) })}
            </span>
          </div>
        </>
      )}
    </section>
  );
}
