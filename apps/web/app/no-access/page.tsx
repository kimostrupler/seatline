import { getTranslations } from 'next-intl/server';
import { Centered } from '@/components/auth/centered';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { currentUser } from '@/lib/server/auth';

export default async function NoAccess({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const t = await getTranslations('auth');
  const user = await currentUser();
  const inactive = (await searchParams).reason === 'inactive';
  return (
    <Centered>
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold">
          {inactive ? t('inactiveTitle') : t('noAccessTitle')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {inactive ? t('inactiveBody') : t('noAccessBody')}
        </p>
      </div>
      {user && <p className="text-xs text-muted-foreground">{`${user.name} · ${user.email}`}</p>}
      <SignOutButton />
    </Centered>
  );
}
