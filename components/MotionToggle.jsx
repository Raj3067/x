'use client';

import { useMotion } from './MotionProvider';

// ---------------------------------------------------------------------------
// MotionToggle — fixed control in the bottom-right corner.
//
// Escape hatch from the CRT effects. When the OS already asks for reduced
// motion the button is disabled and says so, rather than offering a switch
// that would do nothing.
// ---------------------------------------------------------------------------

export default function MotionToggle() {
  const { motionOn, toggleMotion, systemReduced, ready } = useMotion();

  // Render nothing until the preference resolves — avoids a flash of the wrong
  // label on first paint.
  if (!ready) return null;

  if (systemReduced) {
    return (
      <div
        className="fixed bottom-4 right-4 z-overlay flex items-center gap-2 rounded-sm border border-edge/70 bg-surface/95 px-3 py-2 text-[0.65rem] uppercase tracking-[0.18em] text-muted backdrop-blur-sm"
        role="status"
      >
        <MotionOffIcon />
        <span>Motion off (system)</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleMotion}
      aria-pressed={motionOn}
      className="group fixed bottom-4 right-4 z-overlay flex cursor-pointer items-center gap-2 rounded-sm border border-edge/70 bg-surface/95 px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted backdrop-blur-sm transition-colors duration-200 hover:border-primary/60 hover:text-primary focus-visible:border-primary focus-visible:text-primary"
    >
      {motionOn ? <MotionOnIcon /> : <MotionOffIcon />}
      <span>Motion {motionOn ? 'on' : 'off'}</span>
      <span className="sr-only">
        {motionOn
          ? 'Turn off animations and visual effects'
          : 'Turn on animations and visual effects'}
      </span>
    </button>
  );
}

/* Lucide "zap" — 24x24 viewBox, matching every other icon in the project. */
function MotionOnIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <path d="M4 14h6l-2 8 10-12h-6l2-8z" />
    </svg>
  );
}

/* Lucide "zap-off". */
function MotionOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <path d="M10.5 3.5 12 2l-1 4" />
      <path d="M4 14h6l-1.2 4.8" />
      <path d="M14 10h6l-4.5 5.4" />
      <line x1="3" y1="3" x2="21" y2="21" />
    </svg>
  );
}
