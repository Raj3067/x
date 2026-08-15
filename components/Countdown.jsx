'use client';

/**
 * Live "2d 4h left" label for a giveaway.
 *
 * The server renders `initial` (computed at build/revalidate time) and this
 * component only replaces it after mount. Rendering a fresh Date.now() on the
 * first client render would disagree with the prerendered HTML and trip a
 * hydration mismatch, so the swap deliberately waits a tick.
 *
 * Ticks once a minute — the label has minute resolution, so a faster interval
 * would wake the tab for nothing.
 */

import { useEffect, useState } from 'react';
import { formatRemaining } from '@/lib/giveaways';

export default function Countdown({ endsAt, initial }) {
  const [label, setLabel] = useState(initial);

  useEffect(() => {
    if (!endsAt) return undefined;
    const target = new Date(endsAt).getTime();
    if (Number.isNaN(target)) return undefined;

    const tick = () => setLabel(formatRemaining(target - Date.now()));
    tick(); // Correct immediately; the prerendered value may be stale.

    const id = window.setInterval(tick, 60000);
    return () => window.clearInterval(id);
  }, [endsAt]);

  if (!label) return null;

  return (
    <span>
      {/* aria-live so a screen reader user who leaves the page open hears the
          update, but "polite" so it never interrupts. */}
      <span aria-live="polite">{label}</span>
    </span>
  );
}
