import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  NotFoundException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';

/** Turns database constraint errors into 404/409 instead of 500. */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter implements ExceptionFilter {
  override catch(error: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    switch (error.code) {
      case 'P2002': // unique violation, e.g. a seat got taken by a concurrent request
        return super.catch(new ConflictException('This conflicts with an existing record'), host);
      case 'P2003': // foreign key restrict, e.g. deleting a floor that still has seats
        return super.catch(
          new ConflictException('Still in use by other records — remove or move those first'),
          host,
        );
      case 'P2025':
        return super.catch(new NotFoundException(), host);
      default:
        return super.catch(error, host);
    }
  }
}
