'use client';

import { useEffect, useRef } from 'react';
import { useMotion } from './MotionProvider';

// ---------------------------------------------------------------------------
// Parallax — moves a decorative layer at a fraction of scroll speed.
//
// Writes a `--parallax` custom property that the CSS transform reads. Updates
// are batched into requestAnimationFrame so a fast scroll produces at most one
// write per frame, and only transform is touched — no layout, no repaint.
//
// Decorative only. Never wrap text or interactive content in this: offsetting
// a click target from where it appears is an accessibility problem.
// ---------------------------------------------------------------------------

export default function Parallax({
  children,
  speed = 0.25,
  className = '',
  ...rest
}) {
  const ref = useRef(null);
  const { motionOn } = useMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (!motionOn) {
      node.style.removeProperty('--parallax');
      return;
    }

    let frame = null;

    const update = () => {
      frame = null;
      const rect = node.getBoundingClientRect();
      // Distance of this element's centre from the viewport centre.
      const fromCentre = rect.top + rect.height / 2 - window.innerHeight / 2;
      node.style.setProperty('--parallax', `${(fromCentre * speed).toFixed(2)}px`);
    };

    const onScroll = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [motionOn, speed]);

  return (
    <div ref={ref} className={`parallax-layer ${className}`} aria-hidden="true" {...rest}>
      {children}
    </div>
  );
}
