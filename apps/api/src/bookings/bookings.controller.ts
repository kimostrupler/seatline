import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  bookingsQuerySchema,
  createBookingSchema,
  type BookingsQuery,
  type CreateBookingInput,
} from '@seatline/shared';
import { Ctx, OwnSettings } from '../auth/decorators';
import type { RequestContext } from '../auth/request-context';
import { IdPipe, ZodPipe } from '../common/zod.pipe';
import { BookingsService } from './bookings.service';

/** Shared desks booked by the day. Viewers book and cancel their own (the service checks). */
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get()
  forFloor(@Ctx() ctx: RequestContext, @Query(new ZodPipe(bookingsQuerySchema)) q: BookingsQuery) {
    return this.bookings.forFloor(ctx, q.floorId, q.day);
  }

  @Get('mine')
  mine(@Ctx() ctx: RequestContext) {
    return this.bookings.mine(ctx);
  }

  @OwnSettings()
  @Post()
  book(
    @Ctx() ctx: RequestContext,
    @Body(new ZodPipe(createBookingSchema)) body: CreateBookingInput,
  ) {
    return this.bookings.book(ctx, body);
  }

  @OwnSettings()
  @Post(':id/cancel')
  cancel(@Ctx() ctx: RequestContext, @Param('id', IdPipe) id: string) {
    return this.bookings.cancel(ctx, id);
  }
}
