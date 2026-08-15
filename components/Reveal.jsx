'use client';

import { useEffect, useRef } from 'react';
import { useMotion } from './MotionProvider';

// ---------------------------------------------------------------------------
// Reveal — fades a section in when it scrolls into view.
//
// Adds `is-visible` via IntersectionObserver. The CSS only defines a starting
// offset under `.motion-on`, so with motion off the content is simply visible
// from the start — content is never gated behind an animation that might not run.
//
// `as` lets this wrap any element (section, div, li) without an extra node.
// ---------------------------------------------------------------------------

export default function Reveal({
  children,
  as: Tag = 'div',
  className = '',
  delay = 0,
  ...rest
}) {
  const ref = useRef(null);
  const { motionOn } = useMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Motion off: mark visible immediately, skip the observer entirely.
    if (!motionOn) {
      node.classList.add('is-visible');
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      node.classList.add('is-visible');
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          // One-shot: never animate back out on scroll-up.
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [motionOn]);

  return (
    <Tag
      ref={ref}
      className={`reveal ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}
