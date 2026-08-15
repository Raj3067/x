'use client';

/**
 * One shared answer to "is the 3D background up yet?".
 *
 * SiteBackdrop makes all the decisions and reports them here; BootScreen only
 * reads. They are siblings in the layout, so a context is the only way to get a
 * signal from one to the other without hoisting the whole backdrop into the
 * boot screen and rebuilding the scene whenever the overlay re-renders.
 *
 * `phase` is a one-way street — the first report to land settles it for good:
 *
 *   pending  still resolving the motion preference, or the scene is building
 *   ready    the canvas has painted its first frame
 *   skipped  this visitor is never getting a canvas (reduced motion, no WebGL,
 *            small screen, coarse pointer, data saver) — nothing to wait for
 *   failed   the GPU dropped the context, or the build threw
 *
 * Anything but 'pending' means the boot screen must go. It is a loading screen,
 * not a gate: a visitor who will never see the castle must not be left staring
 * at a progress bar that can never fill.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

// Used when a component reads this outside the provider. No-ops rather than a
// throw: the boot screen going missing is a cosmetic fault, not a broken page.
const FALLBACK = {
  phase: 'pending',
  progress: 0,
  stage: 'boot',
  reportProgress: () => {},
  settle: () => {},
};

const SceneStatusContext = createContext(FALLBACK);

export function SceneStatusProvider({ children }) {
  const [phase, setPhase] = useState('pending');
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('boot');

  // Both refs, because they only ever guard writes and must be readable
  // synchronously inside a report that may arrive mid-render-cycle.
  //
  // `settled` exists because a build being torn down can still report progress
  // from a continuation already in flight. `highWater` because a progress bar
  // that slides backwards reads as broken even when the number is honest.
  const settled = useRef(false);
  const highWater = useRef(0);

  const reportProgress = useCallback((value, nextStage) => {
    if (settled.current) return;
    if (typeof value === 'number' && value > highWater.current) {
      // Capped below 1: only `settle('ready')` is allowed to fill the bar, so
      // it never sits at 100% with the site still hidden behind it.
      highWater.current = Math.min(value, 0.99);
      setProgress(highWater.current);
    }
    if (nextStage) setStage(nextStage);
  }, []);

  const settle = useCallback((next) => {
    if (settled.current) return;
    settled.current = true;
    setPhase(next);
    if (next === 'ready') {
      highWater.current = 1;
      setProgress(1);
    }
  }, []);

  const value = useMemo(
    () => ({ phase, progress, stage, reportProgress, settle }),
    [phase, progress, stage, reportProgress, settle],
  );

  return (
    <SceneStatusContext.Provider value={value}>
      {children}
    </SceneStatusContext.Provider>
  );
}

export function useSceneStatus() {
  return useContext(SceneStatusContext);
}
