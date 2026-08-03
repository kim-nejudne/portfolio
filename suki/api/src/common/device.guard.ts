import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

export const IS_PUBLIC = 'suki:isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const DEVICE_HEADER = 'x-suki-device-key';

/**
 * A shared device key on every sync request.
 *
 * The app's PIN screen is a counter lock, not authentication — it lives entirely
 * in the browser and protects a phone left face-up, nothing more. Without this
 * guard the sync endpoint would accept operations from anyone who knew the URL,
 * and "anyone can append to the shop's ledger" is not a footnote.
 *
 * A single shared key is proportionate for one shop with one or two devices. It
 * is deliberately not per-user: there are no users here, there is a shopkeeper.
 * If the shop ever grows staff accounts, this is where that lands.
 */
@Injectable()
export class DeviceGuard implements CanActivate {
  private readonly key: string;

  constructor(
    config: ConfigService,
    private readonly reflector: Reflector,
  ) {
    this.key = config.getOrThrow<string>('DEVICE_KEY');
  }

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const presented = request.headers[DEVICE_HEADER];
    if (typeof presented !== 'string' || presented.length === 0) {
      throw new UnauthorizedException('This device is not registered with the shop.');
    }

    // Constant-time, so the endpoint does not leak the key one byte at a time.
    const a = Buffer.from(presented);
    const b = Buffer.from(this.key);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('This device is not registered with the shop.');
    }
    return true;
  }
}
