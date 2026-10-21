import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  createRoomSchema,
  listRoomsQuerySchema,
  updateRoomSchema,
  type CreateRoomInput,
  type UpdateRoomInput,
} from '@seatline/shared';
import { Ctx } from '../auth/decorators';
import type { RequestContext } from '../auth/request-context';
import { IdPipe, ZodPipe } from '../common/zod.pipe';
import { RoomsService } from './rooms.service';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get()
  list(
    @Ctx() ctx: RequestContext,
    @Query(new ZodPipe(listRoomsQuerySchema)) query: { floorId: string },
  ) {
    return this.rooms.list(ctx, query.floorId);
  }

  @Get(':id')
  get(@Ctx() ctx: RequestContext, @Param('id', IdPipe) id: string) {
    return this.rooms.get(ctx, id);
  }

  @Post()
  create(@Ctx() ctx: RequestContext, @Body(new ZodPipe(createRoomSchema)) body: CreateRoomInput) {
    return this.rooms.create(ctx, body);
  }

  @Patch(':id')
  update(
    @Ctx() ctx: RequestContext,
    @Param('id', IdPipe) id: string,
    @Body(new ZodPipe(updateRoomSchema)) body: UpdateRoomInput,
  ) {
    return this.rooms.update(ctx, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Ctx() ctx: RequestContext, @Param('id', IdPipe) id: string) {
    return this.rooms.remove(ctx, id);
  }
}
