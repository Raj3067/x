'use client';

import { useEffect, useState } from 'react';
import { site } from '@/content/site.config';

// ---------------------------------------------------------------------------
// LiveStatus — the pulsing indicator in the hero.
//
// Two modes, driven by `site.showMemberCounts`:
//   false (default) -> a bare LIVE dot, no numbers
//   true            -> the real counts from /api/discord
//
// /api/discord runs and works either way, so flipping the flag is the only
// change needed to reveal the numbers later. Nothing to wire up.
//
// Space for the numbers is reserved before they arrive (min-h + a skeleton),
// so the hero never jumps when the fetch resolves.
// ---------------------------------------------------------------------------

export default function LiveStatus() {
  const [state, setState] = useState({ status: 'loading', data: null });

  useEffect(() => {
    // Nothing to fetch when the counts are hidden — the dot is static.
    if (!site.showMemberCounts) return;

    let cancelled = false;
    const controller = new AbortController();

    fetch('/api/discord', { signal: controller.signal })
      .then((response) => response.json())
      .then((json) => {
        if (cancelled) return;
        setState(
          json.ok
            ? { status: 'ready', data: json }
            : { status: 'unavailable', data: null }
        );
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'unavailable', data: null });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  // --- Counts hidden: just the live dot ---------------------------------
  if (!site.showMemberCounts) {
    return (
      <div className="inline-flex min-h-11 items-center gap-2.5 rounded-sm border border-edge/70 bg-surface/60 px-4">
        <span className="live-dot" aria-hidden="true" />
        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-body">
          Live
        </span>
        <span className="sr-only">The server is active.</span>
      </div>
    );
  }

  // --- Counts shown ------------------------------------------------------
  return (
    <div
      className="inline-flex min-h-11 items-center gap-3 rounded-sm border border-edge/70 bg-surface/60 px-4"
      aria-live="polite"
    >
      <span className="live-dot" aria-hidden="true" />

      {state.status === 'loading' ? (
        // Skeleton occupying the same width the numbers will need.
        <span className="h-3 w-40 animate-pulse rounded-sm bg-edge/60" aria-hidden="true" />
      ) : state.status === 'ready' ? (
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-body">
          <span className="text-primary">{state.data.online?.toLocaleString()}</span> online
          <span className="mx-2 text-edge" aria-hidden="true">
            /
          </span>
          <span className="text-primary">{state.data.members?.toLocaleString()}</span> members
        </span>
      ) : (
        // The API failed or the invite expired. Fall back to the plain label
        // rather than showing an error to a visitor who can't act on it.
        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-body">
          Live
        </span>
      )}
    </div>
  );
}
