import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Centered } from '@/components/auth/centered';
import { OnboardingForm } from '@/components/auth/onboarding-form';
import { currentUser, membership } from '@/lib/server/auth';

export default async function Onboarding() {
  const user = await currentUser();
  if (!user) redirect('/');
  if ((await membership(user)) !== 'no_workspace') redirect('/');
  const t = await getTranslations('auth');
  return (
    <Centered>
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold">{t('onboardingTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('onboardingBody')}</p>
      </div>
      <OnboardingForm signedInAs={`${user.name} · ${user.email}`} />
    </Centered>
  );
}
