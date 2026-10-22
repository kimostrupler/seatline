import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  createPersonSchema,
  importPeopleSchema,
  type ImportPeopleInput,
  peopleChangesSchema,
  renameTeamSchema,
  type PeopleChangesInput,
  type RenameTeamInput,
  inviteSchema,
  setActiveSchema,
  updatePersonSchema,
  type CreatePersonInput,
  type InviteInput,
  type SetActiveInput,
  type UpdatePersonInput,
  listPeopleQuerySchema,
  setRoleSchema,
  setTeamSchema,
  type ListPeopleQuery,
  type SetRoleInput,
  type SetTeamInput,
} from '@seatline/shared';
import { AssignmentsService } from '../assignments/assignments.service';
import { AdminOnly, Ctx } from '../auth/decorators';
import type { RequestContext } from '../auth/request-context';
import { IdPipe, ZodPipe } from '../common/zod.pipe';
import { PeopleService } from './people.service';

@Controller('people')
export class PeopleController {
  constructor(
    private readonly people: PeopleService,
    private readonly assignments: AssignmentsService,
  ) {}

  @Get()
  list(
    @Ctx() ctx: RequestContext,
    @Query(new ZodPipe(listPeopleQuerySchema)) query: ListPeopleQuery,
  ) {
    return this.people.list(ctx, query);
  }

  /** Admins: everyone, incl. people who left, with roles. (Declared before :id.) */
  @AdminOnly()
  @Get('directory')
  directory(@Ctx() ctx: RequestContext) {
    return this.people.directory(ctx);
  }

  /** Add someone by hand (and optionally invite them by e-mail). */
  @AdminOnly()
  @Post()
  create(
    @Ctx() ctx: RequestContext,
    @Body(new ZodPipe(createPersonSchema)) body: CreatePersonInput,
  ) {
    return this.people.create(ctx, body);
  }

  /** Read a spreadsheet of people (field "file": Excel or CSV, up to 2 MB). Saves nothing. */
  @AdminOnly()
  @Post('import/read')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024, files: 1 } }))
  readImport(@Ctx() ctx: RequestContext, @UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('Attach the file as "file"');
    return this.people.readImport(ctx, file.buffer, file.originalname);
  }

  /** Add the people read from the file (those already in the list are skipped). */
  @AdminOnly()
  @Post('import')
  importPeople(
    @Ctx() ctx: RequestContext,
    @Body(new ZodPipe(importPeopleSchema)) body: ImportPeopleInput,
  ) {
    return this.people.importPeople(ctx, body);
  }

  /** HR table: several people's team / role / leaving date at once. */
  @AdminOnly()
  @Post('changes')
  @HttpCode(200)
  applyChanges(
    @Ctx() ctx: RequestContext,
    @Body(new ZodPipe(peopleChangesSchema)) body: PeopleChangesInput,
  ) {
    return this.people.applyChanges(ctx, body);
  }

  @AdminOnly()
  @Post('teams/rename')
  @HttpCode(200)
  renameTeam(
    @Ctx() ctx: RequestContext,
    @Body(new ZodPipe(renameTeamSchema)) body: RenameTeamInput,
  ) {
    return this.people.renameTeam(ctx, body);
  }

  @AdminOnly()
  @Patch(':id')
  update(
    @Ctx() ctx: RequestContext,
    @Param('id', IdPipe) id: string,
    @Body(new ZodPipe(updatePersonSchema)) body: UpdatePersonInput,
  ) {
    return this.people.update(ctx, id, body);
  }

  @AdminOnly()
  @Patch(':id/active')
  setActive(
    @Ctx() ctx: RequestContext,
    @Param('id', IdPipe) id: string,
    @Body(new ZodPipe(setActiveSchema)) body: SetActiveInput,
  ) {
    return this.people.setActive(ctx, id, body);
  }

  @AdminOnly()
  @Post(':id/invite')
  @HttpCode(200)
  invite(
    @Ctx() ctx: RequestContext,
    @Param('id', IdPipe) id: string,
    @Body(new ZodPipe(inviteSchema)) body: InviteInput,
  ) {
    return this.people.invite(ctx, id, body.language);
  }

  @AdminOnly()
  @Patch(':id/role')
  setRole(
    @Ctx() ctx: RequestContext,
    @Param('id', IdPipe) id: string,
    @Body(new ZodPipe(setRoleSchema)) body: SetRoleInput,
  ) {
    return this.people.setRole(ctx, id, body);
  }

  @AdminOnly()
  @Patch(':id/team')
  setTeam(
    @Ctx() ctx: RequestContext,
    @Param('id', IdPipe) id: string,
    @Body(new ZodPipe(setTeamSchema)) body: SetTeamInput,
  ) {
    return this.people.setTeam(ctx, id, body);
  }

  @Get(':id')
  get(@Ctx() ctx: RequestContext, @Param('id', IdPipe) id: string) {
    return this.people.get(ctx, id);
  }

  /** Every seat this person had, newest first. */
  @Get(':id/history')
  history(@Ctx() ctx: RequestContext, @Param('id', IdPipe) id: string) {
    return this.assignments.personHistory(ctx, id);
  }
}
