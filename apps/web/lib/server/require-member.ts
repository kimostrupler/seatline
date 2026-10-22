import { redirect } from 'next/navigation';
import { currentUser, landing, membership } from './auth';
import { webConfig } from './config';

/** Pages for members only: sign in, create the workspace, or explain why there's no access. */
export async function requireMember() {
  if (webConfig().AUTH_MODE !== 'entra') return;
  const user = await currentUser();
  if (!user) redirect('/signin');
  const status = await membership(user);
  if (status !== 'ok') redirect(landing(status));
}
