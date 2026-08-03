import { HttpException, HttpStatus } from '@nestjs/common';
import { IllegalTransitionError, MissingRateError } from '@forme/domain';

/**
 * The single mapping from a thrown value to an HTTP status.
 *
 * Shared by the exception filter and the audit interceptor deliberately. When
 * they each had their own view, the filter returned 409 for an illegal state
 * transition while the audit log recorded the same request as a 500 — so the
 * table that exists to answer "what happened" disagreed with what the caller
 * was actually told.
 */
export function httpStatusFor(error: unknown): number {
  if (error instanceof HttpException) return error.getStatus();
  if (error instanceof IllegalTransitionError) return HttpStatus.CONFLICT;
  if (error instanceof MissingRateError) return HttpStatus.UNPROCESSABLE_ENTITY;
  return HttpStatus.INTERNAL_SERVER_ERROR;
}
