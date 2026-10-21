import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { loadConfig } from '../config';

/**
 * Connects as the least-privilege `seatline_app` role (APP_DATABASE_URL), never the owner,
 * so Row-Level Security always applies. Use TenantDb, not this, in feature code.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({ datasourceUrl: loadConfig().APP_DATABASE_URL });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
