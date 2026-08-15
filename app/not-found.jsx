import Link from 'next/link';
import { site } from '@/content/site.config';
import { ButtonLink } from '@/components/Button';
import Wordmark from '@/components/Wordmark';

export const metadata = {
  title: 'Page not found',
};

export default function NotFound() {
  return (
    <section className="px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-shell text-center">
        <p className="font-display text-6xl text-primary/40 sm:text-8xl">404</p>

        <h1 className="mt-6 text-3xl uppercase sm:text-4xl">
          <span className="glow-primary">Nothing here</span>
        </h1>

        <p className="mx-auto mt-4 max-w-prose text-base leading-relaxed text-muted">
          That page does not exist, or it moved. The server is still very much
          around, though.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <ButtonLink href="/" variant="primary" size="md">
            Back to the homepage
          </ButtonLink>
          <ButtonLink href={site.inviteUrl} variant="outline" size="md" icon="discord">
            Join the server
          </ButtonLink>
        </div>

        <div className="mt-16 flex justify-center opacity-40">
          <Link href="/" aria-label={`${site.serverName} — home`}>
            <Wordmark lines={site.wordmark} size="md" />
          </Link>
        </div>
      </div>
    </section>
  );
}
