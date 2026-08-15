import fs from 'node:fs/promises';
import path from 'node:path';
import { site } from '@/content/site.config';
import Section, { PageHeader } from '@/components/Section';
import Reveal from '@/components/Reveal';
import Icon from '@/components/Icon';
import { ButtonLink } from '@/components/Button';

export const metadata = {
  title: 'Leaderboard',
  description: `Top members in the ${site.serverName} Discord server.`,
};

// Re-read on an interval so a live source stays reasonably fresh, and so
// editing the JSON file shows up without a rebuild.
export const revalidate = 300;

// ---------------------------------------------------------------------------
// Data loading.
//
// Two sources, in priority order:
//   1. LEADERBOARD_API_URL — set this once your bot exposes an endpoint
//   2. data/leaderboard.json — the fallback, edited by hand
//
// Both are read server-side, so an API token never reaches the browser. The
// shapes are identical, which is why switching later is one env var and no
// code change.
// ---------------------------------------------------------------------------

async function loadLeaderboard() {
  const apiUrl = process.env.LEADERBOARD_API_URL;

  if (apiUrl) {
    try {
      const headers = { Accept: 'application/json' };
      if (process.env.LEADERBOARD_API_TOKEN) {
        headers.Authorization = `Bearer ${process.env.LEADERBOARD_API_TOKEN}`;
      }

      const response = await fetch(apiUrl, { headers, next: { revalidate: 300 } });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          return { entries: normalise(data), source: 'api' };
        }
      }

      console.error('[leaderboard] API returned no usable data, using local file');
    } catch (error) {
      // Never let a flaky bot endpoint take the page down — fall through.
      console.error('[leaderboard] API unreachable, using local file', error);
    }
  }

  try {
    const filePath = path.join(process.cwd(), 'data', 'leaderboard.json');
    const raw = await fs.readFile(filePath, 'utf8');
    return { entries: normalise(JSON.parse(raw)), source: 'file' };
  } catch (error) {
    console.error('[leaderboard] could not read data/leaderboard.json', error);
    return { entries: [], source: 'none' };
  }
}

// Tolerate missing fields and re-derive rank from position, so a hand-edited
// file with the ranks left wrong still renders sensibly.
function normalise(data) {
  return data
    .slice()
    .sort((a, b) => (b.xp ?? 0) - (a.xp ?? 0))
    .map((entry, index) => ({
      rank: index + 1,
      name: entry.name ?? 'Unknown',
      level: entry.level ?? null,
      xp: entry.xp ?? null,
      avatar: entry.avatar ?? null,
    }));
}

export default async function LeaderboardPage() {
  const { entries, source } = await loadLeaderboard();
  const maxXp = entries[0]?.xp ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Top members"
        title="Leaderboard"
        lead="Earned by turning up — chatting, joining voice, taking part. No shortcuts. Higher levels unlock better giveaway tiers."
      />

      <Section>
        {entries.length === 0 ? (
          <Reveal className="rounded-sm border border-edge/60 bg-surface/50 p-8 text-center">
            <p className="text-sm text-muted">
              No leaderboard data yet. Check{' '}
              <code className="rounded-sm bg-ink/70 px-1.5 py-0.5 text-xs text-primary">
                data/leaderboard.json
              </code>
              .
            </p>
          </Reveal>
        ) : (
          <>
            <LeaderboardTable entries={entries} maxXp={maxXp} />

            {source === 'file' ? <SetupNote /> : null}
          </>
        )}
      </Section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Table.
//
// A real <table> rather than a grid of divs: this is tabular data, so semantic
// markup gives screen readers row/column context for free.
//
// The XP bar is decorative — the number next to it carries the same
// information, so colour and length are never the only signal.
// ---------------------------------------------------------------------------

function LeaderboardTable({ entries, maxXp }) {
  return (
    <Reveal className="overflow-hidden rounded-sm border border-edge/60 bg-surface/50">
      {/* Horizontal scroll is contained here so the page body never scrolls
          sideways on a narrow screen. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-left">
          <caption className="sr-only">
            Top members by XP, highest first.
          </caption>

          <thead>
            <tr className="border-b border-edge/60">
              <th
                scope="col"
                className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-muted sm:px-6"
              >
                Rank
              </th>
              <th
                scope="col"
                className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-muted sm:px-6"
              >
                Member
              </th>
              <th
                scope="col"
                className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-muted sm:px-6"
              >
                Level
              </th>
              <th
                scope="col"
                className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-muted sm:px-6"
              >
                XP
              </th>
            </tr>
          </thead>

          <tbody>
            {entries.map((entry) => {
              // Top three get a tint; everyone else stays neutral.
              const medal =
                entry.rank === 1
                  ? 'text-cta'
                  : entry.rank === 2
                    ? 'text-primary'
                    : entry.rank === 3
                      ? 'text-secondary'
                      : 'text-muted';

              const share = maxXp > 0 ? Math.max((entry.xp ?? 0) / maxXp, 0.04) : 0;

              return (
                <tr
                  key={`${entry.rank}-${entry.name}`}
                  className="border-b border-edge/30 transition-colors duration-200 last:border-0 hover:bg-ink/40"
                >
                  <td className="px-4 py-4 sm:px-6">
                    <span
                      className={`font-display text-lg leading-none ${medal}`}
                    >
                      {String(entry.rank).padStart(2, '0')}
                    </span>
                  </td>

                  <td className="px-4 py-4 sm:px-6">
                    <div className="flex items-center gap-3">
                      {entry.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={entry.avatar}
                          alt=""
                          width={32}
                          height={32}
                          loading="lazy"
                          className="h-8 w-8 shrink-0 rounded-sm border border-edge/60 object-cover"
                        />
                      ) : (
                        <span
                          aria-hidden="true"
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-edge/60 bg-ink/60 text-[0.7rem] text-muted"
                        >
                          {entry.name.replace(/^TODO\s*[—-]?\s*/i, '')[0]?.toUpperCase() ?? '?'}
                        </span>
                      )}
                      <span className="text-sm text-body">{entry.name}</span>
                    </div>
                  </td>

                  <td className="px-4 py-4 text-sm text-muted sm:px-6">
                    {entry.level ?? '—'}
                  </td>

                  <td className="px-4 py-4 sm:px-6">
                    <div className="flex items-center gap-3">
                      <span className="w-20 shrink-0 text-sm tabular-nums text-body">
                        {entry.xp !== null ? entry.xp.toLocaleString() : '—'}
                      </span>
                      {/* Decorative bar. The number above is the accessible value. */}
                      <span
                        aria-hidden="true"
                        className="hidden h-1 w-24 overflow-hidden rounded-full bg-edge/40 sm:block"
                      >
                        <span
                          className="block h-full rounded-full bg-gradient-to-r from-secondary to-primary"
                          style={{ width: `${(share * 100).toFixed(1)}%` }}
                        />
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Reveal>
  );
}

// ---------------------------------------------------------------------------
// Setup note — only rendered while reading from the local JSON file.
// It disappears on its own once LEADERBOARD_API_URL is set.
// ---------------------------------------------------------------------------

function SetupNote() {
  return (
    <Reveal className="mt-10 flex gap-4 rounded-sm border border-dashed border-edge/70 bg-surface/40 p-6">
      <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <div className="text-sm leading-relaxed text-muted">
        <p className="font-semibold text-body">Where this data comes from</p>
        <p className="mt-2 max-w-prose">
          Currently reading{' '}
          <code className="rounded-sm bg-ink/70 px-1.5 py-0.5 text-xs text-primary">
            data/leaderboard.json
          </code>
          . Edit that file to update the board. Discord has no XP API of its own,
          so this has to come from your bot.
        </p>
        <p className="mt-3 max-w-prose">
          Once your bot serves a leaderboard endpoint, set{' '}
          <code className="rounded-sm bg-ink/70 px-1.5 py-0.5 text-xs text-primary">
            LEADERBOARD_API_URL
          </code>{' '}
          in{' '}
          <code className="rounded-sm bg-ink/70 px-1.5 py-0.5 text-xs text-primary">
            .env.local
          </code>{' '}
          and this page switches to it automatically — returning{' '}
          <code className="rounded-sm bg-ink/70 px-1.5 py-0.5 text-xs text-primary">
            [{'{'} rank, name, level, xp, avatar {'}'}]
          </code>
          . This note disappears when it does.
        </p>
        <div className="mt-5">
          <ButtonLink href={site.inviteUrl} variant="ghost" size="sm" icon="discord">
            Join and start climbing
          </ButtonLink>
        </div>
      </div>
    </Reveal>
  );
}
