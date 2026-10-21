import { Controller, Get, Param, Query } from '@nestjs/common';
import { listPeopleQuerySchema, type ListPeopleQuery } from '@seatline/shared';
import { AssignmentsService } from '../assignments/assignments.service';
import { Ctx } from '../auth/decorators';
import type { RequestContext } from '../auth/request-context';
import { IdPipe, ZodPipe } from '../common/zod.pipe';
import { PeopleService } from './people.service';

@Controller('people')
export class PeopleController {
  constructor(
    private readonly people: PeopleService,
    private readonly assignments: AssignmentsService,
  ) {}

  @Get()
  list(
    @Ctx() ctx: RequestContext,
    @Query(new ZodPipe(listPeopleQuerySchema)) query: ListPeopleQuery,
  ) {
    return this.people.list(ctx, query);
  }

  @Get(':id')
  get(@Ctx() ctx: RequestContext, @Param('id', IdPipe) id: string) {
    return this.people.get(ctx, id);
  }

  /** Every seat this person had, newest first. */
  @Get(':id/history')
  history(@Ctx() ctx: RequestContext, @Param('id', IdPipe) id: string) {
    return this.assignments.personHistory(ctx, id);
  }
}
