import { execSync, spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';

/** Azurite (local Azure Blob Storage) for the tests: in memory, on its own port. */
export const TEST_BLOB_PORT = 10100;

function waitForPort(port: number, timeoutMs = 15_000) {
  const until = Date.now() + timeoutMs;
  return new Promise<void>((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect(port, '127.0.0.1');
      socket.once('connect', () => {
        socket.end();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() > until) reject(new Error(`Azurite did not start on ${port}`));
        else setTimeout(attempt, 200);
      });
    };
    attempt();
  });
}

/** Brings the test database up to the latest migration and starts Azurite. */
export default async function setup() {
  execSync('prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
  });

  const azurite = spawn(
    path.resolve(__dirname, '../node_modules/.bin/azurite-blob'),
    [
      '--blobHost',
      '127.0.0.1',
      '--blobPort',
      String(TEST_BLOB_PORT),
      '--inMemoryPersistence',
      '--silent',
      '--skipApiVersionCheck',
    ],
    { stdio: 'ignore' },
  );
  await waitForPort(TEST_BLOB_PORT);
  return () => {
    azurite.kill();
  };
}
