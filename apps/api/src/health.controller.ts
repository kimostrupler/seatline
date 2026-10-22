import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from './auth/decorators';
import { TenantDb } from './db/tenant-db.service';

@Controller('health')
export class HealthController {
  constructor(private readonly db: TenantDb) {}

  /** For the uptime check (via the web app's /healthz): the API runs and reaches the database. */
  @Public()
  @Get()
  async health() {
    try {
      await this.db.ping();
    } catch {
      throw new ServiceUnavailableException({ status: 'database_unreachable' });
    }
    return { status: 'ok' };
  }
}
