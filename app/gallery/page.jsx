import { site } from '@/content/site.config';
import Section, { PageHeader } from '@/components/Section';
import Reveal from '@/components/Reveal';
import GalleryGrid from '@/components/GalleryGrid';
import Icon from '@/components/Icon';

export const metadata = {
  title: 'Gallery',
  description: `Screenshots and art from the ${site.serverName} community.`,
};

export default function GalleryPage() {
  return (
    <>
      <PageHeader
        eyebrow="Highlights"
        title="Gallery"
        lead="Clips, screenshots, and whatever else the community has posted worth keeping."
      />

      <Section>
        <div className="mt-2">
          <GalleryGrid />
        </div>

        {/* Setup note for you — delete this block once real images are in.
            It renders on the live site, so remove it before sharing the link
            widely. */}
        <Reveal className="mt-12 flex gap-4 rounded-sm border border-dashed border-edge/70 bg-surface/40 p-6">
          <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="text-sm leading-relaxed text-muted">
            <p className="font-semibold text-body">Adding your own images</p>
            <p className="mt-2 max-w-prose">
              Drop files into{' '}
              <code className="rounded-sm bg-ink/70 px-1.5 py-0.5 text-xs text-primary">
                public/gallery/
              </code>{' '}
              then edit the{' '}
              <code className="rounded-sm bg-ink/70 px-1.5 py-0.5 text-xs text-primary">
                gallery
              </code>{' '}
              array in{' '}
              <code className="rounded-sm bg-ink/70 px-1.5 py-0.5 text-xs text-primary">
                content/site.config.js
              </code>
              , setting each{' '}
              <code className="rounded-sm bg-ink/70 px-1.5 py-0.5 text-xs text-primary">
                src
              </code>{' '}
              to{' '}
              <code className="rounded-sm bg-ink/70 px-1.5 py-0.5 text-xs text-primary">
                &apos;/gallery/filename.webp&apos;
              </code>
              . Write a real{' '}
              <code className="rounded-sm bg-ink/70 px-1.5 py-0.5 text-xs text-primary">
                alt
              </code>{' '}
              description for each one — it doubles as the lightbox caption and
              is what screen readers announce. Then delete this note from{' '}
              <code className="rounded-sm bg-ink/70 px-1.5 py-0.5 text-xs text-primary">
                app/gallery/page.jsx
              </code>
              .
            </p>
          </div>
        </Reveal>
      </Section>
    </>
  );
}
