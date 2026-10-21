'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/lib/client-errors';

/** Sends uncaught browser errors to the server log, so we hear about them. */
export function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => reportClientError(e.error ?? e.message, 'error');
    const onRejection = (e: PromiseRejectionEvent) => reportClientError(e.reason, 'rejection');
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return null;
}
