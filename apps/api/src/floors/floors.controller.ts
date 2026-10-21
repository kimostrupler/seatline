import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import {
  createFloorSchema,
  layoutChangesSchema,
  type LayoutChanges,
  listFloorsQuerySchema,
  updateFloorSchema,
  type CreateFloorInput,
  type UpdateFloorInput,
} from '@seatline/shared';
import { Ctx } from '../auth/decorators';
import type { RequestContext } from '../auth/request-context';
import { IdPipe, ZodPipe } from '../common/zod.pipe';
import { LayoutService } from '../layout/layout.service';
import { FloorsService } from './floors.service';
import { MAX_PLAN_BYTES } from './plan-image';

@Controller('floors')
export class FloorsController {
  constructor(
    private readonly floors: FloorsService,
    private readonly layout: LayoutService,
  ) {}

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

  /** Layout editor: apply one batch of room/seat changes, return the updated map. */
  @Patch(':id/layout')
  async applyLayout(
    @Ctx() ctx: RequestContext,
    @Param('id', IdPipe) id: string,
    @Body(new ZodPipe(layoutChangesSchema)) body: LayoutChanges,
  ) {
    await this.layout.apply(ctx, id, body);
    return this.floors.map(ctx, id);
  }

  /** Background plan image (multipart field "file"; PNG, JPG or WebP up to 10 MB). */
  @Post(':id/plan')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_PLAN_BYTES, files: 1 } }))
  uploadPlan(
    @Ctx() ctx: RequestContext,
    @Param('id', IdPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException('Attach the plan image as "file"');
    return this.floors.uploadPlan(ctx, id, file.buffer);
  }

  @Get(':id/plan')
  async plan(
    @Ctx() ctx: RequestContext,
    @Param('id', IdPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { key, file } = await this.floors.getPlan(ctx, id);
    res.set({
      'Content-Type': file.contentType,
      'Cache-Control': 'private, max-age=3600', // a new upload gets a new key/ETag
      ETag: `"${key.split('/').pop()}"`,
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(file.stream, { length: file.size });
  }

  @Delete(':id/plan')
  @HttpCode(204)
  removePlan(@Ctx() ctx: RequestContext, @Param('id', IdPipe) id: string) {
    return this.floors.removePlan(ctx, id);
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
