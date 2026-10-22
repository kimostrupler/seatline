import { ChevronsUpDown } from 'lucide-react';

/** Company + "name · role" in the top bar; on phones just the person's initials. */
export function WhoAmI({
  company,
  person,
  line,
}: {
  company: string;
  person?: string;
  line: string;
}) {
  const initials = (person ?? company)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return (
    <>
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold sm:hidden"
      >
        {initials || '…'}
      </span>
      {/* phones: still read out by screen readers */}
      <span className="min-w-0 max-sm:sr-only">
        <span className="block truncate text-sm font-semibold">{company}</span>
        <span className="block truncate text-xs text-muted-foreground">{line}</span>
      </span>
      <ChevronsUpDown className="text-muted-foreground max-sm:hidden" />
    </>
  );
}
