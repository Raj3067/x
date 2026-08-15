// ---------------------------------------------------------------------------
// LegendaryBeasts — all site text lives here.
//
// Edit anything in this file and it updates everywhere. You should never need
// to touch a component to change wording, add a staff member, or swap a link.
//
// Anything marked TODO is a placeholder waiting on you.
// ---------------------------------------------------------------------------

export const site = {
  // --- Identity -----------------------------------------------------------
  serverName: 'Legendary Beasts',

  // Split across two lines in the wordmark. Keep it to two words.
  wordmark: ['LEGENDARY', 'BEASTS'],

  tagline: 'Games, giveaways, and a server that actually shows up.',

  // One or two sentences. Shows under the tagline in the hero and in search
  // engine results / Discord link previews.
  description:
    'A gaming community that runs real giveaways — games, gift cards, and Nitro — for the people who actually turn up. Squad up, climb the ranks, and enter the drops.',

  // --- Links --------------------------------------------------------------
  // Permanent invite — set to never expire, unlimited uses.
  inviteUrl: 'https://discord.gg/Hr3pq4gpKa',

  // Add or remove freely; the footer adapts. Set to [] to hide socials.
  socials: [
    // { label: 'YouTube', url: 'https://youtube.com/@TODO' },
    // { label: 'Twitch', url: 'https://twitch.tv/TODO' },
    // { label: 'X', url: 'https://x.com/TODO' },
  ],

  // --- Feature flags ------------------------------------------------------
  // Flip to true when you're happy with the member count and the real numbers
  // will appear in the hero. Until then the hero shows a pulsing LIVE dot.
  // The /api/discord route works either way.
  showMemberCounts: false,

  // Set false to hide the whole leaderboard route and its nav link.
  showLeaderboard: true,

  // Set false to hide the whole gallery route and its nav link.
  showGallery: true,

  // Set false to hide /giveaways and its nav link.
  showGiveaways: true,

  // Set false to hide /winners and its nav link. Worth leaving on — a public
  // winners list is the cheapest proof that the giveaways are real.
  showWinners: true,
};

// ---------------------------------------------------------------------------
// About — the "who we are" block on the homepage.
// ---------------------------------------------------------------------------

export const about = {
  heading: 'Real prizes, real people',
  // Each string is its own paragraph.
  paragraphs: [
    'Legendary Beasts started small and stayed picky. We would rather have a room full of people who actually talk than a member count that looks good on a listing site.',
    'The giveaways are part of that, not a bait tactic. Games, gift cards, and Nitro go out on a regular schedule, funded by staff and the occasional sponsor, and every winner is posted publicly so you can see the drops are real.',
    'No forced activity quotas, no gatekeeping, no drama. Show up, find a squad, enter the drops, and play.',
  ],
};

// ---------------------------------------------------------------------------
// Features — the card grid on the homepage.
//
// `icon` picks which SVG renders. Available: swords, users, trophy, calendar,
// shield, sparkles, gift, ticket, clock. Any other value falls back to a
// generic mark.
// ---------------------------------------------------------------------------

export const features = [
  {
    icon: 'gift',
    title: 'Regular giveaways',
    body: 'Games, gift cards, and Nitro on a set schedule. Announced in advance, drawn in public.',
  },
  {
    icon: 'ticket',
    title: 'Simple entry',
    body: 'React to the giveaway post. No follow-for-follow chains, no invite quotas, no hoops.',
  },
  {
    icon: 'users',
    title: 'Active voice chat',
    body: 'VC is open around the clock. Drop in mid-conversation, nobody minds.',
  },
  {
    icon: 'swords',
    title: 'Squad finder',
    body: 'Looking-for-group channels split by game so you are not shouting into a void.',
  },
  {
    icon: 'trophy',
    title: 'Ranks and progression',
    body: 'Talk, play, take part. Levels and roles come with the territory — and unlock better giveaway tiers.',
  },
  {
    icon: 'shield',
    title: 'Moderated properly',
    body: 'Staff are present and rules are enforced evenly. Alt accounts and entry farming get removed.',
  },
];

// ---------------------------------------------------------------------------
// Giveaways — powers /giveaways and the homepage giveaway block.
//
// `endsAt` must be an ISO 8601 string with a timezone offset (the trailing Z
// means UTC). It is parsed on the client for the countdown, so a bare
// '2026-09-01 20:00' would be read differently per browser — always include
// the offset.
//
// Status is derived, never stored: anything with an `endsAt` in the past counts
// as finished and drops off the active list on its own. That means a giveaway
// you forget to remove expires gracefully instead of sitting there looking live.
//
// `tier` gates entry by level. Use null for "open to everyone".
// `entry` is one short line describing how to enter.
// ---------------------------------------------------------------------------

export const giveaways = {
  // Shown at the top of /giveaways and on the homepage.
  intro:
    'Every giveaway is posted in the server first. Entry is free, draws are random, and winners go up on the winners page.',

  // The channel people should head to. Used for the "enter in Discord" links.
  // A plain channel name is fine; if you paste a full Discord channel URL
  // (https://discord.com/channels/...) the buttons will link straight to it.
  channel: '#giveaways',
  channelUrl: null, // TODO — optional: paste the channel link for direct entry.

  // TODO — replace with your real drops. Delete any you are not running.
  active: [
    {
      title: 'TODO — prize name',
      prize: 'TODO — e.g. Steam key for a AAA release',
      value: null, // Optional: 'e.g. £50' — omit or null to hide.
      entry: 'React with the giveaway emoji on the post in #giveaways.',
      endsAt: '2026-08-22T20:00:00Z',
      tier: null,
      winners: 1,
      accent: 'cta',
    },
  ],

  // Announced but not open yet. `endsAt` is optional here — use `when` for a
  // loose date like 'Next Friday' if you have not fixed a time.
  upcoming: [
    {
      title: 'TODO — upcoming prize',
      prize: 'TODO — what they win',
      when: 'TODO — e.g. Friday 8pm GMT',
      tier: 'Level 10+',
      accent: 'secondary',
    },
  ],

  // Eligibility and claim rules, shown as a list on /giveaways. These are the
  // terms staff enforce, so keep them accurate.
  terms: [
    'One entry per person. Alt accounts are removed from the draw and from the server.',
    'You must be 13 or older and in the server at the time of the draw.',
    'Winners have 48 hours to claim. Keep your DMs open or we cannot reach you.',
    'Unclaimed prizes are redrawn rather than kept.',
    'Some prizes are region-locked — check the post before entering.',
    'Staff decisions on eligibility are final. Ask before entering if you are unsure.',
  ],
};

// ---------------------------------------------------------------------------
// Winners — powers /winners.
//
// Newest first; the page does not sort, so the order here is the order shown.
// `discordId` is optional and pulls that member's real avatar, same as the
// staff cards. `date` is an ISO date (YYYY-MM-DD) and is formatted for display.
//
// Leave this array empty and the page renders an honest "no winners yet" state
// rather than breaking.
// ---------------------------------------------------------------------------

export const winners = [
  // TODO — replace with real winners as you draw them.
  // { name: 'username', prize: 'Steam key — Elden Ring', date: '2026-08-08', discordId: null },
];

// ---------------------------------------------------------------------------
// Rules — your 10 rules, exactly as you wrote them.
// ---------------------------------------------------------------------------

export const rules = {
  intro:
    'Welcome! Please read and follow these rules to keep the community enjoyable for everyone.',

  items: [
    {
      title: 'Be respectful',
      body: 'No harassment, hate speech, discrimination, or personal attacks. Disagreements are fine — attacks aren’t.',
    },
    {
      title: 'No spam',
      body: 'No excessive messages, mass mentions, copy-pasted text, or off-topic flooding in channels.',
    },
    {
      title: 'No NSFW content',
      body: 'No explicit, graphic, or sexual content anywhere on the server.',
    },
    {
      title: 'No self-promotion or advertising',
      body: 'Don’t post invite links, server ads, referral links, or promote other communities/products without staff permission.',
    },
    {
      title: 'Use channels properly',
      body: 'Keep discussions in the channels they’re meant for. Check channel topics/descriptions if you’re unsure.',
    },
    {
      title: 'No doxxing or sharing personal info',
      body: 'Never share someone’s private information (real name, address, phone number, etc.) without their consent.',
    },
    {
      title: 'No impersonation',
      body: 'Don’t pretend to be staff, other members, or public figures.',
    },
    {
      title: 'Follow Discord’s Terms of Service',
      body: 'This includes the minimum age requirement (13+) and Discord’s Community Guidelines.',
    },
    {
      title: 'English only in main chats',
      body: 'Keeps moderation and conversation easy to follow.',
    },
    {
      title: 'Listen to staff',
      body: 'Moderators and admins are here to keep things running smoothly. Their decisions are final — if you disagree, open a ticket or DM a staff member instead of arguing in chat.',
    },
  ],

  footnote:
    'Breaking these rules may result in a warning, mute, kick, or ban depending on severity. Staff reserve the right to update these rules at any time.',
};

// ---------------------------------------------------------------------------
// Staff — TODO: replace these with your real team.
//
// `accent` tints the card border. Options: primary (cyan), secondary (violet),
// cta (rose). Use cta for owners, secondary for admins, primary for mods —
// or ignore that entirely, it's just colour.
//
// Add or remove entries freely; the grid adapts to any number.
// `discordId` is optional — if you fill it in with a user ID, the card pulls
// that member's real avatar. Leave it out and you get an initials tile.
// ---------------------------------------------------------------------------

export const staff = [
  {
    name: 'TODO — owner name',
    role: 'Owner',
    bio: 'TODO — one line about them.',
    accent: 'cta',
  },
  {
    name: 'TODO — admin name',
    role: 'Admin',
    bio: 'TODO — one line about them.',
    accent: 'secondary',
  },
  {
    name: 'TODO — mod name',
    role: 'Moderator',
    bio: 'TODO — one line about them.',
    accent: 'primary',
  },
  {
    name: 'TODO — mod name',
    role: 'Moderator',
    bio: 'TODO — one line about them.',
    accent: 'primary',
  },
];

// ---------------------------------------------------------------------------
// FAQ — shown on /apply above the form.
// ---------------------------------------------------------------------------

export const faq = [
  {
    q: 'How do the giveaways work?',
    a: 'Each one is posted in the giveaway channel with the prize, the entry method, and the closing time. React to enter, and the bot draws a winner at random when the timer ends. Winners are announced publicly and listed on the winners page.',
  },
  {
    q: 'Do I have to pay or invite people to enter?',
    a: 'No. Entry is free and there are no invite quotas. Some higher-value drops are limited to members above a certain level, which you reach just by taking part in the server.',
  },
  {
    q: 'How do you stop people entering twice?',
    a: 'Alt accounts and entry farming get you removed from the draw and usually from the server. One person, one entry — that is the whole reason the giveaways stay worth entering.',
  },
  {
    q: 'What if I win and do not reply?',
    a: 'You have 48 hours to claim before we redraw. Keep your DMs open for the server, or staff cannot reach you.',
  },
  {
    q: 'Do I need to be good at games to join?',
    a: 'No. Skill has never been a requirement. Plenty of people here are casual, plenty are competitive, and most are somewhere in between.',
  },
  {
    q: 'Is there a minimum age?',
    a: 'Yes — 13 or older, per Discord’s own Terms of Service. Some channels, events, and prizes may be restricted further at staff discretion.',
  },
  {
    q: 'What games do you play?',
    a: 'Whatever the community is into at the time. Channels get added when enough people are playing something, and quietly retired when they stop.',
  },
  {
    q: 'How do I level up?',
    a: 'Take part. Chatting and joining voice earns XP over time, which unlocks roles and better giveaway tiers. There is no way to buy your way up.',
  },
  {
    q: 'Someone is breaking the rules. What do I do?',
    a: 'Open a ticket or DM a staff member rather than arguing in chat. Include screenshots if you have them — it makes the call much easier for us.',
  },
  {
    q: 'What are you looking for in staff?',
    a: 'Presence and level-headedness, more than experience. We would rather promote someone already active and even-tempered than someone with a long résumé from servers we have never seen.',
  },
  {
    q: 'How long until I hear back about my application?',
    a: 'Usually within a week. We read every one, but we only reply to applications we are moving forward with — if you have not heard back after that, assume it is a no for now and feel free to apply again later.',
  },
];

// ---------------------------------------------------------------------------
// Staff application form.
//
// Each field becomes an input on /apply and a line in the Discord embed.
// `type` options: text, textarea, number, select.
// Reorder, add, or delete fields freely — the form and the embed both follow
// this array. `name` must be unique.
// ---------------------------------------------------------------------------

export const applicationForm = {
  heading: 'Apply for staff',
  intro:
    'Applications are read by the owner and admins. Be honest and take your time — a short, genuine answer beats a long copy-pasted one.',
  closedNotice: null, // Set to a string to close applications, e.g. 'Applications are closed until March.'

  fields: [
    {
      name: 'discordUsername',
      label: 'Your Discord username',
      type: 'text',
      required: true,
      placeholder: 'username',
      maxLength: 60,
    },
    {
      name: 'age',
      label: 'Your age',
      type: 'number',
      required: true,
      min: 13,
      max: 99,
      help: 'Must be 13 or older, per Discord’s Terms of Service.',
    },
    {
      name: 'timezone',
      label: 'Timezone',
      type: 'text',
      required: true,
      placeholder: 'e.g. GMT+1, EST, PST',
      maxLength: 40,
    },
    {
      name: 'hoursActive',
      label: 'Roughly how many hours a week are you around?',
      type: 'select',
      required: true,
      options: [
        'Under 5 hours',
        '5–10 hours',
        '10–20 hours',
        '20+ hours',
      ],
    },
    {
      name: 'experience',
      label: 'Any previous moderation experience?',
      type: 'textarea',
      required: false,
      placeholder: 'Servers, roles, and roughly how long. "None" is a perfectly fine answer.',
      maxLength: 800,
    },
    {
      name: 'why',
      label: 'Why do you want to be staff here?',
      type: 'textarea',
      required: true,
      placeholder: 'What made you want to apply?',
      maxLength: 1000,
    },
    {
      name: 'scenario',
      label: 'A member you are friendly with breaks a rule. What do you do?',
      type: 'textarea',
      required: true,
      placeholder: 'There is no trick here — we just want to see how you think.',
      maxLength: 1000,
    },
  ],
};

// ---------------------------------------------------------------------------
// Gallery.
//
// To use real images: drop files into `public/gallery/` and set `src` to the
// filename, e.g. src: '/gallery/my-screenshot.webp'.
// Leave `src` as null and a styled placeholder tile renders in its place, so
// the grid always looks intentional while you gather images.
//
// `alt` is required for accessibility and shows in the lightbox as the caption.
// `span` optionally makes a tile wider: 'wide' takes two columns.
// ---------------------------------------------------------------------------

export const gallery = [
  { src: null, alt: 'TODO — describe this screenshot', span: 'wide' },
  { src: null, alt: 'TODO — describe this screenshot' },
  { src: null, alt: 'TODO — describe this screenshot' },
  { src: null, alt: 'TODO — describe this screenshot' },
  { src: null, alt: 'TODO — describe this screenshot', span: 'wide' },
  { src: null, alt: 'TODO — describe this screenshot' },
];

// ---------------------------------------------------------------------------
// Navigation. Order here is the order in the header.
// ---------------------------------------------------------------------------

export const nav = [
  { label: 'Home', href: '/' },
  { label: 'Giveaways', href: '/giveaways', requires: 'showGiveaways' },
  { label: 'Winners', href: '/winners', requires: 'showWinners' },
  { label: 'Rules', href: '/rules' },
  { label: 'Staff', href: '/staff' },
  { label: 'Gallery', href: '/gallery', requires: 'showGallery' },
  { label: 'Leaderboard', href: '/leaderboard', requires: 'showLeaderboard' },
  { label: 'Apply', href: '/apply' },
];
