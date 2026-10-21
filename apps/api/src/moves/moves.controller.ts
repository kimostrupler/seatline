import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import {
  createMovePlanSchema,
  listMovePlansQuerySchema,
  movePlanItemsSchema,
  placeTeamSchema,
  scheduleMovePlanSchema,
  updateMovePlanSchema,
  type CreateMovePlanInput,
  type ListMovePlansQuery,
  type MovePlanItemsInput,
  type PlaceTeamInput,
  type ScheduleMovePlanInput,
  type UpdateMovePlanInput,
} from '@seatline/shared';
import { Ctx, EditorsOnly } from '../auth/decorators';
import type { RequestContext } from '../auth/request-context';
import { IdPipe, ZodPipe } from '../common/zod.pipe';
import { MovesService } from './moves.service';

/** Planned moves — editors and admins (they show who moves where before it's announced). */
@EditorsOnly()
@Controller('move-plans')
export class MovesController {
  constructor(private readonly moves: MovesService) {}

  @Get()
  list(
    @Ctx() ctx: RequestContext,
    @Query(new ZodPipe(listMovePlansQuerySchema)) query: ListMovePlansQuery,
  ) {
    return this.moves.list(ctx, query);
  }

  @Post()
  create(
    @Ctx() ctx: RequestContext,
    @Body(new ZodPipe(createMovePlanSchema)) body: CreateMovePlanInput,
  ) {
    return this.moves.create(ctx, body);
  }

  @Get(':id')
  get(@Ctx() ctx: RequestContext, @Param('id', IdPipe) id: string) {
    return this.moves.get(ctx, id);
  }

  @Patch(':id')
  update(
    @Ctx() ctx: RequestContext,
    @Param('id', IdPipe) id: string,
    @Body(new ZodPipe(updateMovePlanSchema)) body: UpdateMovePlanInput,
  ) {
    return this.moves.update(ctx, id, body);
  }

  @Put(':id/items')
  setItems(
    @Ctx() ctx: RequestContext,
    @Param('id', IdPipe) id: string,
    @Body(new ZodPipe(movePlanItemsSchema)) body: MovePlanItemsInput,
  ) {
    return this.moves.setItems(ctx, id, body);
  }

  @Delete(':id/items/:personId')
  removeItem(
    @Ctx() ctx: RequestContext,
    @Param('id', IdPipe) id: string,
    @Param('personId', IdPipe) personId: string,
  ) {
    return this.moves.removeItem(ctx, id, personId);
  }

  @Post(':id/team')
  placeTeam(
    @Ctx() ctx: RequestContext,
    @Param('id', IdPipe) id: string,
    @Body(new ZodPipe(placeTeamSchema)) body: PlaceTeamInput,
  ) {
    return this.moves.placeTeam(ctx, id, body);
  }

  @Post(':id/schedule')
  schedule(
    @Ctx() ctx: RequestContext,
    @Param('id', IdPipe) id: string,
    @Body(new ZodPipe(scheduleMovePlanSchema)) body: ScheduleMovePlanInput,
  ) {
    return this.moves.schedule(ctx, id, body.effectiveDate);
  }

  @Post(':id/unschedule')
  unschedule(@Ctx() ctx: RequestContext, @Param('id', IdPipe) id: string) {
    return this.moves.unschedule(ctx, id);
  }

  @Post(':id/apply')
  apply(@Ctx() ctx: RequestContext, @Param('id', IdPipe) id: string) {
    return this.moves.applyNow(ctx, id);
  }

  @Post(':id/cancel')
  cancel(@Ctx() ctx: RequestContext, @Param('id', IdPipe) id: string) {
    return this.moves.cancel(ctx, id);
  }
}
