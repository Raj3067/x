'use client';

/**
 * Site-wide 3D background.
 *
 * Decides whether this visitor gets the WebGL castle flythrough or the CSS
 * gradient. The CSS layer is always rendered and is what ships in the HTML — it
 * is the baseline, not a placeholder. CastleScene3D is dynamically imported only
 * after the checks below pass, so clients that fail them download no three.js.
 *
 * Mounted once in the root layout, so the canvas persists across client-side
 * navigation instead of tearing down and rebuilding the scene on every route
 * change. That is the whole reason this lives in the layout rather than a page.
 *
 * `ssr: false` is only legal inside a Client Component, which is why this file
 * exists as a separate layer from the Server Component layout.
 */

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useMotion } from '@/components/MotionProvider';
import { useSceneStatus } from '@/components/SceneStatusProvider';

// Must be a literal specifier at module scope for the lazy chunk to be split.
const CastleScene3D = dynamic(() => import('@/components/CastleScene3D'), {
  ssr: false,
});

/** Cheap probe for a usable WebGL context. Discarded immediately. */
function hasWebGL() {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * Devices we deliberately skip: small screens, coarse pointers, low core
 * counts, declared low memory, and data-saver users. Missing values are treated
 * as "fine" — most browsers do not expose deviceMemory at all.
 *
 * This matters more now than it did as a hero-only effect: a full-viewport
 * canvas rendering behind every page is a much larger ongoing cost.
 */
function isCapableDevice() {
  if (window.matchMedia('(max-width: 767px)').matches) return false;
  if (window.matchMedia('(pointer: coarse)').matches) return false;

  const cores = navigator.hardwareConcurrency;
  if (typeof cores === 'number' && cores > 0 && cores < 4) return false;

  const memory = navigator.deviceMemory;
  if (typeof memory === 'number' && memory > 0 && memory < 4) return false;

  if (navigator.connection?.saveData) return false;

  return true;
}

export default function SiteBackdrop() {
  const { motionOn, ready } = useMotion();
  const { reportProgress, settle } = useSceneStatus();
  const [allowed, setAllowed] = useState(false);
  // Only true once the canvas has painted, so the CSS layer stays visible
  // through the load and there is never a frame with no background at all.
  const [live, setLive] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // `motionOn` already accounts for the OS reduced-motion preference — the
    // provider forces it off and locks the toggle in that case.
    if (!ready || !motionOn || failed) {
      setAllowed(false);
      setLive(false);
      // Nothing is coming, so tell the boot screen to stop waiting. `ready`
      // false is the one case that is not terminal — the provider is still
      // resolving the motion preference, which takes one effect tick.
      if (ready) settle(failed ? 'failed' : 'skipped');
      return;
    }

    const ok = hasWebGL() && isCapableDevice();
    setAllowed(ok);
    // Same again for a visitor the capability gate turns away: the canvas will
    // never mount, so no onReady is ever coming.
    if (!ok) settle('skipped');
  }, [ready, motionOn, failed, settle]);

  return (
    // aria-hidden and pointer-events-none: this is decoration behind every page,
    // and must never intercept a click or land in the accessibility tree.
    <div className="site-backdrop" aria-hidden="true">
      {/* CSS baseline. Static gradients, no animation — it is what visitors on
          reduced motion or low-power devices keep. */}
      <div
        className="site-backdrop__css"
        style={live ? { opacity: 0 } : undefined}
      />

      {allowed ? (
        <CastleScene3D
          onProgress={reportProgress}
          onReady={() => {
            setLive(true);
            settle('ready');
          }}
          onLost={() => {
            // Give up permanently rather than thrashing a struggling GPU.
            setFailed(true);
            setLive(false);
            // Harmless if the scene already reported ready and the context was
            // lost later — the provider ignores everything after the first
            // settle, so this cannot bring the boot screen back.
            settle('failed');
          }}
        />
      ) : null}

      {/* Scrim between the canvas and the content. Without it, body text sits
          over a moving scene and contrast drops below 4.5:1 wherever the sky's
          warm band or a lit window passes behind it. */}
      <div className="site-backdrop__scrim" />
    </div>
  );
}
