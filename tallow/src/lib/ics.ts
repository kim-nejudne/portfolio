import { Reservation } from '../types';

/** Sittings last 1 hour 45 minutes — the same figure the booking form states. */
const SITTING_MINUTES = 105;

const VENUE = '14 Beak Street, Soho, London W1F 9RD';

/**
 * RFC 5545 §3.3.11: backslash, semicolon and comma are delimiters inside a
 * property value and newlines have to be encoded. Guest notes are free text,
 * so any of them can appear — an unescaped comma in "Requesting the ribeye,
 * medium rare" silently truncates the description in most calendar clients.
 */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * RFC 5545 §3.1: content lines are folded at 75 octets, continued by CRLF and
 * a single space. Measured in octets rather than characters because the venue
 * and guest names are not guaranteed to be ASCII.
 */
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const parts: string[] = [];
  let current = '';
  let bytes = 0;

  for (const char of line) {
    const size = encoder.encode(char).length;
    // 74 leaves room for the leading space on the continuation line.
    if (bytes + size > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = '';
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  if (current) parts.push(current);

  return parts.join('\r\n ');
}

function stampUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Local wall-clock stamp: the sitting is at 19:30 in Soho whatever the guest's device thinks. */
function stampLocal(date: string, time: string): string {
  return `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;
}

function addMinutes(date: string, time: string, minutes: number): { date: string; time: string } {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  // Built in UTC and read back in UTC so the arithmetic cannot be shifted by
  // the browser's own timezone; these are wall-clock values, not instants.
  const end = new Date(Date.UTC(y, m - 1, d, hh, mm + minutes));

  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${end.getUTCFullYear()}-${pad(end.getUTCMonth() + 1)}-${pad(end.getUTCDate())}`,
    time: `${pad(end.getUTCHours())}:${pad(end.getUTCMinutes())}`,
  };
}

/**
 * Builds the calendar file offered on the confirmation voucher.
 *
 * The scaffold's version added two hours to the start hour with string maths,
 * which produced an invalid `24:00` for the last sitting of the night and never
 * rolled over to the next day.
 */
export function buildReservationIcs(reservation: Reservation, now = new Date()): string {
  const end = addMinutes(reservation.date, reservation.time, SITTING_MINUTES);
  const guests = reservation.partySize === 1 ? '1 Guest' : `${reservation.partySize} Guests`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TALLOW Steakhouse London//Reservations//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    // Clients treat UID as the identity of the event: without one, re-importing
    // the file creates duplicates instead of updating the sitting in place.
    `UID:${escapeText(reservation.token)}@tallow-soho.co.uk`,
    `DTSTAMP:${stampUtc(now)}`,
    `DTSTART:${stampLocal(reservation.date, reservation.time)}`,
    `DTEND:${stampLocal(end.date, end.time)}`,
    foldLine(`SUMMARY:${escapeText(`TALLOW Steakhouse Sitting (${guests})`)}`),
    foldLine(
      `DESCRIPTION:${escapeText(
        `Sitting reservation at TALLOW London. Booking token: ${reservation.token}. ` +
          `Cut notes: ${reservation.notes || 'None'}.`
      )}`
    ),
    foldLine(`LOCATION:${escapeText(VENUE)}`),
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  // RFC 5545 §3.1 requires CRLF line breaks, and a trailing one.
  return lines.join('\r\n') + '\r\n';
}
