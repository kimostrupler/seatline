import {
  BadGatewayException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { planDraftSchema, type PlanDraft } from '@seatline/shared';
import { z } from 'zod';
import type { RequestContext } from '../auth/request-context';
import { loadConfig } from '../config';
import { StorageService } from '../storage/storage.service';
import { FloorsService } from './floors.service';
import { inspectPlanImage } from './plan-image';

export const MAX_IMPORT_BYTES = 25 * 1024 * 1024;
const ENGINE_TIMEOUT_MS = 150_000; // a cold start plus a large plan

const engineAnswer = planDraftSchema.extend({ image: z.string().min(1) });

/**
 * Architect plans (DXF, PDF, images) → a draft layout, via the plan engine (apps/plan-engine).
 * The suggested background image waits under the floor's imports/ until it is applied or
 * discarded; the rooms and desks the editor keeps are saved as a normal layout batch.
 */
@Injectable()
export class PlanImportService {
  private readonly logger = new Logger(PlanImportService.name);

  constructor(
    private readonly floors: FloorsService,
    private readonly storage: StorageService,
  ) {}

  private key(ctx: RequestContext, floorId: string, importId: string) {
    return `${ctx.tenantId}/floors/${floorId}/imports/${importId}.png`;
  }

  async analyze(ctx: RequestContext, floorId: string, file: Buffer, fileName: string) {
    const { PLAN_ENGINE_URL, PLAN_ENGINE_TOKEN } = loadConfig();
    if (!PLAN_ENGINE_URL)
      throw new ServiceUnavailableException({
        message: 'Plan import is not available here',
        code: 'plan_engine_off',
      });
    await this.floors.get(ctx, floorId); // 404 before doing any work

    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(file)]), fileName.slice(0, 200) || 'plan');
    let res: Response;
    try {
      res = await fetch(new URL('/analyze', PLAN_ENGINE_URL), {
        method: 'POST',
        body: form,
        headers: PLAN_ENGINE_TOKEN ? { 'x-internal-token': PLAN_ENGINE_TOKEN } : {},
        signal: AbortSignal.timeout(ENGINE_TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.error(`Plan engine unreachable: ${String(error)}`);
      throw new ServiceUnavailableException({
        message: 'The plan reader is not reachable. Please try again in a minute.',
        code: 'plan_engine_unreachable',
      });
    }
    if (res.status === 413 || res.status === 422) {
      const body = (await res.json().catch(() => ({}))) as { code?: string };
      const code = /^[a-z_]{1,30}$/.test(body.code ?? '') ? body.code! : 'failed';
      throw new HttpException(
        { message: `This plan can't be read (${code})`, code: `plan_${code}` },
        422,
      );
    }
    if (!res.ok) {
      this.logger.error(`Plan engine answered ${res.status}`);
      throw new BadGatewayException({ message: 'Reading the plan failed', code: 'plan_failed' });
    }
    const parsed = engineAnswer.safeParse(await res.json().catch(() => null));
    if (!parsed.success) {
      this.logger.error(`Plan engine answer is invalid: ${parsed.error.message.slice(0, 500)}`);
      throw new BadGatewayException({ message: 'Reading the plan failed', code: 'plan_failed' });
    }
    const { image, ...draft } = parsed.data;
    const png = Buffer.from(image, 'base64');
    const info = inspectPlanImage(png);
    if (info.ext !== 'png' || info.width !== draft.width || info.height !== draft.height)
      throw new BadGatewayException({ message: 'Reading the plan failed', code: 'plan_failed' });

    const importId = randomUUID();
    await this.storage.put(this.key(ctx, floorId, importId), png, 'image/png');
    return { importId, ...draft } satisfies PlanDraft & { importId: string };
  }

  async image(ctx: RequestContext, floorId: string, importId: string) {
    await this.floors.get(ctx, floorId);
    const data = await this.storage.read(this.key(ctx, floorId, importId));
    if (!data) throw new NotFoundException('Import not found');
    return data;
  }

  /** The import's image becomes the floor's plan (and its scale, if the plan had one). */
  async apply(ctx: RequestContext, floorId: string, importId: string, scale: number | null) {
    const key = this.key(ctx, floorId, importId);
    const data = await this.storage.read(key);
    if (!data) throw new NotFoundException('Import not found');
    const floor = await this.floors.uploadPlan(ctx, floorId, data, { source: 'import', scale });
    await this.storage.delete(key);
    return floor;
  }

  async discard(ctx: RequestContext, floorId: string, importId: string) {
    await this.floors.get(ctx, floorId);
    await this.storage.delete(this.key(ctx, floorId, importId));
  }
}
