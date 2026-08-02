/**
 * Deterministic date handling. Everything is computed in Asia/Manila (UTC+8) with
 * plain arithmetic — no Intl, no locale lookups, no `new Date()` without an argument,
 * so a server render and a client render always agree.
 *
 * The shop is closed on Sundays. Working days skip Sunday only.
 */
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Parts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
}

function parts(iso: string): Parts {
  const shifted = new Date(Date.parse(iso) + MANILA_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

export function formatDate(iso: string): string {
  const p = parts(iso);
  return `${pad(p.day)} ${MONTHS[p.month]} ${p.year}`;
}

export function formatShortDate(iso: string): string {
  const p = parts(iso);
  return `${pad(p.day)} ${MONTHS[p.month]}`;
}

export function formatTime(iso: string): string {
  const p = parts(iso);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)} ${formatTime(iso)}`;
}

export function formatWeekday(iso: string): string {
  return DAYS[parts(iso).weekday];
}

export function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

export function isSunday(iso: string): boolean {
  return parts(iso).weekday === 0;
}

/** Adds working days, skipping Sundays. Day 0 is the start date itself. */
export function addWorkingDays(iso: string, days: number): string {
  let ms = Date.parse(iso);
  let added = 0;
  while (added < days) {
    ms += DAY_MS;
    if (!isSunday(toIso(ms))) added += 1;
  }
  if (isSunday(toIso(ms))) ms += DAY_MS;
  return toIso(ms);
}

/** Rush is 24 hours, rolled forward off a Sunday. */
export function addHours(iso: string, hours: number): string {
  let ms = Date.parse(iso) + hours * 60 * 60 * 1000;
  if (isSunday(toIso(ms))) ms += DAY_MS;
  return toIso(ms);
}

export function minutesBetween(fromIso: string, toIsoString: string): number {
  return Math.round((Date.parse(toIsoString) - Date.parse(fromIso)) / 60000);
}

export function hoursBetween(fromIso: string, toIsoString: string): number {
  return Math.round(minutesBetween(fromIso, toIsoString) / 60);
}

/** `2d 04h`, `04h 20m`, `12m`. Always mono, always two fields at most. */
export function formatDuration(totalMinutes: number): string {
  const sign = totalMinutes < 0 ? '-' : '';
  const minutes = Math.abs(totalMinutes);
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${sign}${days}d ${pad(hours)}h`;
  if (hours > 0) return `${sign}${pad(hours)}h ${pad(mins)}m`;
  return `${sign}${mins}m`;
}

export interface DueStatus {
  overdue: boolean;
  label: string;
  minutes: number;
}

export function dueStatus(dueIso: string, nowIso: string): DueStatus {
  const minutes = minutesBetween(nowIso, dueIso);
  return {
    overdue: minutes < 0,
    minutes,
    label: minutes < 0 ? `${formatDuration(-minutes)} over` : `${formatDuration(minutes)} left`,
  };
}
