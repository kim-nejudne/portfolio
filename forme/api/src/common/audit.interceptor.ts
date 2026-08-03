import { randomUUID } from 'node:crypto';
import {
  Inject,
  Injectable,
  Logger,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { catchError, tap, throwError } from 'rxjs';
import type { Observable } from 'rxjs';
import type { Response } from 'express';
import { DATABASE, type Database } from '../db/database.module';
import { auditLog } from '../db/schema';
import { SKIP_AUDIT_KEY } from './decorators';
import { httpStatusFor } from './http-status';
import type { AuthenticatedRequest } from './types';

/** Never written to the audit table, at any nesting depth. */
const REDACTED_KEYS = new Set([
  'password',
  'newpassword',
  'currentpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'authorization',
]);

const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * Writes one row per mutating request: who, what, when, and the outcome.
 *
 * Failures are recorded too. An audit log that only contains successes cannot
 * answer "did someone try to override this and get refused", which is the
 * question an audit log exists for.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (skip || !MUTATING.has(request.method)) return next.handle();

    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      tap(() => void this.write(request, response.statusCode)),
      catchError((error: unknown) => {
        // Uses the same mapping the exception filter does, so the status
        // recorded here is the status the caller was actually given.
        void this.write(request, httpStatusFor(error));
        return throwError(() => error);
      }),
    );
  }

  private async write(request: AuthenticatedRequest, statusCode: number): Promise<void> {
    try {
      await this.db.insert(auditLog).values({
        id: randomUUID(),
        actorId: request.user?.id ?? null,
        actorName: request.user?.name ?? 'anonymous',
        role: request.user?.role ?? null,
        method: request.method,
        // `route.path` is the pattern (/jobs/:reference), not the filled URL,
        // so the table groups by endpoint instead of by every reference ever.
        path: request.route?.path ?? request.path,
        statusCode,
        payload: redact(request.body),
        ip: request.ip ?? null,
      });
    } catch (error) {
      // Auditing must never break the request it is recording.
      this.logger.error('Failed to write audit row', error instanceof Error ? error.stack : error);
    }
  }
}

function redact(value: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 4 || value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      out[key] = '[redacted]';
    } else if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
      out[key] = redact(raw, depth + 1);
    } else if (typeof raw === 'string' && raw.length > 512) {
      out[key] = `${raw.slice(0, 512)}… [truncated]`;
    } else {
      out[key] = raw;
    }
  }
  return out;
}
