import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AssignmentsController } from './assignments/assignments.controller';
import { AssignmentsService } from './assignments/assignments.service';
import { DevAuthGuard } from './auth/dev-auth.guard';
import { BuildingsController } from './buildings/buildings.controller';
import { BuildingsService } from './buildings/buildings.service';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';
import { DbModule } from './db/db.module';
import { FloorsController } from './floors/floors.controller';
import { FloorsService } from './floors/floors.service';
import { HealthController } from './health.controller';
import { PeopleController } from './people/people.controller';
import { PeopleService } from './people/people.service';
import { RoomsController } from './rooms/rooms.controller';
import { RoomsService } from './rooms/rooms.service';
import { SeatsController } from './seats/seats.controller';
import { SeatsService } from './seats/seats.service';

@Module({
  imports: [DbModule],
  controllers: [
    HealthController,
    BuildingsController,
    FloorsController,
    RoomsController,
    SeatsController,
    AssignmentsController,
    PeopleController,
  ],
  providers: [
    BuildingsService,
    FloorsService,
    RoomsService,
    SeatsService,
    AssignmentsService,
    PeopleService,
    { provide: APP_GUARD, useClass: DevAuthGuard },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
})
export class AppModule {}
