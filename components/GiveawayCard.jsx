import Icon from './Icon';
import Reveal from './Reveal';
import Countdown from './Countdown';
import { ButtonLink } from './Button';
import { giveaways } from '@/content/site.config';
import {
  endsAtTime,
  formatDateTime,
  formatRemaining,
} from '@/lib/giveaways';

// ---------------------------------------------------------------------------
// GiveawayCard — one drop, in three states.
//
//   open     open now, with a live countdown and an entry link
//   upcoming announced but not started; no countdown, loose `when` text
//   closed   finished; kept visible as a record rather than deleted
//
// A Server Component. Only the countdown label is client-side, which is why
// the "left" string is computed here and passed down as `initial` — the card
// itself never needs to hydrate.
// ---------------------------------------------------------------------------

const accents = {
  primary: {
    border: 'hover:border-primary/50',
    chip: 'border-primary/40 text-primary',
    icon: 'text-primary',
  },
  secondary: {
    border: 'hover:border-secondary/50',
    chip: 'border-secondary/40 text-secondary',
    icon: 'text-secondary',
  },
  cta: {
    border: 'hover:border-cta/50',
    chip: 'border-cta/40 text-cta',
    icon: 'text-cta',
  },
};

/** Where "enter" should point: the channel link if set, else the invite. */
function entryHref() {
  return giveaways.channelUrl || null;
}

export default function GiveawayCard({
  giveaway,
  state = 'open',
  index = 0,
  inviteUrl,
}) {
  const accent = accents[giveaway.accent] ?? accents.primary;
  const ends = endsAtTime(giveaway);
  const closesAt = formatDateTime(giveaway.endsAt);
  const remaining =
    state === 'open' && ends !== null ? formatRemaining(ends - Date.now()) : null;

  const href = entryHref() || inviteUrl;

  return (
    <Reveal
      as="li"
      delay={index * 60}
      className={`flex flex-col rounded-sm border border-edge/60 bg-surface/50 p-6 transition-colors duration-200 ${accent.border}`}
    >
      <div className="flex items-start justify-between gap-4">
        <Icon
          name={state === 'closed' ? 'check' : 'gift'}
          className={`h-7 w-7 shrink-0 ${accent.icon}`}
        />

        <div className="flex flex-wrap justify-end gap-2">
          {giveaway.tier ? (
            <span className="rounded-sm border border-edge/70 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted">
              {giveaway.tier}
            </span>
          ) : null}

          {state === 'open' ? (
            <span
              className={`rounded-sm border px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] ${accent.chip}`}
            >
              Open
            </span>
          ) : null}

          {state === 'upcoming' ? (
            <span className="rounded-sm border border-edge/70 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted">
              Soon
            </span>
          ) : null}

          {state === 'closed' ? (
            <span className="rounded-sm border border-edge/70 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted">
              Ended
            </span>
          ) : null}
        </div>
      </div>

      <h3 className="mt-5 text-lg uppercase tracking-wide text-body">
        {giveaway.title}
      </h3>

      <p className="mt-2 text-sm leading-relaxed text-muted">{giveaway.prize}</p>

      <dl className="mt-5 space-y-2 text-sm">
        {giveaway.value ? (
          <div className="flex gap-2">
            <dt className="text-muted">Value</dt>
            <dd className="text-body">{giveaway.value}</dd>
          </div>
        ) : null}

        {giveaway.winners > 1 ? (
          <div className="flex gap-2">
            <dt className="text-muted">Winners</dt>
            <dd className="text-body">{giveaway.winners}</dd>
          </div>
        ) : null}

        {state === 'upcoming' && giveaway.when ? (
          <div className="flex gap-2">
            <dt className="text-muted">Starts</dt>
            <dd className="text-body">{giveaway.when}</dd>
          </div>
        ) : null}

        {closesAt ? (
          <div className="flex gap-2">
            <dt className="text-muted">{state === 'closed' ? 'Ended' : 'Closes'}</dt>
            {/* time carries the machine-readable value; the visible text is the
                UTC-formatted string so server and client always agree. */}
            <dd className="text-body">
              <time dateTime={giveaway.endsAt}>{closesAt}</time>
            </dd>
          </div>
        ) : null}
      </dl>

      {giveaway.entry && state !== 'closed' ? (
        <p className="mt-4 flex gap-2 text-sm leading-relaxed text-muted">
          <Icon name="ticket" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>{giveaway.entry}</span>
        </p>
      ) : null}

      {/* Pushes the footer to the bottom so cards of different heights still
          line their buttons up. */}
      <div className="mt-auto pt-6">
        {state === 'open' ? (
          <div className="flex flex-col gap-3">
            {remaining ? (
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                <Icon name="clock" className="h-4 w-4" />
                <Countdown endsAt={giveaway.endsAt} initial={remaining} />
              </p>
            ) : null}

            {href ? (
              <ButtonLink href={href} variant="cta" size="sm" icon="discord">
                Enter in Discord
              </ButtonLink>
            ) : null}
          </div>
        ) : null}

        {state === 'upcoming' && href ? (
          <ButtonLink href={href} variant="outline" size="sm">
            Get notified
          </ButtonLink>
        ) : null}
      </div>
    </Reveal>
  );
}
