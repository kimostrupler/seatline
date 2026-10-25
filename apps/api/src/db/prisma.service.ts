import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { loadConfig } from '../config';

/**
 * The URL with Prisma's pool size set, unless it already has one. Prisma's default (2 × the
 * host's CPUs + 1) knows nothing of the container's share, so two copies on a big host could
 * ask for more connections than the database has.
 */
export function withPoolSize(url: string, size: number): string {
  if (/[?&]connection_limit=/.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}connection_limit=${size}`;
}

/**
 * Connects as the least-privilege `seatline_app` role (APP_DATABASE_URL), never the owner,
 * so Row-Level Security always applies. Use TenantDb, not this, in feature code.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    const config = loadConfig();
    super({ datasourceUrl: withPoolSize(config.APP_DATABASE_URL, config.DB_POOL_SIZE) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
