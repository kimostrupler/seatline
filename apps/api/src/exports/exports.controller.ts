import { Controller, Get, Query, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { Ctx, EditorsOnly } from '../auth/decorators';
import type { RequestContext } from '../auth/request-context';
import { ZodPipe } from '../common/zod.pipe';
import { ExportsService } from './exports.service';

const base = {
  format: z.enum(['xlsx', 'csv']).default('xlsx'),
  lang: z.enum(['en', 'de', 'fr']).default('en'),
};
const seatingQuery = z.strictObject({
  ...base,
  buildingId: z.uuid().optional(),
  floorId: z.uuid().optional(),
});
const historyQuery = z.strictObject(base);

function send(res: Response, file: { name: string; type: string; data: Buffer }) {
  res.set({
    'Content-Type': file.type,
    'Content-Disposition': `attachment; filename="${file.name}"`,
    'Cache-Control': 'no-store',
  });
  return new StreamableFile(file.data);
}

@Controller('exports')
export class ExportsController {
  constructor(private readonly exports: ExportsService) {}

  /** Who sits where now — everyone who can see the map. */
  @Get('seating')
  async seating(
    @Ctx() ctx: RequestContext,
    @Query(new ZodPipe(seatingQuery)) q: z.infer<typeof seatingQuery>,
    @Res({ passthrough: true }) res: Response,
  ) {
    return send(res, await this.exports.seating(ctx, q));
  }

  /** Every seat change ever — editors and admins. */
  @EditorsOnly()
  @Get('history')
  async history(
    @Ctx() ctx: RequestContext,
    @Query(new ZodPipe(historyQuery)) q: z.infer<typeof historyQuery>,
    @Res({ passthrough: true }) res: Response,
  ) {
    return send(res, await this.exports.history(ctx, q));
  }
}
