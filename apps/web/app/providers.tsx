'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { IdentityProvider } from '@/lib/identity';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: true } },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      {/* switching company/user must never show the previous company's cached data */}
      <IdentityProvider onChange={() => queryClient.clear()}>
        <TooltipProvider delayDuration={400}>
          {children}
          <Toaster position="bottom-center" />
        </TooltipProvider>
      </IdentityProvider>
    </QueryClientProvider>
  );
}
