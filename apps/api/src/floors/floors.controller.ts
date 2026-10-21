import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  createFloorSchema,
  listFloorsQuerySchema,
  updateFloorSchema,
  type CreateFloorInput,
  type UpdateFloorInput,
} from '@seatline/shared';
import { Ctx } from '../auth/decorators';
import type { RequestContext } from '../auth/request-context';
import { IdPipe, ZodPipe } from '../common/zod.pipe';
import { FloorsService } from './floors.service';

@Controller('floors')
export class FloorsController {
  constructor(private readonly floors: FloorsService) {}

  @Get()
  list(
    @Ctx() ctx: RequestContext,
    @Query(new ZodPipe(listFloorsQuerySchema)) query: { buildingId?: string },
  ) {
    return this.floors.list(ctx, query.buildingId);
  }

  @Get(':id')
  get(@Ctx() ctx: RequestContext, @Param('id', IdPipe) id: string) {
    return this.floors.get(ctx, id);
  }

  /** Floor + rooms + seats with their current state, for the map. */
  @Get(':id/map')
  map(@Ctx() ctx: RequestContext, @Param('id', IdPipe) id: string) {
    return this.floors.map(ctx, id);
  }

  @Post()
  create(@Ctx() ctx: RequestContext, @Body(new ZodPipe(createFloorSchema)) body: CreateFloorInput) {
    return this.floors.create(ctx, body);
  }

  @Patch(':id')
  update(
    @Ctx() ctx: RequestContext,
    @Param('id', IdPipe) id: string,
    @Body(new ZodPipe(updateFloorSchema)) body: UpdateFloorInput,
  ) {
    return this.floors.update(ctx, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Ctx() ctx: RequestContext, @Param('id', IdPipe) id: string) {
    return this.floors.remove(ctx, id);
  }
}
