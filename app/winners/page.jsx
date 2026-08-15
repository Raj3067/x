import { site, winners } from '@/content/site.config';
import { notFound } from 'next/navigation';
import Section, { PageHeader } from '@/components/Section';
import Reveal from '@/components/Reveal';
import Icon from '@/components/Icon';
import { ButtonLink } from '@/components/Button';
import { formatDate } from '@/lib/giveaways';

export const metadata = {
  title: 'Winners',
  description: `Past giveaway winners from the ${site.serverName} Discord server.`,
};

export default function WinnersPage() {
  if (!site.showWinners) notFound();

  return (
    <>
      <PageHeader
        eyebrow="Receipts"
        title="Winners"
        lead="Every drop we have run and who took it. Posted here so you can check the giveaways are real before you bother entering."
      />

      <Section>
        {winners.length > 0 ? (
          <WinnerList />
        ) : (
          <Reveal className="flex flex-col items-start gap-5 rounded-sm border border-edge/60 bg-surface/40 p-8">
            <Icon name="trophy" className="h-8 w-8 text-primary" />
            <div>
              <p className="text-lg uppercase tracking-wide text-body">
                No winners drawn yet
              </p>
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
                This fills in as giveaways close. Nothing is hidden — if the list
                is empty, the first draw has not happened.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {site.showGiveaways ? (
                <ButtonLink href="/giveaways" variant="primary">
                  See what is open
                </ButtonLink>
              ) : null}
              <ButtonLink href={site.inviteUrl} variant="outline" icon="discord">
                Join the server
              </ButtonLink>
            </div>
          </Reveal>
        )}
      </Section>
    </>
  );
}

/**
 * Winner list. A real <table> rather than divs: this is tabular data, and the
 * markup is what lets a screen reader announce "prize, column 2" instead of
 * reading three unrelated strings in a row.
 *
 * Order comes from the config array as-is, newest first — no sorting here, so
 * what you see in the file is what you see on the page.
 */
function WinnerList() {
  return (
    <Reveal className="overflow-hidden rounded-sm border border-edge/60 bg-surface/40">
      {/* Horizontal scroll is on the wrapper, not the page, so a narrow phone
          never gets a body-level sideways scroll. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-left">
          <caption className="sr-only">
            Past giveaway winners, most recent first.
          </caption>

          <thead>
            <tr className="border-b border-edge/60">
              <th
                scope="col"
                className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted"
              >
                Winner
              </th>
              <th
                scope="col"
                className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted"
              >
                Prize
              </th>
              <th
                scope="col"
                className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-[0.18em] text-muted"
              >
                Date
              </th>
            </tr>
          </thead>

          <tbody>
            {winners.map((winner, index) => (
              <tr
                key={`${winner.name}-${index}`}
                className="border-b border-edge/30 last:border-b-0"
              >
                <th scope="row" className="px-5 py-4 font-normal">
                  <span className="flex items-center gap-3">
                    {winner.discordId && winner.avatarHash ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`https://cdn.discordapp.com/avatars/${winner.discordId}/${winner.avatarHash}.png?size=64`}
                        alt=""
                        width={32}
                        height={32}
                        loading="lazy"
                        className="h-8 w-8 rounded-sm border border-edge/60 object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-primary/40 bg-ink/60 text-primary"
                      >
                        <Icon name="trophy" className="h-4 w-4" />
                      </span>
                    )}
                    <span className="text-body">{winner.name}</span>
                  </span>
                </th>

                <td className="px-5 py-4 text-sm text-muted">{winner.prize}</td>

                <td className="whitespace-nowrap px-5 py-4 text-right text-sm text-muted">
                  {winner.date ? (
                    <time dateTime={winner.date}>{formatDate(winner.date)}</time>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Reveal>
  );
}
