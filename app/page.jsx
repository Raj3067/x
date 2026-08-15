import { site, about, features, giveaways } from '@/content/site.config';
import Section from '@/components/Section';
import Reveal from '@/components/Reveal';
import Parallax from '@/components/Parallax';
import Wordmark from '@/components/Wordmark';
import Icon from '@/components/Icon';
import LiveStatus from '@/components/LiveStatus';
import StaffGrid from '@/components/StaffGrid';
import GiveawayCard from '@/components/GiveawayCard';
import { ButtonLink } from '@/components/Button';
import { splitActive } from '@/lib/giveaways';

// Countdowns are rendered into the HTML, so this page has to regenerate for the
// same reason /giveaways does. Countdown still self-corrects on mount.
export const revalidate = 300;

export default function HomePage() {
  return (
    <>
      <Hero />
      <GiveawaySpotlight />
      <About />
      <Features />
      <Community />
      <JoinCta />
    </>
  );
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pb-20 pt-10 sm:px-6 sm:pb-28 sm:pt-16 lg:px-8">
      {/* The 3D background lives in the root layout now, behind every page. All
          that is left here is a local colour wash to lift the headline off it. */}
      <Parallax speed={-0.06} className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(124,58,237,0.18),transparent_60%),radial-gradient(ellipse_at_20%_80%,rgba(34,211,238,0.10),transparent_55%)]" />
      </Parallax>

      <div className="relative mx-auto max-w-shell">
        <Reveal className="flex flex-col items-start gap-7">
          <LiveStatus />

          <h1>
            <span className="sr-only">{site.serverName}</span>
            <Wordmark lines={site.wordmark} size="xl" />
          </h1>

          <p className="max-w-xl text-lg leading-relaxed text-body/90 sm:text-xl">
            {site.tagline}
          </p>

          <p className="max-w-prose text-base leading-relaxed text-muted">
            {site.description}
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <ButtonLink href={site.inviteUrl} variant="cta" size="lg" icon="discord">
              Join the server
            </ButtonLink>
            {/* Giveaways are the draw, so they get the second slot. The rules
                link moves into the footer nav rather than disappearing. */}
            {site.showGiveaways ? (
              <ButtonLink href="/giveaways" variant="outline" size="lg" icon="gift">
                See the giveaways
              </ButtonLink>
            ) : (
              <ButtonLink href="/rules" variant="outline" size="lg">
                Read the rules
              </ButtonLink>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Giveaway spotlight
//
// Shows at most three open drops, then upcoming ones as filler if fewer than
// three are open. The whole section removes itself when there is nothing to
// show and nothing announced — an empty "giveaways" heading on the homepage
// would undercut the headline claim rather than support it.
// ---------------------------------------------------------------------------

function GiveawaySpotlight() {
  if (!site.showGiveaways) return null;

  const { open } = splitActive(giveaways.active);
  const upcoming = giveaways.upcoming ?? [];

  // Fill remaining slots with announced drops so a quiet week still shows
  // something concrete.
  const shown = [
    ...open.slice(0, 3).map((giveaway) => ({ giveaway, state: 'open' })),
    ...upcoming
      .slice(0, Math.max(0, 3 - open.length))
      .map((giveaway) => ({ giveaway, state: 'upcoming' })),
  ];

  if (shown.length === 0) return null;

  return (
    <Section
      id="giveaways"
      eyebrow={open.length > 0 ? 'Open now' : 'Announced'}
      title={open.length > 0 ? 'Current giveaways' : 'Coming up'}
      lead={giveaways.intro}
      className="border-t border-edge/40"
    >
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map(({ giveaway, state }, index) => (
          <GiveawayCard
            key={`${giveaway.title}-${index}`}
            giveaway={giveaway}
            state={state}
            index={index}
            inviteUrl={site.inviteUrl}
          />
        ))}
      </ul>

      <Reveal className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
        <ButtonLink href="/giveaways" variant="primary" icon="gift">
          All giveaways
        </ButtonLink>
        {site.showWinners ? (
          <ButtonLink href="/winners" variant="ghost">
            Past winners
          </ButtonLink>
        ) : null}
      </Reveal>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// About
// ---------------------------------------------------------------------------

function About() {
  return (
    <Section id="about" eyebrow="Who we are" title={about.heading}>
      <Reveal className="mt-8 grid gap-6 lg:grid-cols-2">
        {about.paragraphs.map((paragraph, index) => (
          <p
            key={index}
            className="max-w-prose text-base leading-relaxed text-muted"
          >
            {paragraph}
          </p>
        ))}
      </Reveal>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Features
// ---------------------------------------------------------------------------

function Features() {
  return (
    <Section
      id="features"
      eyebrow="What's inside"
      title="The short version"
      lead="Everything below already exists in the server — none of it is aspirational."
    >
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, index) => (
          <Reveal
            as="li"
            key={feature.title}
            delay={index * 60}
            className="group rounded-sm border border-edge/60 bg-surface/50 p-6 transition-colors duration-200 hover:border-primary/50"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-sm border border-edge/60 bg-ink/60 text-primary transition-colors duration-200 group-hover:border-primary/50">
              <Icon name={feature.icon} className="h-5 w-5" />
            </span>

            <h3 className="mt-5 text-lg uppercase tracking-wide text-body">
              {feature.title}
            </h3>

            <p className="mt-2 text-sm leading-relaxed text-muted">{feature.body}</p>
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Community — the "active members" showcase.
//
// The widget is off, so there are no live member avatars to show. The staff
// grid stands in: real faces, and it points somewhere useful.
// ---------------------------------------------------------------------------

function Community() {
  return (
    <Section
      id="community"
      eyebrow="The people"
      title="Who keeps it running"
      lead="Staff are active, reachable, and enforce the rules evenly. Open a ticket and someone will actually answer."
    >
      <div className="mt-10">
        <StaffGrid limit={4} />
      </div>

      <Reveal className="mt-8">
        <ButtonLink href="/staff" variant="ghost" size="sm" icon="arrowRight">
          Meet the full team
        </ButtonLink>
      </Reveal>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Join CTA
// ---------------------------------------------------------------------------

function JoinCta() {
  return (
    <Section className="pb-8">
      <Reveal className="relative overflow-hidden rounded-sm border border-edge/60 bg-surface/60 px-6 py-14 text-center sm:px-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(244,63,94,0.12),transparent_65%)]"
        />

        <div className="relative">
          <h2 className="text-3xl uppercase sm:text-4xl">
            <span className="glow-cta">Come find your squad</span>
          </h2>

          <p className="mx-auto mt-4 max-w-prose text-base leading-relaxed text-muted">
            Free, instant, and you can lurk as long as you like before saying
            anything. Entry to every giveaway comes with it.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href={site.inviteUrl} variant="cta" size="lg" icon="discord">
              Join the server
            </ButtonLink>
            <ButtonLink href="/apply" variant="outline" size="lg">
              Apply for staff
            </ButtonLink>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
