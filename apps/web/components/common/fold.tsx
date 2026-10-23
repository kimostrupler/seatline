import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * A settings section that folds away: the title and what's set now are always visible, the
 * controls open on a tap. Keeps long settings pages short.
 */
export function Fold({
  title,
  summary,
  children,
  defaultOpen,
}: {
  title: string;
  /** one line: the current state ("2 years", "it@company.ch") */
  summary?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="group rounded-xl border bg-card" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-3.5 hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="font-semibold">{title}</span>
          {summary && <span className="truncate text-sm text-muted-foreground">{summary}</span>}
        </span>
        <ChevronDown
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground transition group-open:rotate-180"
        />
      </summary>
      <div className="grid gap-3 border-t px-4 pt-4 pb-5">{children}</div>
    </details>
  );
}
