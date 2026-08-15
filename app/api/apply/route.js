import { applicationForm } from '@/content/site.config';

// ---------------------------------------------------------------------------
// POST /api/apply — staff application form handler.
//
// Why this route exists at all: the webhook URL is a write capability for a
// channel in your server. Anything shipped to the browser can be read out of
// the bundle, so the form posts here and this route calls Discord. The URL
// stays in .env.local and never leaves the server.
//
// Guards, in order:
//   1. Rate limit  — per IP, in-memory
//   2. Honeypot    — a hidden field real users never fill in
//   3. Validation  — required fields, lengths, and age bounds re-checked here
//                    because client-side validation is a convenience, not a
//                    control; anything can POST directly to this endpoint.
// ---------------------------------------------------------------------------

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_PER_WINDOW = 3;

// In-memory, so it resets on redeploy and isn't shared between serverless
// instances. Enough to stop casual spam from one browser. If you ever get
// targeted properly, move this to Redis or Upstash.
const hits = new Map();

function rateLimit(ip) {
  const now = Date.now();
  const record = hits.get(ip);

  if (!record || now > record.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  if (record.count >= MAX_PER_WINDOW) {
    return {
      allowed: false,
      retryAfter: Math.ceil((record.resetAt - now) / 1000),
    };
  }

  record.count += 1;
  return { allowed: true };
}

// Keep the map from growing without bound across a long-lived process.
function sweep() {
  const now = Date.now();
  for (const [ip, record] of hits) {
    if (now > record.resetAt) hits.delete(ip);
  }
}

function clientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

export async function POST(request) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;

  if (!webhook) {
    return Response.json(
      {
        ok: false,
        error: 'not_configured',
        message:
          'Applications are not connected yet. Set DISCORD_WEBHOOK_URL in .env.local.',
      },
      { status: 503 }
    );
  }

  if (applicationForm.closedNotice) {
    return Response.json(
      { ok: false, error: 'closed', message: applicationForm.closedNotice },
      { status: 403 }
    );
  }

  sweep();
  const ip = clientIp(request);
  const limit = rateLimit(ip);

  if (!limit.allowed) {
    return Response.json(
      {
        ok: false,
        error: 'rate_limited',
        message: `Too many applications from this connection. Try again in about ${Math.ceil(
          limit.retryAfter / 60
        )} minutes.`,
      },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: 'bad_request', message: 'Could not read the form data.' },
      { status: 400 }
    );
  }

  // Honeypot: hidden field, visually and from assistive tech. Any value means
  // a bot filled the form in. Return 200 so the bot sees success and moves on.
  if (payload._hp) {
    return Response.json({ ok: true });
  }

  const errors = {};
  const clean = {};

  for (const field of applicationForm.fields) {
    const raw = payload[field.name];
    const value = typeof raw === 'string' ? raw.trim() : raw;

    if (field.required && (value === undefined || value === null || value === '')) {
      errors[field.name] = 'This one is required.';
      continue;
    }

    if (value === undefined || value === null || value === '') continue;

    if (field.type === 'number') {
      const num = Number(value);
      if (!Number.isFinite(num)) {
        errors[field.name] = 'Enter a number.';
        continue;
      }
      if (field.min !== undefined && num < field.min) {
        errors[field.name] = `Must be at least ${field.min}.`;
        continue;
      }
      if (field.max !== undefined && num > field.max) {
        errors[field.name] = `Must be ${field.max} or lower.`;
        continue;
      }
      clean[field.name] = String(num);
      continue;
    }

    if (field.type === 'select') {
      if (!field.options.includes(value)) {
        errors[field.name] = 'Pick one of the listed options.';
        continue;
      }
      clean[field.name] = value;
      continue;
    }

    // Hard cap regardless of the configured maxLength, so a huge body can't be
    // used to flood the channel or blow past Discord's embed limits.
    const cap = Math.min(field.maxLength ?? 1000, 1024);
    if (String(value).length > cap) {
      errors[field.name] = `Keep this under ${cap} characters.`;
      continue;
    }

    clean[field.name] = String(value);
  }

  if (Object.keys(errors).length > 0) {
    return Response.json({ ok: false, error: 'validation', errors }, { status: 422 });
  }

  // Build the embed. Field order follows site.config.js, so reordering the form
  // reorders the embed with no change here.
  const embedFields = applicationForm.fields
    .filter((field) => clean[field.name])
    .map((field) => ({
      name: field.label.slice(0, 256),
      value: clean[field.name].slice(0, 1024),
      // Short answers sit side by side; long-form answers get a full row.
      inline: field.type !== 'textarea' && clean[field.name].length < 40,
    }));

  const applicant = clean.discordUsername ?? 'Unknown applicant';

  const body = {
    // Suppress every kind of ping. Without this, an applicant typing @everyone
    // into a textarea would mention your whole server from a staff webhook.
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: 'New staff application',
        description: `From **${applicant.slice(0, 200)}**`,
        color: 0x22d3ee,
        fields: embedFields.slice(0, 25), // Discord's per-embed field cap.
        timestamp: new Date().toISOString(),
        footer: { text: 'Submitted via the website' },
      },
    ],
  };

  try {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      // Log server-side for debugging; never echo Discord's response body to
      // the client, since it can contain the webhook ID.
      console.error('[apply] webhook rejected', response.status);

      return Response.json(
        {
          ok: false,
          error: 'webhook_failed',
          message:
            'Could not deliver your application. Please open a ticket in Discord instead.',
        },
        { status: 502 }
      );
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error('[apply] webhook unreachable', error);

    return Response.json(
      {
        ok: false,
        error: 'unreachable',
        message:
          'Could not reach Discord. Please try again shortly, or open a ticket in the server.',
      },
      { status: 502 }
    );
  }
}
