import { Body, Controller, Param, Post } from '@nestjs/common';
import {
  assignSeatSchema,
  endAssignmentSchema,
  reserveSeatSchema,
  type AssignSeatInput,
  type EndAssignmentInput,
  type ReserveSeatInput,
} from '@seatline/shared';
import { Ctx } from '../auth/decorators';
import type { RequestContext } from '../auth/request-context';
import { IdPipe, ZodPipe } from '../common/zod.pipe';
import { AssignmentsService } from './assignments.service';

@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  /** Assign or move a person to a seat. */
  @Post()
  assign(@Ctx() ctx: RequestContext, @Body(new ZodPipe(assignSeatSchema)) body: AssignSeatInput) {
    return this.assignments.assign(ctx, body);
  }

  @Post('reservations')
  reserve(
    @Ctx() ctx: RequestContext,
    @Body(new ZodPipe(reserveSeatSchema)) body: ReserveSeatInput,
  ) {
    return this.assignments.reserve(ctx, body);
  }

  /** Free the seat. History is kept: the assignment gets an end date. */
  @Post(':id/end')
  end(
    @Ctx() ctx: RequestContext,
    @Param('id', IdPipe) id: string,
    @Body(new ZodPipe(endAssignmentSchema)) body: EndAssignmentInput,
  ) {
    return this.assignments.end(ctx, id, body);
  }
}
