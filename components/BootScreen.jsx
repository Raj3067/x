'use client';

/**
 * BootScreen — the full-page loading screen shown before the site appears.
 *
 * The 3D castle takes a while to arrive: a lazily-loaded chunk, ~2s of canvas
 * texture work, an IBL prefilter pass, and a first frame that compiles every
 * shader in the scene. Without this, a visitor sees the finished page against a
 * flat CSS gradient and then the castle pops in behind it several seconds later.
 * This holds the whole site behind an opaque panel until the scene is actually on
 * screen, so the first thing anyone sees is the finished thing.
 *
 * What it must never do is trap someone. Every path where the canvas will not
 * arrive dismisses it:
 *
 *   - reduced motion, no WebGL, phone, coarse pointer, data saver
 *     -> SiteBackdrop reports 'skipped' and this never paints at all
 *   - the GPU drops the context or the build throws
 *     -> SiteBackdrop reports 'failed'
 *   - a build that is merely very slow, or wedged with no error
 *     -> the timeout below gives up and shows the site regardless
 *
 * Two-stage exit, driven by CSS: `phase` leaving 'pending' adds the leaving
 * class, which fades the panel out over BOOT_FADE_MS; a timer then unmounts it.
 * Unmounting on the same tick would cut the fade off, and leaving it mounted
 * forever would keep a full-viewport fixed element in the layer tree.
 */

import { useEffect, useRef, useState } from 'react';
import { useSceneStatus } from '@/components/SceneStatusProvider';
import { site } from '@/content/site.config';

// Keep in step with the `boot-fade-out` animation in globals.css.
const BOOT_FADE_MS = 620;

/**
 * Backstop. If the scene has not reported ready by this point, show the site
 * anyway and let the canvas fade in behind it whenever it lands.
 *
 * 12s rather than something tighter because it has to cover a genuinely slow but
 * healthy machine: measured at ~1.9s of texture work on the high tier plus the
 * lazy chunk download (152K gzip) plus shader compilation, and a cold cache on a
 * weak connection can stack those. Anything under about 8s would start firing on
 * builds that were going to succeed, which is worse than waiting — a visitor who
 * gets the site early and the castle late is exactly the pop-in this exists to
 * prevent.
 */
const BOOT_TIMEOUT_MS = 12000;

/**
 * How long the screen stays up at minimum, in ms.
 *
 * A warm cache can finish before the first paint, and a loading screen that
 * appears and vanishes inside 150ms is a flash of noise, not information. This
 * floor is short enough not to feel like a gate and long enough for the panel to
 * read as deliberate.
 */
const BOOT_MIN_MS = 700;

/* --------------------------------------------------------------------------
 * Synthetic creep
 *
 * The scene reports in nine coarse steps, and the first of them cannot arrive
 * until the lazy chunk has downloaded and parsed — on a cold cache that is a
 * second or more with nothing to report. A bar pinned at 0% through it looks
 * broken, so a synthetic component fills the gap.
 *
 * It is an asymptote, not a ramp: `ceiling * (1 - e^(-t/tau))` decelerates
 * forever and never arrives, so it cannot run ahead of the truth and sit at 100%
 * with the scene still building. The displayed value is the greater of the
 * synthetic and the real one, which means the real reports take over the moment
 * they start landing — measured, the texture build passes the creep within about
 * two seconds and the bar is honest from there on.
 *
 * Ceiling below the 0.99 the provider caps real progress at, for the same
 * reason: only an actual `ready` is allowed to fill the bar.
 * ------------------------------------------------------------------------ */
const CREEP_CEILING = 0.86;
const CREEP_TAU_MS = 2600;
// Per-frame approach rate toward the target. 0.12 at 60fps settles a jump in
// roughly a fifth of a second — fast enough to feel responsive to a real report,
// slow enough that a six-step build glides rather than snapping.
const CREEP_EASE = 0.12;

const STAGE_LABELS = {
  boot: 'initialising',
  renderer: 'starting renderer',
  masonry: 'cutting stone',
  'roof tiles': 'laying roof tiles',
  plaster: 'rendering plaster',
  timber: 'raising timber',
  grounds: 'landscaping grounds',
  water: 'filling the moat',
  keep: 'building the keep',
  walls: 'raising the walls',
  lighting: 'hanging lanterns',
  compositing: 'lighting the scene',
};

export default function BootScreen() {
  const { phase, progress, stage } = useSceneStatus();

  // Mount state is separate from `phase` so the exit animation has somewhere to
  // live: `visible` false unmounts, `leaving` true is mid-fade.
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);
  // Drives the timeout backstop. Set once, never cleared — a slow build that
  // finishes later still gets to fade the canvas in normally.
  const [timedOut, setTimedOut] = useState(false);

  // When this screen first painted. Used for the minimum-duration floor.
  const mountedAt = useRef(0);
  if (mountedAt.current === 0 && typeof performance !== 'undefined') {
    mountedAt.current = performance.now();
  }

  useEffect(() => {
    const id = window.setTimeout(() => setTimedOut(true), BOOT_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, []);

  // Dismiss on either signal: the scene settled (ready, skipped, or failed), or
  // the backstop fired. Both are terminal — nothing sets these back to false —
  // so this screen can only ever go away, never return.
  const settled = phase !== 'pending' || timedOut;

  useEffect(() => {
    if (!settled) return undefined;

    const elapsed =
      typeof performance !== 'undefined'
        ? performance.now() - mountedAt.current
        : BOOT_MIN_MS;
    const hold = Math.max(0, BOOT_MIN_MS - elapsed);

    // Two chained timers: hold out the floor, start the fade, then unmount.
    let unmountId = 0;
    const fadeId = window.setTimeout(() => {
      setLeaving(true);
      unmountId = window.setTimeout(() => setVisible(false), BOOT_FADE_MS);
    }, hold);

    return () => {
      window.clearTimeout(fadeId);
      window.clearTimeout(unmountId);
    };
  }, [settled]);

  // Scroll lock. A visitor who scrolls behind the panel arrives at the middle of
  // a page they have not seen; worse, the scene's camera path is driven by scroll
  // progress, so it would start mid-flythrough. Removed on unmount rather than
  // when `leaving` starts, so nothing moves under the fade.
  useEffect(() => {
    if (!visible) return undefined;
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = previous;
    };
  }, [visible]);

  /* ----------------------------------------------------------------------
   * The bar's own animation loop.
   *
   * `shown` is what the bar draws; it is not the same number the scene
   * reported. Each frame it eases toward whichever is further along — the
   * synthetic creep or the real progress — so the bar is always moving even
   * while the scene has nothing new to say, and never jumps when it does.
   *
   * Driven by rAF rather than a CSS width transition because the two would
   * fight: a transition animating toward a target that changes every frame
   * restarts continuously and ends up lagging by its own duration.
   * -------------------------------------------------------------------- */
  const [shown, setShown] = useState(0);
  // Read inside the loop without restarting it. A rAF loop that re-subscribes
  // on every progress report drops a frame each time.
  const liveRef = useRef({ progress: 0, settled: false });
  liveRef.current = { progress, settled };

  useEffect(() => {
    if (!visible) return undefined;

    const startedAt = performance.now();
    let raf = 0;
    let value = 0;

    const step = (now) => {
      const live = liveRef.current;

      let goal;
      if (live.settled) {
        // Dismissing. Run to full regardless of what the scene last said, so the
        // bar never fades out half-empty.
        goal = 1;
      } else {
        const elapsed = now - startedAt;
        const creep = CREEP_CEILING * (1 - Math.exp(-elapsed / CREEP_TAU_MS));
        goal = Math.max(creep, live.progress);
      }

      value += (goal - value) * CREEP_EASE;
      // Snap the last hair. Easing toward 1 approaches it asymptotically, and a
      // bar that stops at 99.6% during the fade is a visible defect.
      if (goal - value < 0.005) value = goal;

      setShown(value);
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  if (!visible) return null;

  // Two resolutions of the same number. The width gets one decimal so the bar
  // moves smoothly at 60fps — at whole percents a slow creep visibly steps. The
  // readout and aria-valuenow get whole percents, because a fractional loading
  // percentage reads as a bug and a screen reader does not want two decimals.
  const width = (shown * 100).toFixed(1);
  const pct = Math.round(shown * 100);
  const label = STAGE_LABELS[stage] ?? 'loading';

  return (
    <div
      className={`boot-screen${leaving ? ' boot-screen--leaving' : ''}`}
      // Not aria-hidden: this is the only content on screen while it is up, and
      // hiding it would leave a screen reader on an empty page. `role="status"`
      // with aria-live polite announces the stage changes without stealing focus.
      role="status"
      aria-live="polite"
    >
      <div className="boot-screen__panel">
        <p className="boot-screen__eyebrow">Initialising</p>

        <p className="boot-screen__mark">{site.serverName}</p>

        {/* Progress is announced as text below rather than through the bar's own
            aria attributes — a bar that ticks 1% at a time would otherwise be
            read out dozens of times. */}
        <div
          className="boot-screen__track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label="Loading 3D scene"
        >
          <div className="boot-screen__fill" style={{ width: `${width}%` }} />
        </div>

        <p className="boot-screen__stage">
          <span className="boot-screen__stage-label">{label}</span>
          <span className="boot-screen__stage-pct" aria-hidden="true">
            {String(pct).padStart(3, '0')}%
          </span>
        </p>
      </div>
    </div>
  );
}
