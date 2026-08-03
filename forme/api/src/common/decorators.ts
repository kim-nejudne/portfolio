import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Role } from '@forme/domain';
import type { AuthenticatedRequest, CurrentUser } from './types';

export const IS_PUBLIC_KEY = 'forme:isPublic';
export const ROLES_KEY = 'forme:roles';
export const SKIP_AUDIT_KEY = 'forme:skipAudit';

/**
 * Opens a route to unauthenticated callers.
 *
 * Authentication is deny-by-default: `JwtAuthGuard` is registered globally, so
 * a new controller is protected the moment it exists and a developer has to opt
 * a route *out* rather than remember to opt it in. Forgetting this decorator
 * produces a 401 on a public page — loud and immediate. The opposite default
 * produces an unauthenticated admin route nobody notices, which is exactly the
 * defect the scaffold shipped.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restricts a route to the listed roles. Requires authentication implicitly. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Excludes a route from the audit log. Only for high-volume read endpoints. */
export const SkipAudit = () => SetMetadata(SKIP_AUDIT_KEY, true);

/** The authenticated user, as resolved by the JWT strategy. */
export const User = createParamDecorator(
  (field: keyof CurrentUser | undefined, context: ExecutionContext): CurrentUser | unknown => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) {
      throw new Error(
        'No user on the request. @User() was used on a route reachable without authentication.',
      );
    }
    return field ? user[field] : user;
  },
);
