import { site, giveaways } from '@/content/site.config';
import { notFound } from 'next/navigation';
import Section, { PageHeader } from '@/components/Section';
import Reveal from '@/components/Reveal';
import Icon from '@/components/Icon';
import GiveawayCard from '@/components/GiveawayCard';
import { ButtonLink } from '@/components/Button';
import { splitActive } from '@/lib/giveaways';

export const metadata = {
  title: 'Giveaways',
  description: `Live and upcoming giveaways in the ${site.serverName} Discord server.`,
};

// Countdown labels are baked into the HTML at build time, so the page needs to
// regenerate periodically or a cached copy would keep claiming a closed drop is
// open. Countdown also self-corrects on mount, making this belt and braces.
export const revalidate = 300;

export default function GiveawaysPage() {
  // The nav link is hidden by the flag, but the route would still resolve if
  // someone typed the URL. 404 keeps the flag honest.
  if (!site.showGiveaways) notFound();

  const { open, closed } = splitActive(giveaways.active);
  const upcoming = giveaways.upcoming ?? [];
  const nothingLive = open.length === 0 && upcoming.length === 0;

  return (
    <>
      <PageHeader
        eyebrow="Prizes"
        title="Giveaways"
        lead={giveaways.intro}
      />

      <Section
        eyebrow={open.length > 0 ? 'Open now' : undefined}
        title={open.length > 0 ? 'Enter these' : undefined}
      >
        {open.length > 0 ? (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {open.map((giveaway, index) => (
              <GiveawayCard
                key={`${giveaway.title}-${index}`}
                giveaway={giveaway}
                state="open"
                index={index}
                inviteUrl={site.inviteUrl}
              />
            ))}
          </ul>
        ) : (
          // Honest empty state. Saying "nothing right now" builds more trust
          // than an empty grid or a fake placeholder prize would.
          <Reveal className="mt-2 flex flex-col items-start gap-5 rounded-sm border border-edge/60 bg-surface/40 p-8">
            <Icon name="gift" className="h-8 w-8 text-primary" />
            <div>
              <p className="text-lg uppercase tracking-wide text-body">
                Nothing open right now
              </p>
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
                Drops go up in {giveaways.channel} and are announced before they
                start. Join the server and you will see the next one.
              </p>
            </div>
            <ButtonLink href={site.inviteUrl} variant="cta" icon="discord">
              Join the server
            </ButtonLink>
          </Reveal>
        )}
      </Section>

      {upcoming.length > 0 ? (
        <Section
          eyebrow="Announced"
          title="Coming up"
          lead="Not open yet. Times are approximate until the post goes live."
          className="border-t border-edge/40"
        >
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((giveaway, index) => (
              <GiveawayCard
                key={`${giveaway.title}-${index}`}
                giveaway={giveaway}
                state="upcoming"
                index={index}
                inviteUrl={site.inviteUrl}
              />
            ))}
          </ul>
        </Section>
      ) : null}

      {closed.length > 0 ? (
        <Section
          eyebrow="Finished"
          title="Recently closed"
          lead="Left up as a record. Winners are on the winners page."
          className="border-t border-edge/40"
        >
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {closed.map((giveaway, index) => (
              <GiveawayCard
                key={`${giveaway.title}-${index}`}
                giveaway={giveaway}
                state="closed"
                index={index}
                inviteUrl={site.inviteUrl}
              />
            ))}
          </ul>
        </Section>
      ) : null}

      <Section
        eyebrow="The fine print"
        title="Entry rules"
        lead="Short, and enforced. Most of it exists so one person cannot farm the draw."
        className="border-t border-edge/40"
      >
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {giveaways.terms.map((term, index) => (
            <Reveal
              as="li"
              key={term}
              delay={index * 40}
              className="flex gap-3 rounded-sm border border-edge/50 bg-surface/40 p-4 text-sm leading-relaxed text-muted"
            >
              <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{term}</span>
            </Reveal>
          ))}
        </ul>

        {nothingLive ? null : (
          <Reveal className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <ButtonLink href={site.inviteUrl} variant="cta" size="lg" icon="discord">
              Join and enter
            </ButtonLink>
            {site.showWinners ? (
              <ButtonLink href="/winners" variant="outline" size="lg">
                See past winners
              </ButtonLink>
            ) : null}
          </Reveal>
        )}
      </Section>
    </>
  );
}
