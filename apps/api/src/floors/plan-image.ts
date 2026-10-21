import { BadRequestException } from '@nestjs/common';
import { imageSize } from 'image-size';

export const MAX_PLAN_BYTES = 10 * 1024 * 1024;

/** Raster formats only: SVG can carry scripts, PDF/DXF import is Phase 5. */
const ALLOWED = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
} as const;

export interface PlanImage {
  ext: keyof typeof ALLOWED;
  contentType: string;
  width: number;
  height: number;
}

/** Checks the actual bytes (not the file name or the browser's claim). */
export function inspectPlanImage(data: Buffer): PlanImage {
  let info: ReturnType<typeof imageSize>;
  try {
    info = imageSize(data);
  } catch {
    throw new BadRequestException('Upload a PNG, JPG or WebP image');
  }
  const ext = info.type === 'jpeg' ? 'jpg' : info.type;
  if (!ext || !(ext in ALLOWED) || !info.width || !info.height) {
    throw new BadRequestException('Upload a PNG, JPG or WebP image');
  }
  const key = ext as keyof typeof ALLOWED;
  return { ext: key, contentType: ALLOWED[key], width: info.width, height: info.height };
}
