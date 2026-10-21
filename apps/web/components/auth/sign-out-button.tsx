import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';

export async function SignOutButton() {
  const t = await getTranslations('auth');
  return (
    <form action="/auth/logout" method="post">
      <Button type="submit" variant="outline" className="w-full">
        {t('signOut')}
      </Button>
    </form>
  );
}
