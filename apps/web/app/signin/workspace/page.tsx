import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Centered } from '@/components/auth/centered';
import { webConfig } from '@/lib/server/config';
import { websiteHref } from '@/lib/site';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { Button } from '@/components/ui/button';
import { currentUser, landing, session } from '@/lib/server/auth';

/** The address belongs to several workspaces: pick one. */
export default async function PickWorkspace() {
  const user = await currentUser();
  if (user?.kind !== 'email') redirect('/signin');
  const s = await session(user);
  if (s.status !== 'choose') redirect(landing(s.status));
  const t = await getTranslations('auth');
  return (
    <Centered backHref={websiteHref(webConfig().APP_URL)}>
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold">{t('pickTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('pickBody', { email: user.email })}</p>
      </div>
      <ul className="grid gap-2">
        {s.workspaces.map((w) => (
          <li key={w.id}>
            <form method="post" action="/auth/email/workspace">
              <input type="hidden" name="tenantId" value={w.id} />
              <Button type="submit" variant="outline" className="w-full justify-start">
                {w.name}
              </Button>
            </form>
          </li>
        ))}
      </ul>
      <SignOutButton />
    </Centered>
  );
}
