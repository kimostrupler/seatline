import { Body, Controller, Get, Put } from '@nestjs/common';
import { setTeamPlanSchema, type SetTeamPlanInput } from '@seatline/shared';
import { Ctx, EditorsOnly } from '../auth/decorators';
import type { RequestContext } from '../auth/request-context';
import { ZodPipe } from '../common/zod.pipe';
import { PlanningService } from './planning.service';

/** Space planning — editors and admins (expected hiring isn't for everyone's eyes). */
@EditorsOnly()
@Controller('planning')
export class PlanningController {
  constructor(private readonly planning: PlanningService) {}

  @Get()
  get(@Ctx() ctx: RequestContext) {
    return this.planning.get(ctx);
  }

  @Put('teams')
  setTeam(
    @Ctx() ctx: RequestContext,
    @Body(new ZodPipe(setTeamPlanSchema)) body: SetTeamPlanInput,
  ) {
    return this.planning.setTeam(ctx, body);
  }
}
