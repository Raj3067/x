// ---------------------------------------------------------------------------
// Wordmark — the LEGENDARY BEASTS lockup.
//
// Two stacked lines in the display face with wide tracking. Three copies of the
// text sit on top of each other: the real one, plus a cyan and a magenta layer
// clipped to the top and bottom halves. Idle, they give a faint chromatic
// fringe; on hover they jump to full strength and jitter.
//
// The offset copies are aria-hidden so screen readers announce the name once.
// This is a server component — the glitch is pure CSS, no client JS needed.
// ---------------------------------------------------------------------------

export default function Wordmark({ lines, size = 'md', className = '' }) {
  const sizes = {
    sm: 'text-lg sm:text-xl',
    md: 'text-2xl sm:text-3xl',
    lg: 'text-4xl sm:text-6xl lg:text-7xl',
    xl: 'text-5xl sm:text-7xl lg:text-8xl',
  };

  const tracking = {
    sm: 'tracking-[0.16em]',
    md: 'tracking-[0.18em]',
    lg: 'tracking-[0.14em]',
    xl: 'tracking-[0.12em]',
  };

  return (
    <span
      className={`glitch font-display leading-[0.95] ${sizes[size]} ${tracking[size]} ${className}`}
    >
      {/* Offset colour layers, clipped top/bottom. Decorative. */}
      <span className="glitch__layer glitch__layer--a" aria-hidden="true">
        <WordmarkLines lines={lines} />
      </span>
      <span className="glitch__layer glitch__layer--b" aria-hidden="true">
        <WordmarkLines lines={lines} />
      </span>

      {/* The real, readable text. */}
      <span className="relative glow-primary">
        <WordmarkLines lines={lines} />
      </span>
    </span>
  );
}

function WordmarkLines({ lines }) {
  return (
    <span className="block">
      {lines.map((line, i) => (
        <span key={line} className="block">
          {/* Second line takes the violet tint so the lockup reads as one
              object with two weights rather than two separate words. */}
          <span className={i === 1 ? 'text-secondary/90' : undefined}>{line}</span>
        </span>
      ))}
    </span>
  );
}
