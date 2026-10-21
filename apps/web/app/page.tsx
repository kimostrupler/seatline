import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Workspace } from '@/components/workspace/workspace';
import { currentUser, membership } from '@/lib/server/auth';
import { webConfig } from '@/lib/server/config';

export default async function Home() {
  if (webConfig().AUTH_MODE === 'entra') {
    const user = await currentUser();
    if (!user) redirect('/signin');
    const status = await membership(user);
    if (status === 'no_workspace') redirect('/onboarding');
    if (status !== 'ok') redirect(`/no-access?reason=${status}`);
  }
  return (
    <Suspense>
      <Workspace />
    </Suspense>
  );
}
