import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import {
  demoStartSchema,
  type DemoStartInput,
  emailSignInCodeSchema,
  emailSignInStartSchema,
  emailSignInVerifySchema,
  onboardingSchema,
  type EmailSignInCodeInput,
  type EmailSignInStartInput,
  type EmailSignInVerifyInput,
  type OnboardingInput,
} from '@seatline/shared';
import { ZodPipe } from '../common/zod.pipe';
import { DemoService } from '../demo/demo.service';
import { TenantDb } from '../db/tenant-db.service';
import { CurrentIdentity, IdentityOnly, Public } from './decorators';
import { EmailSignInService } from './email-sign-in.service';
import type { Identity } from './identity';
import { IdentityService } from './identity.service';

@Controller()
export class AuthController {
  constructor(
    private readonly identities: IdentityService,
    private readonly emailSignIn: EmailSignInService,
    private readonly demo: DemoService,
    private readonly db: TenantDb,
  ) {}

  /**
   * A new demo workspace with sample data (called by the web app's demo page, which limits
   * how often one address may ask). Returns the address the visitor's session is for.
   */
  @Public()
  @Post('auth/demo')
  @HttpCode(200)
  startDemo(@Body(new ZodPipe(demoStartSchema)) body: DemoStartInput) {
    return this.demo.create(body.language);
  }

  /** Which sign-in methods the sign-in page offers. */
  @Public()
  @Get('auth/options')
  options() {
    return { email: this.emailSignIn.enabled };
  }

  /** Send a one-time sign-in link (called by the web app's sign-in form). */
  @Public()
  @Post('auth/email/start')
  @HttpCode(200)
  startEmail(@Body(new ZodPipe(emailSignInStartSchema)) body: EmailSignInStartInput) {
    return this.emailSignIn.start(body.email, body.language);
  }

  /** Use a sign-in link: returns the proven address (the web app then keeps the session). */
  @Public()
  @Post('auth/email/verify')
  @HttpCode(200)
  verifyEmail(@Body(new ZodPipe(emailSignInVerifySchema)) body: EmailSignInVerifyInput) {
    return this.emailSignIn.verify(body.token);
  }

  /** Use the code from the sign-in e-mail instead (typed in, e.g. in a home-screen app). */
  @Public()
  @Post('auth/email/code')
  @HttpCode(200)
  verifyEmailCode(@Body(new ZodPipe(emailSignInCodeSchema)) body: EmailSignInCodeInput) {
    return this.emailSignIn.verifyCode(body.email, body.code);
  }

  /**
   * Called by the web app right after Microsoft sign-in: is this person a member?
   * status: ok | no_workspace (offer onboarding) | no_access | inactive
   *   | choose (e-mail: several workspaces) | use_microsoft (e-mail: sign in with Microsoft)
   */
  @IdentityOnly()
  @Post('auth/session')
  @HttpCode(200)
  async session(@CurrentIdentity() identity: Identity) {
    const membership = await this.identities.resolve(identity);
    return {
      status: membership.status,
      workspace: 'workspace' in membership ? membership.workspace : null,
      workspaces: membership.status === 'choose' ? membership.workspaces : [],
      role: membership.status === 'ok' ? membership.ctx.role : null,
    };
  }

  /**
   * Sign-out (called by the web app before it deletes the cookie): this session's id is refused
   * from now on, so a copy of the cookie elsewhere stops working too. Other sign-ins stay.
   */
  @IdentityOnly()
  @Post('auth/signout')
  @HttpCode(204)
  async signOut(@CurrentIdentity() identity: Identity) {
    // a session cookie lives at most 30 days (web SESSION_HOURS); keep the record a bit longer
    if (identity.sid) await this.db.signOutSession(identity.sid, new Date(Date.now() + 31 * 864e5));
  }

  /** First person from a new organisation creates its workspace and becomes admin. */
  @IdentityOnly()
  @Post('onboarding')
  onboard(
    @CurrentIdentity() identity: Identity,
    @Body(new ZodPipe(onboardingSchema)) body: OnboardingInput,
  ) {
    return this.identities.onboard(identity, body.companyName, body.yourName);
  }
}
