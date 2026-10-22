import { getTranslations } from 'next-intl/server';
import { Centered } from '@/components/auth/centered';
import { webConfig } from '@/lib/server/config';
import { websiteHref } from '@/lib/site';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { userLabel } from '@/lib/server/session';
import { currentUser } from '@/lib/server/auth';

export default async function NoAccess({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const t = await getTranslations('auth');
  const user = await currentUser();
  const reason = (await searchParams).reason;
  const inactive = reason === 'inactive';
  const microsoft = reason === 'use_microsoft';
  return (
    <Centered backHref={websiteHref(webConfig().APP_URL)}>
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold">
          {microsoft ? t('useMicrosoftTitle') : inactive ? t('inactiveTitle') : t('noAccessTitle')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {microsoft ? t('useMicrosoftBody') : inactive ? t('inactiveBody') : t('noAccessBody')}
        </p>
      </div>
      {user && <p className="text-xs text-muted-foreground">{userLabel(user)}</p>}
      <SignOutButton />
    </Centered>
  );
}
