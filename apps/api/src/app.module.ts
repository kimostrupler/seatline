import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard/dashboard.controller';
import { DashboardService } from './dashboard/dashboard.service';
import { StatsService } from './dashboard/stats.service';
import { ActivityController } from './activity/activity.controller';
import { ActivityService } from './activity/activity.service';
import { OverviewService } from './activity/overview.service';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AssignmentsController } from './assignments/assignments.controller';
import { AssignmentsService } from './assignments/assignments.service';
import { AuthController } from './auth/auth.controller';
import { AuthGuard } from './auth/auth.guard';
import { IdentityService } from './auth/identity.service';
import { BuildingsController } from './buildings/buildings.controller';
import { BuildingsService } from './buildings/buildings.service';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';
import { DbModule } from './db/db.module';
import { FloorsController } from './floors/floors.controller';
import { FloorsService } from './floors/floors.service';
import { HealthController } from './health.controller';
import { LayoutService } from './layout/layout.service';
import { MeController } from './me.controller';
import { PeopleController } from './people/people.controller';
import { PeopleService } from './people/people.service';
import { RoomsController } from './rooms/rooms.controller';
import { RoomsService } from './rooms/rooms.service';
import { SeatsController } from './seats/seats.controller';
import { SeatsService } from './seats/seats.service';
import { StorageService } from './storage/storage.service';
import { TenantController } from './tenant/tenant.controller';
import { JobQueue } from './jobs/job-queue.service';
import { GraphClient } from './sync/graph.client';
import { PeopleSyncController } from './sync/people-sync.controller';
import { PeopleSyncService } from './sync/people-sync.service';

@Module({
  imports: [DbModule],
  controllers: [
    HealthController,
    MeController,
    AuthController,
    TenantController,
    PeopleSyncController,
    BuildingsController,
    FloorsController,
    RoomsController,
    SeatsController,
    AssignmentsController,
    PeopleController,
    ActivityController,
    DashboardController,
  ],
  providers: [
    DashboardService,
    StatsService,
    ActivityService,
    OverviewService,
    BuildingsService,
    FloorsService,
    RoomsService,
    SeatsService,
    AssignmentsService,
    PeopleService,
    StorageService,
    LayoutService,
    IdentityService,
    GraphClient,
    PeopleSyncService,
    JobQueue,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
})
export class AppModule {}
