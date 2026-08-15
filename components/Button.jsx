import Link from 'next/link';
import Icon from './Icon';

// ---------------------------------------------------------------------------
// Button / ButtonLink
//
// One place for button styling so every CTA on the site matches. Renders an
// <a> when `href` is given (external links get rel="noreferrer") and a
// <button> otherwise — the right element for the job, always.
//
// Hover changes colour and glow only, never scale, so nothing shifts under the
// cursor mid-click.
// ---------------------------------------------------------------------------

const base =
  'inline-flex items-center justify-center gap-2 rounded-sm font-display uppercase tracking-[0.14em] transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50';

const variants = {
  // The join-the-server CTA. Rose is reserved for exactly this.
  cta:
    'bg-cta text-white shadow-neon-cta hover:bg-rose-400 focus-visible:bg-rose-400 cursor-pointer',
  // Standard action.
  primary:
    'bg-primary text-ink shadow-neon-primary hover:bg-cyan-300 focus-visible:bg-cyan-300 cursor-pointer',
  // Secondary action alongside a primary one.
  outline:
    'border border-edge bg-transparent text-body hover:border-primary hover:text-primary focus-visible:border-primary focus-visible:text-primary cursor-pointer',
  ghost:
    'bg-transparent text-muted hover:text-primary focus-visible:text-primary cursor-pointer',
};

const sizes = {
  // min-h-11 == 44px, the minimum comfortable touch target.
  sm: 'min-h-11 px-4 text-xs',
  md: 'min-h-12 px-6 text-sm',
  lg: 'min-h-14 px-8 text-base',
};

export function ButtonLink({
  href,
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  icon,
  external,
  ...rest
}) {
  const classes = `${base} ${variants[variant]} ${sizes[size]} ${className}`;
  const isExternal = external ?? /^https?:\/\//.test(href ?? '');

  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={classes}
        {...rest}
      >
        {icon ? <Icon name={icon} className="h-4 w-4" /> : null}
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={classes} {...rest}>
      {icon ? <Icon name={icon} className="h-4 w-4" /> : null}
      {children}
    </Link>
  );
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  icon,
  loading = false,
  type = 'button',
  ...rest
}) {
  return (
    <button
      type={type}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      // Disabled while a request is in flight so a double-click can't submit twice.
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading ? (
        <Icon name="spinner" className="h-4 w-4 animate-spin" />
      ) : icon ? (
        <Icon name={icon} className="h-4 w-4" />
      ) : null}
      {children}
    </button>
  );
}
