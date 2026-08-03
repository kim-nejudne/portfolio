import type { Request } from 'express';
import type { Role } from '@forme/domain';

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** Null for staff roles; a customer is scoped to exactly one account. */
  customerId: string | null;
  isDemo: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: CurrentUser;
}

/** Claims we sign. Deliberately small — anything mutable is re-read per request. */
export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: Role;
  customerId: string | null;
  typ: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  /** Identifies the stored token row, so one session can be revoked alone. */
  sid: string;
  typ: 'refresh';
}
