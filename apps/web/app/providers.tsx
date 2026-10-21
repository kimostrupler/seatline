'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ErrorReporter } from '@/components/common/error-reporter';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthModeProvider, type AuthMode } from '@/lib/auth-mode';
import { IdentityProvider } from '@/lib/identity';

export function Providers({ children, authMode }: { children: ReactNode; authMode: AuthMode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: true } },
      }),
  );
  return (
    <AuthModeProvider mode={authMode}>
      <QueryClientProvider client={queryClient}>
        {/* switching company/user must never show the previous company's cached data */}
        <IdentityProvider onChange={() => queryClient.clear()}>
          <TooltipProvider delayDuration={400}>
            {children}
            <Toaster position="bottom-center" />
            <ErrorReporter />
          </TooltipProvider>
        </IdentityProvider>
      </QueryClientProvider>
    </AuthModeProvider>
  );
}
