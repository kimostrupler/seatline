import { execSync } from 'node:child_process';
import path from 'node:path';

const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgresql://seatline:seatline@localhost:5432/seatline_e2e';
const apiDir = path.resolve(__dirname, '../../api');

const run = (cmd: string, input?: string) =>
  execSync(cmd, {
    cwd: apiDir,
    input,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
  });

/** Migrate once per run. */
export function migrateE2eDb() {
  run('pnpm exec prisma migrate deploy');
}

/** Wipe the e2e database and load the demo seed (same data as local dev). */
export function resetE2eDb() {
  run(
    `pnpm exec prisma db execute --url "${E2E_DATABASE_URL}" --stdin`,
    'TRUNCATE audit_log, seat_assignments, seats, rooms, floors, buildings, people, tenants CASCADE;',
  );
  run('pnpm exec tsx prisma/seed.ts');
}
