// ---------------------------------------------------------------------------
// GET /api/discord — live member and online counts.
//
// Reads them from the invite API rather than the widget, because the server
// widget is disabled. The invite endpoint returns approximate counts for any
// valid invite code with no auth and no bot required.
//
// Runs server-side only. Nothing here is secret (the invite is public), but
// keeping the fetch on the server means one cached request serves every visitor
// instead of each browser hitting Discord directly.
// ---------------------------------------------------------------------------

const INVITE_API = 'https://discord.com/api/v10/invites';

export const revalidate = 60; // Cache for a minute; counts don't need to be instant.

export async function GET() {
  const code = process.env.DISCORD_INVITE_CODE;

  if (!code) {
    return Response.json(
      { ok: false, error: 'not_configured' },
      { status: 200 } // Not an error the visitor caused — the UI just hides the counts.
    );
  }

  try {
    const response = await fetch(
      `${INVITE_API}/${encodeURIComponent(code)}?with_counts=true&with_expiration=true`,
      {
        headers: { Accept: 'application/json' },
        next: { revalidate: 60 },
      }
    );

    if (!response.ok) {
      // 404 here almost always means the invite expired or was revoked.
      return Response.json(
        {
          ok: false,
          error: response.status === 404 ? 'invite_invalid' : 'discord_error',
          status: response.status,
        },
        { status: 200 }
      );
    }

    const data = await response.json();

    return Response.json({
      ok: true,
      members: data.approximate_member_count ?? null,
      online: data.approximate_presence_count ?? null,
      // Surfaced so a future admin view could warn before the invite dies.
      expiresAt: data.expires_at ?? null,
      guildName: data.guild?.name ?? null,
    });
  } catch {
    // Network failure, DNS, timeout — the page degrades to hiding the counts.
    return Response.json({ ok: false, error: 'unreachable' }, { status: 200 });
  }
}
