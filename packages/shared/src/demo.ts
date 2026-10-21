import type { AppRole } from './enums';

/**
 * Fixed ids of the demo seed (apps/api/prisma/seed.ts). The web app's dev login
 * switcher uses them until Microsoft sign-in replaces dev auth in Phase 4.
 */
export interface DemoUser {
  id: string;
  displayName: string;
  role: AppRole;
}

export interface DemoTenant {
  id: string;
  name: string;
  users: [admin: DemoUser, editor: DemoUser, viewer: DemoUser];
}

export const DEMO_TENANTS: DemoTenant[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Alpenblick AG',
    users: [
      {
        id: '11111111-1111-4111-8111-0000000000a1',
        displayName: 'Alpenblick AG Admin',
        role: 'admin',
      },
      { id: '11111111-1111-4111-8111-0000000000e1', displayName: 'Anna Meier', role: 'editor' },
      { id: '11111111-1111-4111-8111-0000000000b1', displayName: 'Luca Rossi', role: 'viewer' },
    ],
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Seeblick GmbH',
    users: [
      {
        id: '22222222-2222-4222-8222-0000000000a1',
        displayName: 'Seeblick GmbH Admin',
        role: 'admin',
      },
      { id: '22222222-2222-4222-8222-0000000000e1', displayName: 'Laura Graf', role: 'editor' },
      { id: '22222222-2222-4222-8222-0000000000b1', displayName: 'David Frei', role: 'viewer' },
    ],
  },
];
