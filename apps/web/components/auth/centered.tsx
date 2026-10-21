import type { ReactNode } from 'react';
import { LanguageSelect } from '@/components/common/language-select';

/** Calm single-column page for sign-in, onboarding and access messages. */
export function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-canvas p-6">
      <div className="absolute top-3 right-3">
        <LanguageSelect compact />
      </div>
      <div className="grid w-full max-w-sm gap-5 rounded-xl border bg-background p-6 shadow-sm">
        {children}
      </div>
    </main>
  );
}
