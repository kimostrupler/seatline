import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import {
  listPeopleQuerySchema,
  setRoleSchema,
  type ListPeopleQuery,
  type SetRoleInput,
} from '@seatline/shared';
import { AssignmentsService } from '../assignments/assignments.service';
import { AdminOnly, Ctx } from '../auth/decorators';
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

  /** Admins: everyone, incl. people who left, with roles. (Declared before :id.) */
  @AdminOnly()
  @Get('directory')
  directory(@Ctx() ctx: RequestContext) {
    return this.people.directory(ctx);
  }

  @AdminOnly()
  @Patch(':id/role')
  setRole(
    @Ctx() ctx: RequestContext,
    @Param('id', IdPipe) id: string,
    @Body(new ZodPipe(setRoleSchema)) body: SetRoleInput,
  ) {
    return this.people.setRole(ctx, id, body);
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
