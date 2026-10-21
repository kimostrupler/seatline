import { migrateE2eDb } from './db';

export default function globalSetup() {
  migrateE2eDb();
}
