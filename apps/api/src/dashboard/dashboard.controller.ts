import { Body, Controller, Delete, Get, Put } from '@nestjs/common';
import { dashboardSchema, type DashboardInput } from '@seatline/shared';
import { AdminOnly, Ctx, OwnSettings } from '../auth/decorators';
import type { RequestContext } from '../auth/request-context';
import { ZodPipe } from '../common/zod.pipe';
import { DashboardService } from './dashboard.service';
import { StatsService } from './stats.service';

@Controller()
export class DashboardController {
  constructor(
    private readonly dashboards: DashboardService,
    private readonly stats: StatsService,
  ) {}

  @Get('dashboard')
  get(@Ctx() ctx: RequestContext) {
    return this.dashboards.get(ctx);
  }

  /** Everyone arranges their own dashboard (viewers too). */
  @OwnSettings()
  @Put('dashboard')
  save(@Ctx() ctx: RequestContext, @Body(new ZodPipe(dashboardSchema)) body: DashboardInput) {
    return this.dashboards.save(ctx, body.widgets);
  }

  @OwnSettings()
  @Delete('dashboard')
  reset(@Ctx() ctx: RequestContext) {
    return this.dashboards.reset(ctx);
  }

  @AdminOnly()
  @Put('dashboard/default')
  saveDefault(
    @Ctx() ctx: RequestContext,
    @Body(new ZodPipe(dashboardSchema)) body: DashboardInput,
  ) {
    return this.dashboards.saveDefault(ctx, body.widgets);
  }

  /** Numbers and short lists for the dashboard widgets (everyone). */
  @Get('stats')
  getStats(@Ctx() ctx: RequestContext) {
    return this.stats.get(ctx);
  }
}
