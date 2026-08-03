import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { eq } from 'drizzle-orm';
import type { JobState, PreflightCheck, Press, ProofState } from '@forme/domain';
import { DATABASE, type Database } from '../db/database.module';
import { jobs } from '../db/schema';
import type { AccessTokenPayload } from '../common/types';
import { ACCESS_COOKIE } from '../auth/cookies';

/** Rooms. A job's room is per reference; there is one floor room. */
const jobRoom = (reference: string) => `job:${reference}`;
const FLOOR_ROOM = 'floor';

interface SocketUser {
  id: string;
  role: string;
  customerId: string | null;
}

/** socket.io puts the browser's cookies on the handshake headers. */
function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return null;
}

@WebSocketGateway({
  path: '/api/events',
  // Credentials must be on or the browser will not send the auth cookie, and
  // the origin list has to be explicit — '*' and credentials are incompatible.
  cors: {
    origin: (process.env.WEB_ORIGIN ?? 'http://localhost:3000').split(',').map((o) => o.trim()),
    credentials: true,
  },
  // Long-poll fallback stays available: the floor board runs on whatever screen
  // is bolted to the wall, and some of those sit behind proxies that break ws.
  transports: ['websocket', 'polling'],
})
export class EventsGateway implements OnGatewayConnection {
  @WebSocketServer()
  private server!: Server;

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Authenticates on connect, not on subscribe.
   *
   * An unauthenticated socket is disconnected immediately rather than left open
   * and refused per-message — otherwise anyone can hold a connection on the
   * server for free, and every handler has to remember to re-check.
   */
  async handleConnection(socket: Socket): Promise<void> {
    const token = readCookie(socket.handshake.headers.cookie, ACCESS_COOKIE);
    if (!token) {
      socket.emit('unauthorized', { message: 'Sign in to receive live updates.' });
      socket.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
      if (payload.typ !== 'access') throw new Error('wrong token type');

      const user: SocketUser = {
        id: payload.sub,
        role: payload.role,
        customerId: payload.customerId,
      };
      socket.data.user = user;
    } catch {
      socket.emit('unauthorized', { message: 'Session expired. Sign in again.' });
      socket.disconnect(true);
    }
  }

  /**
   * Joins a job's room after checking the caller may see that job.
   *
   * Rooms are the authorization boundary here: without this check any signed-in
   * customer could name someone else's reference and receive their preflight
   * findings, which is a data leak the HTTP layer would never have allowed.
   */
  @SubscribeMessage('subscribe:job')
  async subscribeJob(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { reference?: string },
  ): Promise<{ ok: boolean; error?: string }> {
    const user = socket.data.user as SocketUser | undefined;
    const reference = typeof body?.reference === 'string' ? body.reference : '';
    if (!user || !reference) return { ok: false, error: 'Bad subscription.' };

    const [job] = await this.db
      .select({ customerId: jobs.customerId })
      .from(jobs)
      .where(eq(jobs.reference, reference))
      .limit(1);

    // Same shape as the HTTP 404: never confirm a reference exists to someone
    // who is not entitled to it.
    if (!job || (user.role === 'customer' && job.customerId !== user.customerId)) {
      return { ok: false, error: `No job ${reference}.` };
    }

    await socket.join(jobRoom(reference));
    return { ok: true };
  }

  @SubscribeMessage('unsubscribe:job')
  async unsubscribeJob(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { reference?: string },
  ): Promise<{ ok: boolean }> {
    if (typeof body?.reference === 'string') await socket.leave(jobRoom(body.reference));
    return { ok: true };
  }

  /** The floor board is shop-wide; any signed-in staff role may watch it. */
  @SubscribeMessage('subscribe:floor')
  async subscribeFloor(@ConnectedSocket() socket: Socket): Promise<{ ok: boolean; error?: string }> {
    const user = socket.data.user as SocketUser | undefined;
    if (!user) return { ok: false, error: 'Not signed in.' };
    if (user.role === 'customer') {
      return { ok: false, error: 'The floor board is for shop staff.' };
    }
    await socket.join(FLOOR_ROOM);
    return { ok: true };
  }

  /* ------------------------------------------------------------- emitters */

  emitPreflightCheck(
    jobReference: string,
    payload: { reportId: string; check: PreflightCheck; index: number; total: number },
  ): void {
    this.server?.to(jobRoom(jobReference)).emit('preflight.check', { jobReference, ...payload });
  }

  emitPreflightDone(
    jobReference: string,
    payload: { reportId: string; blocked: boolean; total: number },
  ): void {
    this.server?.to(jobRoom(jobReference)).emit('preflight.done', { jobReference, ...payload });
  }

  emitJobState(reference: string, state: JobState, proofState: ProofState): void {
    this.server?.to(jobRoom(reference)).emit('job.state', { reference, state, proofState });
    // The floor cares about every job's state, not just the one it is running.
    this.server?.to(FLOOR_ROOM).emit('job.state', { reference, state, proofState });
  }

  emitFloorTick(presses: readonly Press[]): void {
    this.server?.to(FLOOR_ROOM).emit('floor.tick', { presses });
  }

  /** True when at least one client is watching — lets the ticker idle. */
  async hasFloorWatchers(): Promise<boolean> {
    const sockets = await this.server?.in(FLOOR_ROOM).fetchSockets();
    return (sockets?.length ?? 0) > 0;
  }
}
