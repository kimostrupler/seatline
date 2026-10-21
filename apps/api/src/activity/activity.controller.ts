import { Controller, Get, Query } from '@nestjs/common';
import { activityQuerySchema, type ActivityQuery } from '@seatline/shared';
import { Ctx, EditorsOnly } from '../auth/decorators';
import type { RequestContext } from '../auth/request-context';
import { ZodPipe } from '../common/zod.pipe';
import { ActivityService } from './activity.service';
import { OverviewService } from './overview.service';

@Controller()
export class ActivityController {
  constructor(
    private readonly activity: ActivityService,
    private readonly overview: OverviewService,
  ) {}

  /** The full change history — editors and admins (it names who did what). */
  @EditorsOnly()
  @Get('activity')
  list(@Ctx() ctx: RequestContext, @Query(new ZodPipe(activityQuerySchema)) query: ActivityQuery) {
    return this.activity.list(ctx, query);
  }

  /** Seat counts per building and floor — everyone. */
  @Get('overview')
  get(@Ctx() ctx: RequestContext) {
    return this.overview.get(ctx);
  }
}
