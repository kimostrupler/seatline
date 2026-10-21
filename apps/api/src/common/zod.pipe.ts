import { BadRequestException, PipeTransform } from '@nestjs/common';
import { z } from 'zod';

/** Validates a body/query/param with a zod schema; 400 with the issues on failure. */
export class ZodPipe<T extends z.ZodType> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Invalid input',
        issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    return result.data;
  }
}

export const IdPipe = new ZodPipe(z.uuid());
