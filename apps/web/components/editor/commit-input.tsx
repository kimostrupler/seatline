'use client';

import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Input } from '@/components/ui/input';

/**
 * A text field that saves on Enter, when leaving it, or when it disappears (e.g. the user
 * clicks another seat on the map, which swaps the inspector before the field can blur).
 * Esc puts the saved value back.
 */
export function CommitInput({
  value,
  onCommit,
  ...props
}: { value: string; onCommit: (value: string) => void } & Omit<
  ComponentProps<typeof Input>,
  'value' | 'onChange'
>) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  // latest values for the unmount save (effects capture stale closures otherwise)
  const latest = useRef({ draft, value, onCommit });
  latest.current = { draft, value, onCommit };

  const commit = () => {
    const next = latest.current.draft.trim();
    if (next && next !== latest.current.value) {
      latest.current.onCommit(next);
      latest.current.value = next; // don't save the same text twice (blur + unmount)
    } else setDraft(latest.current.value);
  };

  useEffect(
    () => () => {
      const next = latest.current.draft.trim();
      if (next && next !== latest.current.value) latest.current.onCommit(next);
    },
    [],
  );

  return (
    <Input
      {...props}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          latest.current.draft = latest.current.value;
          setDraft(latest.current.value);
          e.currentTarget.blur();
        }
      }}
    />
  );
}
