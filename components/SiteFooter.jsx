import Link from 'next/link';
import { nav, site } from '@/content/site.config';
import Wordmark from './Wordmark';
import Icon from './Icon';

// ---------------------------------------------------------------------------
// SiteFooter
// ---------------------------------------------------------------------------

export default function SiteFooter() {
  const items = nav.filter((item) => !item.requires || site[item.requires]);
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-24 border-t border-edge/50 bg-surface/40">
      <div className="mx-auto max-w-shell px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Identity */}
          <div className="lg:col-span-2">
            <Wordmark lines={site.wordmark} size="sm" />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
              {site.description}
            </p>
            <a
              href={site.inviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-primary transition-colors duration-200 hover:text-cyan-300"
            >
              <Icon name="discord" className="h-4 w-4" />
              Join the server
            </a>
          </div>

          {/* Pages */}
          <nav aria-label="Footer">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-body">
              Pages
            </h2>
            <ul className="mt-4 space-y-1">
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="inline-flex min-h-9 cursor-pointer items-center text-sm text-muted transition-colors duration-200 hover:text-primary"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Socials — the whole block is omitted when the array is empty,
              rather than rendering an empty heading. */}
          {site.socials.length > 0 ? (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-body">
                Elsewhere
              </h2>
              <ul className="mt-4 space-y-1">
                {site.socials.map((social) => (
                  <li key={social.url}>
                    <a
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-9 cursor-pointer items-center text-sm text-muted transition-colors duration-200 hover:text-primary"
                    >
                      {social.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="hr-neon mt-10" />

        <div className="mt-6 flex flex-col gap-2 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {year} {site.serverName}. Not affiliated with Discord Inc.
          </p>
          <p>
            <Link
              href="/rules"
              className="cursor-pointer transition-colors duration-200 hover:text-primary"
            >
              Server rules
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
