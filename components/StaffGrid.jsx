import { staff } from '@/content/site.config';
import Reveal from './Reveal';

// ---------------------------------------------------------------------------
// StaffGrid — used on the homepage (limited to 4) and on /staff (all of them).
//
// Avatars: `discordId` is optional in the config. When present the card pulls
// that member's real avatar from Discord's CDN; otherwise it renders an
// initials tile. Either way the layout is identical, so filling in IDs later
// never shifts anything.
// ---------------------------------------------------------------------------

const accents = {
  primary: {
    border: 'hover:border-primary/50',
    ring: 'border-primary/40',
    text: 'text-primary',
  },
  secondary: {
    border: 'hover:border-secondary/50',
    ring: 'border-secondary/40',
    text: 'text-secondary',
  },
  cta: {
    border: 'hover:border-cta/50',
    ring: 'border-cta/40',
    text: 'text-cta',
  },
};

function initials(name) {
  // Strip the TODO prefix so placeholders don't all read "TO".
  const cleaned = name.replace(/^TODO\s*[—-]?\s*/i, '').trim() || name;
  return cleaned
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

export default function StaffGrid({ limit }) {
  const members = limit ? staff.slice(0, limit) : staff;

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {members.map((member, index) => {
        const accent = accents[member.accent] ?? accents.primary;

        return (
          <Reveal
            as="li"
            key={`${member.name}-${index}`}
            delay={index * 60}
            className={`rounded-sm border border-edge/60 bg-surface/50 p-6 transition-colors duration-200 ${accent.border}`}
          >
            {member.discordId && member.avatarHash ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`https://cdn.discordapp.com/avatars/${member.discordId}/${member.avatarHash}.png?size=128`}
                alt={`${member.name}'s avatar`}
                width={56}
                height={56}
                loading="lazy"
                className={`h-14 w-14 rounded-sm border object-cover ${accent.ring}`}
              />
            ) : (
              <span
                aria-hidden="true"
                className={`inline-flex h-14 w-14 items-center justify-center rounded-sm border bg-ink/60 font-display text-lg ${accent.ring} ${accent.text}`}
              >
                {initials(member.name)}
              </span>
            )}

            <h3 className="mt-5 text-base uppercase tracking-wide text-body">
              {member.name}
            </h3>

            <p
              className={`mt-1 text-xs font-semibold uppercase tracking-[0.18em] ${accent.text}`}
            >
              {member.role}
            </p>

            <p className="mt-3 text-sm leading-relaxed text-muted">{member.bio}</p>
          </Reveal>
        );
      })}
    </ul>
  );
}
