'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  messageProblem,
  nextSendSlot,
  wordCount,
  LEAD_CHANNELS,
  LEAD_LANGUAGES,
  LEAD_STATUSES,
  SEND_ALL_MAX,
  type LeadMessageKind,
  type NextStep,
} from '@seatline/shared/dist/outreach';
import { Copy, Plus, Send, SendHorizontal, Trash2, Upload } from 'lucide-react';
import { notFound, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
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
/** One tab per step, in the order a lead goes through them. */
const STEPS: NextStep[] = [
  'research',
  'write_first',
  'scheduled',
  'waiting',
  'follow_up_due',
  'talk',
  'done',
];
type Tab = NextStep | 'all';
/** Each step's colour (dot, badge, tab), from the app's tokens. */
const TONE: Record<NextStep, string> = {
  research: 'var(--seat-taken-stroke)',
  write_first: 'var(--primary)',
  scheduled: 'var(--team-3)',
  waiting: 'var(--seat-reserved-stroke)',
  follow_up_due: 'var(--destructive)',
  talk: 'var(--seat-free-stroke)',
  done: 'var(--muted-foreground)',
};
/** "Send now" and the send-all buttons: green, so sending stands apart from scheduling. */
const sendClass =
  'border-transparent bg-[var(--seat-free-fill)] text-[var(--seat-free-text)] hover:bg-[color-mix(in_oklab,var(--seat-free-fill),var(--seat-free-stroke)_20%)]';
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
  const [tab, setTab] = useState<Tab>('all');
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
  // look in the mailbox for replies and out-of-office answers each time the page opens
  const qc = useQueryClient();
  useEffect(() => {
    if (!data?.repliesChecked) return;
    void api<{ replied: number; autoReplies: number }>('/owner/leads/check-replies', {
      method: 'POST',
    })
      .then((r) => {
        if (r.replied || r.autoReplies) void qc.invalidateQueries({ queryKey: ['owner'] });
      })
      .catch(() => undefined);
  }, [data?.repliesChecked, qc]);
  const inTab = (l: LeadRow, t: Tab) => t === 'all' || l.nextStep === t;
  const shown = data?.leads.filter((l) => inTab(l, tab));

  return (
    <PageFrame
      title={t('title')}
      wide
      actions={
        <>
          <ImportLeads />
          <Button onClick={() => open('new')}>
            <Plus aria-hidden /> {t('add')}
          </Button>
        </>
      }
    >
      <OwnerNav current="leads" />
      <div className="grid gap-1 text-sm text-muted-foreground">
        <p>{t('rules')}</p>
        {data && !data.mailReady && <p className="text-destructive">{t('mailOff')}</p>}
        {data && !data.repliesChecked && <p>{t('repliesOff')}</p>}
      </div>
      {data && <SendAll leads={data.leads} mailReady={data.mailReady} />}
      <div className="flex flex-wrap gap-1 border-b pb-2" role="group" aria-label={t('tabs.label')}>
        {(['all', ...STEPS] as Tab[]).map((f) => {
          const count = data?.leads.filter((l) => inTab(l, f)).length;
          return (
            <Button
              key={f}
              size="sm"
              variant={f === tab ? 'secondary' : 'ghost'}
              aria-pressed={f === tab}
              onClick={() => setTab(f)}
              className={cn(f !== tab && !count && 'opacity-60')}
            >
              {f !== 'all' && (
                <span className="size-2 rounded-full" style={{ background: TONE[f] }} aria-hidden />
              )}
              {t(`tabs.${f}`)}
              {data && <span className="text-muted-foreground tabular-nums">{count}</span>}
            </Button>
          );
        })}
      </div>
      {!shown ? (
        <Skeleton className="h-64" />
      ) : !data?.leads.length ? (
        <p className="rounded-xl border p-6 text-sm text-muted-foreground">{t('empty')}</p>
      ) : !shown.length ? (
        <p className="rounded-xl border p-6 text-sm text-muted-foreground">{t('tabs.empty')}</p>
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
                    {lead.autoReplyAt && (
                      <Badge
                        variant="outline"
                        className="ml-2 font-normal"
                        title={lead.autoReplySubject ?? undefined}
                      >
                        {t('autoReply.badge')}
                      </Badge>
                    )}
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
  const tone = TONE[lead.nextStep];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: `color-mix(in oklab, ${tone} 14%, transparent)` }}
    >
      <span className="size-2 shrink-0 rounded-full" style={{ background: tone }} aria-hidden />
      {t(`next.${lead.nextStep}`, { when: lead.scheduledFor ? when(lead.scheduledFor) : '' })}
    </span>
  );
}

/**
 * "Send all": the scheduled e-mails now, or the filled-in first e-mail to every ready lead.
 * Still one e-mail per lead; each asks once, naming how many go out.
 */
function SendAll({ leads, mailReady }: { leads: LeadRow[]; mailReady: boolean }) {
  const t = useTranslations('owner.leads');
  const qc = useQueryClient();
  const [ask, setAsk] = useState<'scheduled' | 'ready' | null>(null);
  const counts = {
    scheduled: leads.filter((l) => l.nextStep === 'scheduled').length,
    ready: leads.filter((l) => l.nextStep === 'write_first' && l.channel === 'email').length,
  };
  const send = useMutation({
    mutationFn: (what: 'scheduled' | 'ready') =>
      api<{ done: number; failed: string[] }>(`/owner/leads/send-${what}`, { method: 'POST' }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['owner'] });
      toast.success(t('sendAll.done', { count: r.done }), {
        description: r.failed.length
          ? t('sendAll.failed', { names: r.failed.join(', ') })
          : undefined,
      });
    },
    onError: (error) => toast.error(t('failed', { message: failedMessage(error) })),
  });
  if (!counts.scheduled && !counts.ready) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {counts.ready > 0 && <WriteAll leads={leads} />}
      {(['scheduled', 'ready'] as const).map(
        (what) =>
          counts[what] > 0 && (
            <Button
              key={what}
              // ready = write + send (blue, like writing); scheduled = only sending (green)
              variant={what === 'ready' ? 'default' : 'outline'}
              className={what === 'scheduled' ? sendClass : undefined}
              disabled={!mailReady || send.isPending}
              onClick={() => setAsk(what)}
            >
              <SendHorizontal aria-hidden /> {t(`sendAll.${what}`, { count: counts[what] })}
            </Button>
          ),
      )}
      <AlertDialog open={!!ask} onOpenChange={(o) => !o && setAsk(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>{ask && t(`sendAll.${ask}`, { count: counts[ask] })}</AlertDialogTitle>
          <AlertDialogDescription>
            {ask && t(`sendAll.${ask}Confirm`, { count: Math.min(counts[ask], SEND_ALL_MAX) })}
            {ask && counts[ask] > SEND_ALL_MAX && ` ${t('sendAll.more', { max: SEND_ALL_MAX })}`}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('keep')}</AlertDialogCancel>
            <AlertDialogAction className={sendClass} onClick={() => ask && send.mutate(ask)}>
              {t('compose.sendNow')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * "Write all": every lead waiting for its first e-mail, one after the other, its draft open to
 * read and change; Schedule moves on to the next. The rest can be scheduled as they are.
 */
function WriteAll({ leads }: { leads: LeadRow[] }) {
  const t = useTranslations('owner.leads');
  const when = useWhen();
  const qc = useQueryClient();
  const [queue, setQueue] = useState<LeadRow[] | null>(null);
  const [at, setAt] = useState(0);
  const [ask, setAsk] = useState(false);
  const ready = leads.filter((l) => l.nextStep === 'write_first' && l.channel === 'email');
  const current = queue?.[at];
  const lead = useQuery({
    queryKey: ['owner', 'lead', current?.id],
    queryFn: () => api<LeadDetail>(`/owner/leads/${current!.id}`),
    enabled: !!current,
  });
  const next = () => {
    void qc.invalidateQueries({ queryKey: ['owner', 'leads'] });
    setAt((i) => i + 1);
  };
  const scheduleRest = useMutation({
    mutationFn: () =>
      api<{ done: number; failed: string[] }>('/owner/leads/schedule-ready', { method: 'POST' }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['owner'] });
      toast.success(t('writeAll.scheduled', { count: r.done }), {
        description: r.failed.length
          ? t('sendAll.failed', { names: r.failed.join(', ') })
          : undefined,
      });
      setQueue(null);
    },
    onError: (error) => toast.error(t('failed', { message: failedMessage(error) })),
  });
  // what the server schedules: every lead still waiting for its first e-mail (skipped ones too)
  const rest = ready.length;
  return (
    <>
      <Button
        onClick={() => {
          setQueue(ready);
          setAt(0);
        }}
      >
        <Send aria-hidden /> {t('writeAll.open', { count: ready.length })}
      </Button>
      <Sheet open={!!queue} onOpenChange={(o) => !o && setQueue(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-2xl">
          <div className="grid gap-4 p-6 pt-12">
            <SheetTitle>{t('writeAll.title')}</SheetTitle>
            {queue && current ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground tabular-nums">
                    {t('writeAll.progress', { n: at + 1, total: queue.length })}
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setAt((i) => i + 1)}>
                      {t('writeAll.skip')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={scheduleRest.isPending}
                      onClick={() => setAsk(true)}
                    >
                      {t('writeAll.scheduleRest', { count: rest })}
                    </Button>
                  </div>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div
                    className="h-full bg-primary transition-[width] duration-300"
                    style={{ width: `${(at / queue.length) * 100}%` }}
                  />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{current.company}</h3>
                  <p className="text-sm text-muted-foreground">
                    {current.contactName ?? current.greeting} · {current.contactEmail}
                  </p>
                </div>
                {lead.data?.id === current.id ? (
                  <Composer
                    key={current.id}
                    lead={lead.data}
                    kind="first"
                    autoStart
                    onScheduled={next}
                  />
                ) : (
                  <Skeleton className="h-96" />
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('writeAll.done', { when: when(nextSendSlot(new Date())) })}
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
      <AlertDialog open={ask} onOpenChange={setAsk}>
        <AlertDialogContent>
          <AlertDialogTitle>{t('writeAll.scheduleRest', { count: rest })}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('writeAll.scheduleRestConfirm', {
              count: rest,
              when: when(nextSendSlot(new Date())),
            })}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('keep')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => scheduleRest.mutate()}>
              {t('compose.schedule')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
  const sendNow = useMutation({
    mutationFn: (messageId: string) =>
      api(`/owner/leads/${id}/messages/${messageId}/send`, { method: 'POST' }),
    onSuccess: () => {
      refresh();
      toast.success(t('compose.sent'));
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

      {lead.autoReplyAt && (
        <p className="rounded-lg border bg-muted/40 p-3 text-sm">
          {t('autoReply.note', { when: when(lead.autoReplyAt) })}
          {lead.autoReplySubject && (
            <span className="mt-1 block text-muted-foreground">“{lead.autoReplySubject}”</span>
          )}
        </p>
      )}
      {pending && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
          <span>
            {t(`kind.${pending.kind}`)} · {t('scheduledFor', { when: when(pending.scheduledFor) })}
          </span>
          <div className="flex gap-2">
            <SendNowButton
              to={pending.toAddress}
              size="sm"
              disabled={sendNow.isPending}
              onConfirm={() => sendNow.mutate(pending.id)}
            />
            <Button
              size="sm"
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => cancel.mutate(pending.id)}
            >
              {t('compose.cancel')}
            </Button>
          </div>
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
  autoStart = false,
}: {
  lead: LeadDetail;
  kind: LeadMessageKind;
  onScheduled: () => void;
  /** open the draft right away ("Write all", one lead after the other) */
  autoStart?: boolean;
}) {
  const t = useTranslations('owner.leads');
  const when = useWhen();
  const [writing, setWriting] = useState(autoStart);
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
    mutationFn: (sendNow: boolean) =>
      api<LeadMessage>(`/owner/leads/${lead.id}/messages`, {
        method: 'POST',
        body: { kind, subject, body, sendNow },
      }),
    onSuccess: (m) => {
      toast.success(
        m.sentAt ? t('compose.sent') : t('compose.scheduled', { when: when(m.scheduledFor) }),
      );
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
        <p className="text-xs text-muted-foreground tabular-nums" data-testid="word-count">
          {t('compose.words', { count: words })}
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
              {t(`problems.${problem}`)}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              disabled={!!problem || !subject.trim() || schedule.isPending}
              onClick={() => schedule.mutate(false)}
            >
              <Send aria-hidden /> {t('compose.schedule')}
            </Button>
            <SendNowButton
              to={lead.contactEmail ?? ''}
              disabled={!!problem || !subject.trim() || schedule.isPending}
              onConfirm={() => schedule.mutate(true)}
            />
            <span className="text-xs text-muted-foreground">
              {t('compose.scheduleHint', { when: when(nextSendSlot(new Date())) })}
            </span>
          </div>
        </>
      )}
    </section>
  );
}

/** Sending can't be undone: one confirmation, naming the address. */
function SendNowButton({
  to,
  disabled,
  size,
  onConfirm,
}: {
  to: string;
  disabled: boolean;
  size?: 'sm';
  onConfirm: () => void;
}) {
  const t = useTranslations('owner.leads');
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        size={size}
        className={sendClass}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {t('compose.sendNow')}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>{t('compose.sendNow')}</AlertDialogTitle>
          <AlertDialogDescription>{t('compose.sendNowConfirm', { to })}</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('keep')}</AlertDialogCancel>
            <AlertDialogAction className={sendClass} onClick={onConfirm}>
              {t('compose.sendNow')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** The fields a lead file may carry (anything else, e.g. a status, is left out). */
const IMPORT_FIELDS = [
  'company',
  'website',
  'address',
  'whyNow',
  'sourceUrl',
  'contactName',
  'greeting',
  'contactRole',
  'channel',
  'contactEmail',
  'linkedinUrl',
  'language',
  'notes',
] as const;

/** Researched leads from a JSON file (a list, or { leads: [...] }); they start as "Research". */
function ImportLeads() {
  const t = useTranslations('owner.leads');
  const client = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: async (file: File) => {
      let rows: unknown;
      try {
        const parsed: unknown = JSON.parse(await file.text());
        rows = Array.isArray(parsed) ? parsed : (parsed as { leads?: unknown }).leads;
      } catch {
        rows = null;
      }
      if (!Array.isArray(rows)) throw new Error(t('importInvalid'));
      const leads = rows.map((row: Record<string, unknown>) =>
        Object.fromEntries(IMPORT_FIELDS.filter((k) => row[k] != null).map((k) => [k, row[k]])),
      );
      return api<{ added: number; skipped: string[] }>('/owner/leads/import', {
        method: 'POST',
        body: { leads },
      });
    },
    onSuccess: (r) => {
      void client.invalidateQueries({ queryKey: ['owner', 'leads'] });
      toast.success(t('imported', { count: r.added }), {
        description: r.skipped.length
          ? t('importSkipped', { count: r.skipped.length, names: r.skipped.join(', ') })
          : undefined,
      });
    },
    onError: (e) =>
      toast.error(e instanceof ApiError && e.status === 400 ? t('importInvalid') : e.message),
  });
  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) upload.mutate(file);
        }}
      />
      <Button variant="outline" disabled={upload.isPending} onClick={() => input.current?.click()}>
        <Upload aria-hidden /> {t('import')}
      </Button>
    </>
  );
}
