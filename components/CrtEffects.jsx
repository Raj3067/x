'use client';

import { useMotion } from './MotionProvider';

// ---------------------------------------------------------------------------
// CrtEffects — the fixed overlay layers.
//
// Both elements are always in the DOM; globals.css shows them only under
// `.motion-on`. Rendering them unconditionally keeps this component free of
// hydration mismatches — the CSS does the switching, not React.
//
// pointer-events:none (set in CSS) means neither ever intercepts a click.
// ---------------------------------------------------------------------------

export default function CrtEffects() {
  // Read purely so the layers unmount when motion is off, freeing the
  // compositor layers rather than leaving two idle fixed elements behind.
  const { motionOn } = useMotion();

  if (!motionOn) return null;

  return (
    <>
      <div className="crt-overlay" aria-hidden="true" />
      <div className="crt-sweep" aria-hidden="true" />
    </>
  );
}
