import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import type { AccessTokenPayload, CurrentUser } from '../common/types';
import { ACCESS_COOKIE } from './cookies';
import { UsersService } from './users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
  ) {
    super({
      /**
       * Cookie first, Authorization header second. The browser app uses an
       * httpOnly cookie so a script cannot read the token; the header path
       * exists for curl, the e2e suite and anything server-to-server.
       */
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          const cookies = request.cookies as Record<string, string> | undefined;
          return cookies?.[ACCESS_COOKIE] ?? null;
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<CurrentUser> {
    if (payload.typ !== 'access') {
      // A refresh token presented as an access token. They are signed with the
      // same secret, so the type claim is what keeps them apart.
      throw new UnauthorizedException('Wrong token type.');
    }

    /**
     * Re-read the user rather than trusting the claims. A role changed or an
     * account disabled five minutes ago must take effect now, not whenever the
     * 15-minute token happens to expire.
     */
    const user = await this.users.findActiveById(payload.sub);
    if (!user) throw new UnauthorizedException('This account is no longer active.');

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      customerId: user.customerId,
      isDemo: user.isDemo,
    };
  }
}
