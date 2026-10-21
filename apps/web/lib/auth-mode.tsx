'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { setDevHeaders } from './api';

export type AuthMode = 'dev' | 'entra';

const AuthModeContext = createContext<AuthMode>('dev');

/** dev = demo company/user switcher; entra = Microsoft sign-in (session cookie). */
export function AuthModeProvider({ mode, children }: { mode: AuthMode; children: ReactNode }) {
  setDevHeaders(mode === 'dev'); // before any child starts fetching
  return <AuthModeContext value={mode}>{children}</AuthModeContext>;
}

export const useAuthMode = () => useContext(AuthModeContext);
