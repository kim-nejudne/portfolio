import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
import type { Request, Response } from 'express';
import { Public, SkipAudit, User } from '../common/decorators';
import type { CurrentUser } from '../common/types';
import { AuthService, type IssuedTokens } from './auth.service';
import { REFRESH_COOKIE, clearAuthCookies, setAuthCookies } from './cookies';
import { UsersService } from './users.service';

class SignInDto {
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email!: string;

  @IsString()
  @MinLength(1, { message: 'Enter your password.' })
  password!: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly isProduction: boolean;

  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    config: ConfigService,
  ) {
    this.isProduction = config.get<string>('NODE_ENV') === 'production';
  }

  /**
   * Rate limited to 10 attempts per 10 minutes per IP — the same budget TALLOW
   * uses. Express `trust proxy` is set in main.ts so this keys on the real
   * client address rather than nginx's.
   */
  @Public()
  @Throttle({ signIn: { limit: 10, ttl: 600_000 } })
  @Post('sign-in')
  @HttpCode(200)
  @ApiOperation({ summary: 'Exchange credentials for an access and refresh cookie pair' })
  async signIn(
    @Body() dto: SignInDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: CurrentUser }> {
    const { user, tokens } = await this.auth.signIn(dto.email, dto.password);
    this.applyCookies(response, tokens);
    return { user };
  }

  @Public()
  @Throttle({ refresh: { limit: 60, ttl: 600_000 } })
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate the refresh token and issue a new access token' })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: CurrentUser }> {
    const cookies = request.cookies as Record<string, string> | undefined;
    const { user, tokens } = await this.auth.refresh(cookies?.[REFRESH_COOKIE] ?? '');
    this.applyCookies(response, tokens);
    return { user };
  }

  @Public()
  @Post('sign-out')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke the current session and clear both cookies' })
  async signOut(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const cookies = request.cookies as Record<string, string> | undefined;
    await this.auth.signOut(cookies?.[REFRESH_COOKIE]);
    clearAuthCookies(response, this.isProduction);
  }

  /** The session endpoint the web app calls on every server render. */
  @SkipAudit()
  @Get('me')
  @ApiOperation({ summary: 'The signed-in user' })
  me(@User() user: CurrentUser): { user: CurrentUser } {
    return { user };
  }

  /**
   * Advertised on the sign-in screen so the site is walkable without
   * credentials. Returns addresses and roles only — never the password, which
   * the screen shows from its own config.
   */
  @Public()
  @SkipAudit()
  @Get('demo-accounts')
  @ApiOperation({ summary: 'Seeded read-only accounts, one per role' })
  async demoAccounts() {
    return { accounts: await this.users.listDemoAccounts() };
  }

  private applyCookies(response: Response, tokens: IssuedTokens): void {
    setAuthCookies(response, tokens, {
      isProduction: this.isProduction,
      accessMaxAgeMs: tokens.accessMaxAgeMs,
      refreshMaxAgeMs: tokens.refreshMaxAgeMs,
    });
  }
}
