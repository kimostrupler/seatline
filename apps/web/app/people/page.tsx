import { Suspense } from 'react';
import { PeopleAdmin } from '@/components/admin/people-admin';
import { webConfig } from '@/lib/server/config';

export default function PeoplePage() {
  const config = webConfig();
  return (
    <Suspense>
      <PeopleAdmin
        consentBase={
          config.AUTH_MODE === 'entra'
            ? {
                loginUrl: config.ENTRA_LOGIN_URL,
                clientId: config.ENTRA_CLIENT_ID,
                redirectUri: `${config.APP_URL}/people`,
              }
            : null
        }
      />
    </Suspense>
  );
}
