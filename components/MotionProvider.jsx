'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// MotionProvider
//
// Single source of truth for whether animation runs. It adds or removes the
// `motion-on` class on <html>, and every effect in globals.css is scoped to
// that class — so one class swap turns the entire CRT treatment on or off.
//
// Precedence, strictest first:
//   1. OS `prefers-reduced-motion: reduce`  -> always off, toggle disabled
//   2. Saved visitor choice in localStorage -> honoured
//   3. Default                              -> on
//
// Effects default ON per the brief, but the OS preference always wins and can
// never be overridden by the toggle. Someone who has asked their system for
// less motion should not have to ask again on every site.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'lb-motion';

const MotionContext = createContext({
  motionOn: false,
  toggleMotion: () => {},
  systemReduced: false,
  ready: false,
});

export function MotionProvider({ children }) {
  const [motionOn, setMotionOn] = useState(false);
  const [systemReduced, setSystemReduced] = useState(false);
  // Guards the toggle button from rendering a wrong label during hydration.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');

    const resolve = () => {
      const reduced = query.matches;
      setSystemReduced(reduced);

      if (reduced) {
        setMotionOn(false);
        setReady(true);
        return;
      }

      let saved = null;
      try {
        saved = window.localStorage.getItem(STORAGE_KEY);
      } catch {
        // Private browsing or blocked storage — fall through to the default.
      }

      setMotionOn(saved === null ? true : saved === 'on');
      setReady(true);
    };

    resolve();
    query.addEventListener('change', resolve);
    return () => query.removeEventListener('change', resolve);
  }, []);

  // Mirror state onto <html> so CSS can act on it.
  useEffect(() => {
    if (!ready) return;
    document.documentElement.classList.toggle('motion-on', motionOn);
  }, [motionOn, ready]);

  const toggleMotion = useCallback(() => {
    if (systemReduced) return; // OS preference is not overridable.
    setMotionOn((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off');
      } catch {
        // Non-fatal: the choice just won't persist across visits.
      }
      return next;
    });
  }, [systemReduced]);

  return (
    <MotionContext.Provider value={{ motionOn, toggleMotion, systemReduced, ready }}>
      {children}
    </MotionContext.Provider>
  );
}

export function useMotion() {
  return useContext(MotionContext);
}
