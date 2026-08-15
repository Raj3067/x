// ---------------------------------------------------------------------------
// Giveaway helpers.
//
// Status is derived from `endsAt` rather than stored, so a giveaway nobody
// remembered to delete expires on its own instead of sitting there claiming to
// be live. Everything here is pure and safe to call from a Server Component.
// ---------------------------------------------------------------------------

/** Parses `endsAt` to a timestamp, or null if absent/unparseable. */
export function endsAtTime(giveaway) {
  if (!giveaway?.endsAt) return null;
  const time = new Date(giveaway.endsAt).getTime();
  return Number.isNaN(time) ? null : time;
}

/**
 * Splits the configured `active` list into what is still open and what has
 * closed. A giveaway with no `endsAt` is treated as open-ended, not expired —
 * otherwise forgetting the field would silently hide the drop.
 *
 * `now` is injectable so this stays testable and so the page can pass a single
 * timestamp rather than calling Date.now() per item.
 */
export function splitActive(list = [], now = Date.now()) {
  const open = [];
  const closed = [];

  for (const giveaway of list) {
    const ends = endsAtTime(giveaway);
    if (ends !== null && ends <= now) closed.push(giveaway);
    else open.push(giveaway);
  }

  // Soonest to end first; open-ended ones sink to the bottom.
  open.sort((a, b) => (endsAtTime(a) ?? Infinity) - (endsAtTime(b) ?? Infinity));
  // Most recently closed first.
  closed.sort((a, b) => (endsAtTime(b) ?? 0) - (endsAtTime(a) ?? 0));

  return { open, closed };
}

/**
 * Formats an ISO date for display. Locale is pinned to en-GB and the timezone
 * to UTC on purpose: this runs during prerender on the server and again in the
 * browser, and letting either default would produce different strings and a
 * hydration mismatch.
 */
export function formatDate(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** Same, with the time appended — used for giveaway closing times. */
export function formatDateTime(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(date);
}

/**
 * Breaks a millisecond span into a coarse "2d 4h left" string. Deliberately
 * drops to at most two units — a countdown to the second on a statically
 * cached page invites more precision than the data deserves.
 */
export function formatRemaining(ms) {
  if (ms === null || ms === undefined) return null;
  if (ms <= 0) return 'Closed';

  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  if (minutes > 0) return `${minutes}m left`;
  return 'Closing now';
}
