import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Centered } from '@/components/auth/centered';
import { webConfig } from '@/lib/server/config';
import { websiteHref } from '@/lib/site';
import { OnboardingForm } from '@/components/auth/onboarding-form';
import { userLabel } from '@/lib/server/session';
import { currentUser, membership } from '@/lib/server/auth';

export default async function Onboarding() {
  const user = await currentUser();
  if (!user) redirect('/');
  if ((await membership(user)) !== 'no_workspace') redirect('/');
  const t = await getTranslations('auth');
  return (
    <Centered backHref={websiteHref(webConfig().APP_URL)}>
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold">{t('onboardingTitle')}</h1>
        <p className="text-sm text-muted-foreground">
          {user.kind === 'email' ? t('onboardingBodyEmail') : t('onboardingBody')}
        </p>
      </div>
      <OnboardingForm signedInAs={userLabel(user)} askName={user.kind === 'email'} />
    </Centered>
  );
}
