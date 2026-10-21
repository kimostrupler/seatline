import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { onboardingSchema, type OnboardingInput } from '@seatline/shared';
import { ZodPipe } from '../common/zod.pipe';
import { CurrentIdentity, IdentityOnly } from './decorators';
import type { Identity } from './identity';
import { IdentityService } from './identity.service';

@Controller()
export class AuthController {
  constructor(private readonly identities: IdentityService) {}

  /**
   * Called by the web app right after Microsoft sign-in: is this person a member?
   * status: ok | no_workspace (offer onboarding) | no_access | inactive
   */
  @IdentityOnly()
  @Post('auth/session')
  @HttpCode(200)
  async session(@CurrentIdentity() identity: Identity) {
    const membership = await this.identities.resolve(identity);
    return {
      status: membership.status,
      workspace: 'workspace' in membership ? membership.workspace : null,
      role: membership.status === 'ok' ? membership.ctx.role : null,
    };
  }

  /** First person from a new organisation creates its workspace and becomes admin. */
  @IdentityOnly()
  @Post('onboarding')
  onboard(
    @CurrentIdentity() identity: Identity,
    @Body(new ZodPipe(onboardingSchema)) body: OnboardingInput,
  ) {
    return this.identities.onboard(identity, body.companyName);
  }
}
