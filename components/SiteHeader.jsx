'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { nav, site } from '@/content/site.config';
import Icon from './Icon';
import Wordmark from './Wordmark';
import { ButtonLink } from './Button';

// ---------------------------------------------------------------------------
// SiteHeader — sticky nav.
//
// Floats with a gap from the viewport edges rather than sitting flush, per the
// design guidance. Layout reserves --nav-h so no content hides underneath.
//
// Mobile: a disclosure panel. It closes on route change (otherwise it stays
// open over the new page) and on Escape.
// ---------------------------------------------------------------------------

export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the panel whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape closes the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Hide nav items whose feature flag is off.
  const items = nav.filter((item) => !item.requires || site[item.requires]);

  return (
    <header className="fixed inset-x-3 top-3 z-nav sm:inset-x-4 sm:top-4">
      <div className="mx-auto flex max-w-shell items-center justify-between gap-4 rounded-sm border border-edge/70 bg-ink/90 px-3 py-2.5 backdrop-blur-md sm:px-4">
        <Link
          href="/"
          className="shrink-0 cursor-pointer"
          aria-label={`${site.serverName} — home`}
        >
          <Wordmark lines={site.wordmark} size="sm" />
        </Link>

        {/* Desktop nav */}
        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {items.map((item) => {
              const active =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`inline-flex min-h-11 cursor-pointer items-center rounded-sm px-3 text-xs font-semibold uppercase tracking-[0.16em] transition-colors duration-200 ${
                      active
                        ? 'text-primary'
                        : 'text-muted hover:text-body focus-visible:text-body'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <ButtonLink
            href={site.inviteUrl}
            variant="cta"
            size="sm"
            icon="discord"
            className="hidden sm:inline-flex"
          >
            Join
          </ButtonLink>

          {/* Mobile toggle */}
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-sm border border-edge/70 text-muted transition-colors duration-200 hover:border-primary/60 hover:text-primary lg:hidden"
          >
            <Icon name={open ? 'close' : 'menu'} className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      <div
        id="mobile-nav"
        hidden={!open}
        className="mx-auto mt-2 max-w-shell overflow-hidden rounded-sm border border-edge/70 bg-ink/95 backdrop-blur-md lg:hidden"
      >
        <nav aria-label="Main, mobile">
          <ul className="divide-y divide-edge/40">
            {items.map((item) => {
              const active =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-h-12 cursor-pointer items-center px-4 text-sm font-semibold uppercase tracking-[0.16em] transition-colors duration-200 ${
                      active ? 'text-primary' : 'text-muted hover:text-body'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
            <li className="p-3 sm:hidden">
              <ButtonLink
                href={site.inviteUrl}
                variant="cta"
                size="md"
                icon="discord"
                className="w-full"
              >
                Join the server
              </ButtonLink>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
