// Elections are run in Lagos (WAT, UTC+1) — dates/times are always shown in
// that zone explicitly, never the server's or browser's local system zone.
// Explicit timeZone keeps this SSR/CSR-safe: Intl resolves 'Africa/Lagos' the
// same way in Node and in the browser, so server and client render identical
// strings regardless of what machine each one happens to run on.
const LAGOS_TIME_ZONE = 'Africa/Lagos';

function ordinal(day: number): string {
  if (day % 10 === 1 && day % 100 !== 11) return `${day}st`;
  if (day % 10 === 2 && day % 100 !== 12) return `${day}nd`;
  if (day % 10 === 3 && day % 100 !== 13) return `${day}rd`;
  return `${day}th`;
}

function getPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value ?? '';
}

export function formatElectionDate(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: LAGOS_TIME_ZONE,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).formatToParts(new Date(iso));

  const month = getPart(parts, 'month');
  const day = Number(getPart(parts, 'day'));
  const year = getPart(parts, 'year');

  return `${month} ${ordinal(day)}, ${year}`;
}

export function formatTime(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: LAGOS_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(new Date(iso));

  const hour = getPart(parts, 'hour');
  const minute = getPart(parts, 'minute');
  const period = getPart(parts, 'dayPeriod').toUpperCase();

  return `${hour}:${minute}${period}`;
}

export function formatElectionTimeRange(startIso: string, endIso: string): string {
  return `${formatTime(startIso)} - ${formatTime(endIso)}`;
}

// yyyy-mm-dd in Lagos time — string-comparable calendar-date key.
function dateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: LAGOS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * An election ending exactly at local midnight (e.g. 00:00 -> next day
 * 00:00) reads as one full calendar day, not a two-day span — so the end is
 * compared a millisecond early, landing it back on the day it's closing
 * rather than the day that's about to start.
 */
export function isMultiDayElection(startIso: string, endIso: string): boolean {
  const startDay = dateKey(new Date(startIso));
  const endDay = dateKey(new Date(new Date(endIso).getTime() - 1));
  return startDay !== endDay;
}

function formatShortDate(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: LAGOS_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).formatToParts(new Date(iso));

  return `${getPart(parts, 'month')} ${getPart(parts, 'day')}, ${getPart(parts, 'year')}`;
}

/** Merged range for a multi-day election, e.g. "Aug 19, 2026, 10:00 AM - Aug 20, 2026, 6:00 PM". */
export function formatElectionDateTimeRange(startIso: string, endIso: string): string {
  return `${formatShortDate(startIso)}, ${formatTime(startIso)} - ${formatShortDate(endIso)}, ${formatTime(endIso)}`;
}

/** Whether `iso` falls on today's calendar date in Lagos time. */
export function isToday(iso: string): boolean {
  return dateKey(new Date(iso)) === dateKey(new Date());
}
