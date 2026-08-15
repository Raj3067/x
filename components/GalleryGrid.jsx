'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { gallery } from '@/content/site.config';
import Icon from './Icon';
import Reveal from './Reveal';

// ---------------------------------------------------------------------------
// GalleryGrid — tile grid with a lightbox.
//
// Tiles with `src: null` render a styled placeholder at the same aspect ratio
// a real image will occupy, so dropping files into public/gallery/ later can't
// reflow the page. Placeholders aren't clickable — there's nothing to enlarge.
//
// Lightbox accessibility:
//   - role="dialog" aria-modal, labelled by the image's alt text
//   - focus moves in on open and returns to the triggering tile on close
//   - Escape closes; arrow keys move between images
//   - focus is trapped inside while open
//   - background scroll is locked
// ---------------------------------------------------------------------------

export default function GalleryGrid() {
  // Index into the *viewable* subset, or null when closed.
  const [openIndex, setOpenIndex] = useState(null);
  const triggerRefs = useRef([]);
  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  // Only real images participate in the lightbox.
  const viewable = gallery.filter((item) => item.src);

  const close = useCallback(() => {
    setOpenIndex((current) => {
      // Return focus to the tile that opened it.
      if (current !== null) {
        const item = viewable[current];
        const originalIndex = gallery.indexOf(item);
        triggerRefs.current[originalIndex]?.focus();
      }
      return null;
    });
  }, [viewable]);

  const step = useCallback(
    (delta) => {
      setOpenIndex((current) => {
        if (current === null) return current;
        // Wrap around at both ends.
        return (current + delta + viewable.length) % viewable.length;
      });
    },
    [viewable.length]
  );

  // Keyboard handling + scroll lock while the lightbox is open.
  useEffect(() => {
    if (openIndex === null) return;

    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        step(1);
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        step(-1);
        return;
      }

      // Focus trap: keep Tab cycling within the dialog.
      if (event.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', onKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    closeRef.current?.focus();

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [openIndex, close, step]);

  const current = openIndex !== null ? viewable[openIndex] : null;

  return (
    <>
      <ul className="grid auto-rows-[minmax(0,1fr)] grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {gallery.map((item, index) => {
          const wide = item.span === 'wide';
          const viewIndex = item.src ? viewable.indexOf(item) : -1;

          return (
            <Reveal
              as="li"
              key={index}
              delay={index * 50}
              className={wide ? 'col-span-2' : undefined}
            >
              {item.src ? (
                <button
                  type="button"
                  ref={(node) => {
                    triggerRefs.current[index] = node;
                  }}
                  onClick={() => setOpenIndex(viewIndex)}
                  className="group relative block w-full cursor-pointer overflow-hidden rounded-sm border border-edge/60 transition-colors duration-200 hover:border-primary/60 focus-visible:border-primary"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.src}
                    alt={item.alt}
                    loading="lazy"
                    className="aspect-[4/3] w-full object-cover"
                  />
                  {/* Hover veil — opacity only, so nothing shifts. */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-ink/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
                  />
                  <span className="sr-only">Enlarge: {item.alt}</span>
                </button>
              ) : (
                <PlaceholderTile alt={item.alt} />
              )}
            </Reveal>
          );
        })}
      </ul>

      {current ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={current.alt}
          className="fixed inset-0 z-modal flex flex-col bg-ink/95 p-4 backdrop-blur-sm sm:p-8"
        >
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted">
              {openIndex + 1} / {viewable.length}
            </p>

            <button
              type="button"
              ref={closeRef}
              onClick={close}
              className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-sm border border-edge/70 text-muted transition-colors duration-200 hover:border-primary/60 hover:text-primary"
              aria-label="Close"
            >
              <Icon name="close" className="h-5 w-5" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center gap-3 py-4">
            {viewable.length > 1 ? (
              <button
                type="button"
                onClick={() => step(-1)}
                className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-edge/70 text-muted transition-colors duration-200 hover:border-primary/60 hover:text-primary"
                aria-label="Previous image"
              >
                <Icon name="arrowRight" className="h-5 w-5 rotate-180" />
              </button>
            ) : null}

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.src}
              alt={current.alt}
              className="max-h-full min-h-0 max-w-full rounded-sm border border-edge/60 object-contain"
            />

            {viewable.length > 1 ? (
              <button
                type="button"
                onClick={() => step(1)}
                className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-edge/70 text-muted transition-colors duration-200 hover:border-primary/60 hover:text-primary"
                aria-label="Next image"
              >
                <Icon name="arrowRight" className="h-5 w-5" />
              </button>
            ) : null}
          </div>

          <p className="text-center text-sm text-muted">{current.alt}</p>
        </div>
      ) : null}
    </>
  );
}

function PlaceholderTile({ alt }) {
  return (
    <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-sm border border-dashed border-edge/70 bg-surface/40 p-4 text-center">
      <Icon name="image" className="h-6 w-6 text-edge" />
      <p className="text-[0.65rem] uppercase tracking-[0.18em] text-muted">
        Image slot
      </p>
      {/* The TODO alt text is shown deliberately, so it's obvious in the UI
          which tiles still need filling rather than only in the config. */}
      <p className="max-w-[22ch] text-xs leading-snug text-edge">{alt}</p>
    </div>
  );
}
