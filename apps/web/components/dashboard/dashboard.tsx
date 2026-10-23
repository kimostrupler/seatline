'use client';

import { WIDGET_TYPES, type Widget, type WidgetSize, type WidgetType } from '@seatline/shared';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Ellipsis,
  GripVertical,
  LayoutGrid,
  Plus,
  RotateCcw,
  Save,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useNow, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ExportMenu } from '@/components/common/export-menu';
import { PageFrame } from '@/components/common/page-frame';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { addWidget, canSee, moveWidget, removeWidget, resizeWidget, SPAN } from '@/lib/dashboard';
import { useDashboard, useDashboardActions, useMe } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { GettingStarted } from './getting-started';
import { HelpBanner } from './help-banner';
import { WIDGET_ICONS, WIDGET_LINKS, WidgetBody } from './widgets';

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Home: a grid of widgets everyone can arrange for themselves ("Customize"). */
export function Dashboard() {
  const t = useTranslations('dashboard');
  const me = useMe().data;
  const dashboard = useDashboard();
  const actions = useDashboardActions();
  // while customizing, changes stay local until "Done"
  const [draft, setDraft] = useState<Widget[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  const editing = draft !== null;
  const widgets = (draft ?? dashboard.data?.widgets ?? []).filter((w) => canSee(w.type, me?.role));
  // indices refer to the full list (hidden widgets keep their place)
  const all = draft ?? [];
  const indexOf = (id: string) => all.findIndex((w) => w.id === id);

  const finish = () =>
    actions.save.mutateAsync(draft!).then(
      () => {
        setDraft(null);
        toast.success(t('saved'));
      },
      (e: unknown) => toast.error(errorText(e)),
    );

  return (
    <PageFrame
      wide
      title={<Greeting name={me?.person.displayName} company={me?.tenant.name} />}
      actions={
        editing ? (
          <>
            <Button variant="outline" onClick={() => setAdding(true)}>
              <Plus /> {t('addWidget')}
            </Button>
            {me?.role === 'admin' && (
              <Button
                variant="outline"
                onClick={() =>
                  actions.saveDefault.mutateAsync(draft).then(
                    () => toast.success(t('defaultSaved')),
                    (e: unknown) => toast.error(errorText(e)),
                  )
                }
              >
                <Save /> {t('saveAsDefault')}
              </Button>
            )}
            {dashboard.data?.source === 'personal' && (
              <Button
                variant="ghost"
                onClick={() =>
                  actions.reset.mutateAsync().then(
                    (d) => {
                      setDraft(null);
                      toast.success(
                        d.source === 'company' ? t('resetToCompany') : t('resetToBuiltin'),
                      );
                    },
                    (e: unknown) => toast.error(errorText(e)),
                  )
                }
              >
                <RotateCcw /> {t('reset')}
              </Button>
            )}
            <Button variant="ghost" onClick={() => setDraft(null)}>
              {t('cancel')}
            </Button>
            <Button onClick={finish} disabled={actions.save.isPending}>
              <Check /> {t('done')}
            </Button>
          </>
        ) : (
          <>
            {/* the seating list etc. (Home replaced the separate Overview page) */}
            <ExportMenu />
            <Button
              variant="outline"
              onClick={() => setDraft(dashboard.data?.widgets ?? [])}
              disabled={!dashboard.data}
            >
              <LayoutGrid /> {t('customize')}
            </Button>
          </>
        )
      }
    >
      {editing && <p className="-mt-4 text-sm text-muted-foreground">{t('customizeHint')}</p>}
      {!editing && me?.role === 'admin' && !me.tenant.isDemo && (
        <GettingStarted tenantId={me.tenant.id} />
      )}
      {!editing && <HelpBanner />}
      {!dashboard.data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-40 md:col-span-2" />
          <Skeleton className="h-40 md:col-span-2" />
        </div>
      ) : widgets.length === 0 ? (
        <div className="grid justify-items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
          <Button
            variant="outline"
            onClick={() => {
              setDraft(draft ?? dashboard.data!.widgets);
              setAdding(true);
            }}
          >
            <Plus /> {t('addWidget')}
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" data-testid="dashboard">
          {widgets.map((w, i) => (
            <WidgetCard
              key={w.id}
              widget={w}
              editing={editing}
              first={i === 0}
              last={i === widgets.length - 1}
              dragging={dragging === indexOf(w.id)}
              onMove={(delta) => {
                // step over hidden widgets: move next to the visible neighbour
                const neighbour = widgets[i + delta];
                if (neighbour) setDraft(moveWidget(all, indexOf(w.id), indexOf(neighbour.id)));
              }}
              onResize={(size) => setDraft(resizeWidget(all, w.id, size))}
              onRemove={() => setDraft(removeWidget(all, w.id))}
              onDragStart={() => setDragging(indexOf(w.id))}
              onDragEnd={() => setDragging(null)}
              onDrop={() => {
                if (dragging !== null) setDraft(moveWidget(all, dragging, indexOf(w.id)));
                setDragging(null);
              }}
              highlight={w.id === justAdded}
            />
          ))}
        </div>
      )}
      <AddWidgetDialog
        open={adding}
        onClose={() => setAdding(false)}
        present={new Set(all.map((w) => w.type))}
        onAdd={(type) => {
          const id = crypto.randomUUID();
          setDraft(addWidget(all, type, () => id));
          setAdding(false);
          setJustAdded(id);
          toast.success(t('addedWidget', { name: t(`widgets.${type}.title`) }));
          setTimeout(() => setJustAdded((current) => (current === id ? null : current)), 2500);
        }}
      />
    </PageFrame>
  );
}

function Greeting({ name, company }: { name?: string; company?: string }) {
  const t = useTranslations('dashboard');
  const now = useNow({ updateInterval: 60_000 });
  const hour = now.getHours();
  const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  const first = name?.split(' ')[0];
  return (
    <span className="grid gap-0.5">
      <span>{first ? t(`greeting.${part}`, { name: first }) : t('title')}</span>
      {company && <span className="text-sm font-normal text-muted-foreground">{company}</span>}
    </span>
  );
}

const SIZES: WidgetSize[] = ['small', 'wide', 'full'];

function WidgetCard({
  widget,
  editing,
  first,
  last,
  dragging,
  onMove,
  onResize,
  onRemove,
  onDragStart,
  onDragEnd,
  onDrop,
  highlight,
}: {
  widget: Widget;
  editing: boolean;
  first: boolean;
  last: boolean;
  dragging: boolean;
  onMove: (delta: -1 | 1) => void;
  onResize: (size: WidgetSize) => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
  /** just added: scrolled into view and outlined for a moment */
  highlight?: boolean;
}) {
  const t = useTranslations('dashboard');
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (highlight) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlight]);
  const title = t(`widgets.${widget.type}.title`);
  const link = WIDGET_LINKS[widget.type];
  const Icon = WIDGET_ICONS[widget.type];
  const [over, setOver] = useState(false);
  return (
    <section
      aria-label={title}
      data-widget={widget.type}
      className={cn(
        'col-span-1 grid content-start gap-4 rounded-xl border bg-card p-5 shadow-xs',
        SPAN[widget.size],
        editing && 'border-dashed',
        dragging && 'opacity-40',
        over && 'ring-2 ring-ring',
        highlight && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
      )}
      ref={ref}
      draggable={editing}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        if (!editing) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onDrop();
      }}
    >
      <header className="flex min-h-8 items-center gap-1">
        {editing && (
          <GripVertical aria-hidden className="size-4 shrink-0 cursor-grab text-muted-foreground" />
        )}
        <span
          aria-hidden
          className="mr-1.5 grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"
        >
          <Icon className="size-4" />
        </span>
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h2>
        {editing ? (
          // all edit controls in one menu, so even a small widget's header stays tidy
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="size-8 shrink-0"
                aria-label={t('options', { name: title })}
              >
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem disabled={first} onSelect={() => onMove(-1)}>
                <ArrowLeft /> {t('moveEarlierShort')}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={last} onSelect={() => onMove(1)}>
                <ArrowRight /> {t('moveLaterShort')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                {t('sizeLabel')}
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={widget.size}
                onValueChange={(v) => onResize(v as WidgetSize)}
              >
                {SIZES.map((size) => (
                  <DropdownMenuRadioItem key={size} value={size}>
                    {t(`sizes.${size}`)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={onRemove}>
                <X /> {t('removeShort')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          link && (
            <Link href={link} className="shrink-0 text-xs text-muted-foreground hover:underline">
              {t('seeAll')}
            </Link>
          )
        )}
      </header>
      <WidgetBody type={widget.type} />
    </section>
  );
}

function AddWidgetDialog({
  open,
  onClose,
  present,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  present: Set<WidgetType>;
  onAdd: (type: WidgetType) => void;
}) {
  const t = useTranslations('dashboard');
  const role = useMe().data?.role;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogTitle>{t('addWidget')}</DialogTitle>
        <DialogDescription>{t('addWidgetHint')}</DialogDescription>
        <ul className="grid gap-2">
          {WIDGET_TYPES.filter((type) => canSee(type, role)).map((type) => (
            <li key={type}>
              <button
                type="button"
                onClick={() => onAdd(type)}
                className="grid w-full gap-0.5 rounded-lg border p-3 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="flex items-center justify-between gap-2 text-sm font-medium">
                  {t(`widgets.${type}.title`)}
                  {present.has(type) && (
                    <span className="text-xs font-normal text-muted-foreground">
                      {t('alreadyThere')}
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t(`widgets.${type}.description`)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
