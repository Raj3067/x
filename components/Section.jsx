import Reveal from './Reveal';

// ---------------------------------------------------------------------------
// Section — consistent vertical rhythm and container width for every block.
//
// Every page uses this, so max-width and padding stay identical site-wide
// instead of drifting per page.
// ---------------------------------------------------------------------------

export default function Section({
  children,
  id,
  eyebrow,
  title,
  lead,
  className = '',
  contentClassName = '',
  reveal = true,
}) {
  const Wrapper = reveal ? Reveal : 'div';

  return (
    <section id={id} className={`px-4 py-16 sm:px-6 sm:py-20 lg:px-8 ${className}`}>
      <div className="mx-auto max-w-shell">
        {eyebrow || title || lead ? (
          <Wrapper className="max-w-2xl">
            {eyebrow ? (
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                {eyebrow}
              </p>
            ) : null}

            {title ? (
              <h2 className="mt-3 text-3xl uppercase sm:text-4xl">{title}</h2>
            ) : null}

            {/* max-w on the lead keeps line length in the readable 65–75
                character range instead of stretching across a wide viewport. */}
            {lead ? (
              <p className="mt-4 max-w-prose text-base leading-relaxed text-muted">
                {lead}
              </p>
            ) : null}
          </Wrapper>
        ) : null}

        <div className={contentClassName}>{children}</div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// PageHeader — the top of every route other than the homepage.
// ---------------------------------------------------------------------------

export function PageHeader({ eyebrow, title, lead }) {
  return (
    <header className="relative overflow-hidden border-b border-edge/50 px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
      {/* Decorative wash behind the heading. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(34,211,238,0.10),transparent_60%),radial-gradient(ellipse_at_bottom_right,rgba(124,58,237,0.12),transparent_55%)]"
      />

      <div className="relative mx-auto max-w-shell">
        <Reveal>
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              {eyebrow}
            </p>
          ) : null}

          <h1 className="mt-3 text-4xl uppercase sm:text-5xl lg:text-6xl">
            <span className="glow-primary">{title}</span>
          </h1>

          {lead ? (
            <p className="mt-5 max-w-prose text-base leading-relaxed text-muted sm:text-lg">
              {lead}
            </p>
          ) : null}
        </Reveal>
      </div>
    </header>
  );
}
