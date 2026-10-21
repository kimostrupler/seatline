'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';

export function OnboardingForm({ signedInAs }: { signedInAs: string }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api('/onboarding', { method: 'POST', body: { companyName: name.trim() } });
          router.replace('/');
          router.refresh();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : String(error));
          setBusy(false);
        }
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="company">{t('companyName')}</Label>
        <Input
          id="company"
          value={name}
          onChange={(e) => setName(e.target.value)}
          minLength={2}
          maxLength={200}
          required
        />
      </div>
      <Button type="submit" disabled={busy || name.trim().length < 2}>
        {t('createWorkspace')}
      </Button>
      <p className="text-xs text-muted-foreground">{signedInAs}</p>
    </form>
  );
}
