import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  createSeatSchema,
  listSeatsQuerySchema,
  updateSeatSchema,
  type CreateSeatInput,
  type UpdateSeatInput,
} from '@seatline/shared';
import { AssignmentsService } from '../assignments/assignments.service';
import { Ctx } from '../auth/decorators';
import type { RequestContext } from '../auth/request-context';
import { IdPipe, ZodPipe } from '../common/zod.pipe';
import { SeatsService } from './seats.service';

@Controller('seats')
export class SeatsController {
  constructor(
    private readonly seats: SeatsService,
    private readonly assignments: AssignmentsService,
  ) {}

  /** All seats of a floor with their current state (free / taken / reserved / blocked). */
  @Get()
  list(
    @Ctx() ctx: RequestContext,
    @Query(new ZodPipe(listSeatsQuerySchema)) query: { floorId: string },
  ) {
    return this.seats.list(ctx, query.floorId);
  }

  @Get(':id')
  get(@Ctx() ctx: RequestContext, @Param('id', IdPipe) id: string) {
    return this.seats.get(ctx, id);
  }

  /** Everyone who ever sat here, newest first. */
  @Get(':id/history')
  history(@Ctx() ctx: RequestContext, @Param('id', IdPipe) id: string) {
    return this.assignments.seatHistory(ctx, id);
  }

  @Post()
  create(@Ctx() ctx: RequestContext, @Body(new ZodPipe(createSeatSchema)) body: CreateSeatInput) {
    return this.seats.create(ctx, body);
  }

  @Patch(':id')
  update(
    @Ctx() ctx: RequestContext,
    @Param('id', IdPipe) id: string,
    @Body(new ZodPipe(updateSeatSchema)) body: UpdateSeatInput,
  ) {
    return this.seats.update(ctx, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Ctx() ctx: RequestContext, @Param('id', IdPipe) id: string) {
    return this.seats.remove(ctx, id);
  }
}
