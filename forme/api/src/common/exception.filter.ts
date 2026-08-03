import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { IllegalTransitionError, MissingRateError } from '@forme/domain';
import { httpStatusFor } from './http-status';

/**
 * One error shape for the whole API, so the web app's `apiFetch` has exactly
 * one thing to parse:
 *
 *   { error: { status, code, message, fields? } }
 *
 * `message` is written to be shown to a person. `fields` carries per-input
 * messages so a form can attach them with aria-describedby rather than dumping
 * a paragraph above the fieldset.
 */
export interface ErrorEnvelope {
  error: {
    status: number;
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const envelope = this.toEnvelope(exception);

    // 5xx means we broke; log the stack. 4xx is the caller's problem and
    // logging every one of them just buries the real failures.
    if (envelope.error.status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${envelope.error.status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(envelope.error.status).json(envelope);
  }

  private toEnvelope(exception: unknown): ErrorEnvelope {
    // Domain errors carry their own good messages; map them to real statuses
    // rather than letting a broken price matrix surface as a bare 500. The
    // status itself comes from httpStatusFor so the audit log agrees.
    if (exception instanceof IllegalTransitionError) {
      return envelope(httpStatusFor(exception), 'ILLEGAL_TRANSITION', exception.message);
    }
    if (exception instanceof MissingRateError) {
      return envelope(httpStatusFor(exception), 'MISSING_RATE', exception.message);
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === 'string') {
        return envelope(status, codeFor(status), body);
      }

      const record = body as { message?: string | string[]; error?: string };
      const raw = record.message;

      // class-validator hands back an array of strings. Turn it into a
      // field map where it can, so forms can place each message on its input.
      if (Array.isArray(raw)) {
        return {
          error: {
            status,
            code: 'VALIDATION_FAILED',
            message: raw[0] ?? 'That request was not valid.',
            fields: toFieldMap(raw),
          },
        };
      }
      return envelope(status, codeFor(status), raw ?? record.error ?? exception.message);
    }

    return envelope(
      HttpStatus.INTERNAL_SERVER_ERROR,
      'INTERNAL',
      'Something failed on our side. The job is unchanged.',
    );
  }
}

function envelope(status: number, code: string, message: string): ErrorEnvelope {
  return { error: { status, code, message } };
}

function codeFor(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'BAD_REQUEST';
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHENTICATED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'CONFLICT';
    case HttpStatus.PAYLOAD_TOO_LARGE:
      return 'TOO_LARGE';
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return 'UNPROCESSABLE';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'RATE_LIMITED';
    default:
      return status >= 500 ? 'INTERNAL' : 'ERROR';
  }
}

/**
 * class-validator messages are prefixed with the property name by default
 * ("email must be an email"), so the first word identifies the field. Messages
 * we write ourselves usually read as sentences; those land under `_` and the
 * form shows them as a summary.
 */
function toFieldMap(messages: string[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const message of messages) {
    const [first] = message.split(' ');
    const key = first && /^[a-z][A-Za-z0-9]*$/.test(first) ? first : '_';
    fields[key] ??= message;
  }
  return fields;
}
