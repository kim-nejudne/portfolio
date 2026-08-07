import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Role } from '@forme/domain';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../common/decorators';
import type { AuthenticatedRequest } from '../common/types';

/**
 * Registered globally in AppModule. Every route requires a valid access token
 * unless it carries @Public(). See the note on that decorator for why the
 * default runs this way round.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  override handleRequest<TUser>(err: unknown, user: TUser): TUser {
    if (err || !user) {
      throw new UnauthorizedException('Sign in to continue.');
    }
    return user;
  }
}

/**
 * Role check, applied after authentication. A route with no @Roles() is open to
 * any signed-in user; a route with @Roles() admits only those roles.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) throw new UnauthorizedException('Sign in to continue.');

    if (!required.includes(user.role)) {
      // Says what was needed, not what the caller is — no probing for roles.
      throw new ForbiddenException(
        `This action requires the ${required.join(' or ')} role.`,
      );
    }
    return true;
  }
}

/**
 * Demo accounts exist so the site is walkable without credentials, which means
 * they must not be able to change anything a later visitor would see. Applied
 * to write routes alongside RolesGuard.
 */
@Injectable()
export class DenyDemoWritesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (user?.isDemo) {
      throw new ForbiddenException(
        'This is a read-only demo account. Sign in with a real account to make changes.',
      );
    }
    return true;
  }
}
