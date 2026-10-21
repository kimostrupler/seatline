import { NotFoundException } from '@nestjs/common';

export function orNotFound<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new NotFoundException(`${what} not found`);
  return value;
}
