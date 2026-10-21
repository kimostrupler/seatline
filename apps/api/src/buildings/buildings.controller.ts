import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  createBuildingSchema,
  updateBuildingSchema,
  type CreateBuildingInput,
  type UpdateBuildingInput,
} from '@seatline/shared';
import { Ctx } from '../auth/decorators';
import type { RequestContext } from '../auth/request-context';
import { IdPipe, ZodPipe } from '../common/zod.pipe';
import { BuildingsService } from './buildings.service';

@Controller('buildings')
export class BuildingsController {
  constructor(private readonly buildings: BuildingsService) {}

  @Get()
  list(@Ctx() ctx: RequestContext) {
    return this.buildings.list(ctx);
  }

  @Get(':id')
  get(@Ctx() ctx: RequestContext, @Param('id', IdPipe) id: string) {
    return this.buildings.get(ctx, id);
  }

  @Post()
  create(
    @Ctx() ctx: RequestContext,
    @Body(new ZodPipe(createBuildingSchema)) body: CreateBuildingInput,
  ) {
    return this.buildings.create(ctx, body);
  }

  @Patch(':id')
  update(
    @Ctx() ctx: RequestContext,
    @Param('id', IdPipe) id: string,
    @Body(new ZodPipe(updateBuildingSchema)) body: UpdateBuildingInput,
  ) {
    return this.buildings.update(ctx, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Ctx() ctx: RequestContext, @Param('id', IdPipe) id: string) {
    return this.buildings.remove(ctx, id);
  }
}
