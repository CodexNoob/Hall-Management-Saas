export type StaffInvitation = {
  email: string;
  emailSent: boolean;
  inviteLink: string | null;
  error: string | null;
};

/**
 * Only the two admin calls the invitation flow needs. Declaring the surface
 * structurally rather than taking the whole Supabase client keeps this module
 * free of the route handler's Prisma and Next.js imports, so it can be unit
 * tested against a stub.
 */
export type StaffInviteClient = {
  inviteUserByEmail: (
    email: string,
    options?: { redirectTo?: string }
  ) => Promise<{ error: { message: string } | null }>;
  generateLink: (params: {
    type: "invite" | "recovery";
    email: string;
    options?: { redirectTo?: string };
  }) => Promise<{
    data: { properties?: { hashed_token?: string } | null } | null;
  }>;
};

/**
 * Builds the shareable link from `hashed_token` rather than returning Supabase's
 * own `action_link`.
 *
 * `action_link` is a GoTrue /auth/v1/verify URL. It never consults the email
 * template, so repointing the templates at /auth/confirm does nothing for it -
 * it would keep issuing implicit-flow links long after the transitional page
 * that absorbs those is deleted, and this fallback is precisely the path that
 * matters when invitation mail is failing.
 *
 * `redirectTo` is the same /auth/confirm base the emails are built from, so the
 * two stay in step by construction.
 *
 * Normalizes to null rather than `??`, so a present-but-blank token is reported
 * as "no link" instead of handing the inviter an empty string to copy.
 */
function buildInviteLink(
  result: { data: { properties?: { hashed_token?: string } | null } | null },
  type: "invite" | "recovery",
  redirectTo: string
) {
  const hashedToken = result.data?.properties?.hashed_token;

  if (!hashedToken) return null;

  return `${redirectTo}?token_hash=${encodeURIComponent(hashedToken)}&type=${type}`;
}

/**
 * Produces a link the inviter can pass along by hand. Only call this once the
 * invitation email has already failed: generating a link replaces the token on
 * the user record, which would invalidate a link that did reach an inbox.
 */
export async function generateStaffInviteLink(
  admin: StaffInviteClient,
  email: string,
  redirectTo: string
) {
  const invited = buildInviteLink(
    await admin.generateLink({ type: "invite", email, options: { redirectTo } }),
    "invite",
    redirectTo
  );

  if (invited) return invited;

  // `invite` is rejected once Supabase knows the address, which includes an
  // earlier attempt that created the auth user before its email failed. A
  // recovery link works for those and lands on the same password setup step,
  // because /auth/confirm treats invite and recovery identically.
  return buildInviteLink(
    await admin.generateLink({ type: "recovery", email, options: { redirectTo } }),
    "recovery",
    redirectTo
  );
}

/**
 * Best effort by design. Staff access is already committed by the time this
 * runs, so a mail provider outage must not be reported as a failed request -
 * it downgrades to a link the inviter can share over any channel.
 */
export async function sendStaffInvitations(
  admin: StaffInviteClient,
  inviteEmails: string[],
  redirectTo: string
): Promise<StaffInvitation[]> {
  const invitations: StaffInvitation[] = [];

  // Sequential on purpose: Supabase meters auth emails against one hourly quota,
  // so a parallel burst can spend it on the first few addresses and leave the
  // rest with nothing to send.
  for (const email of inviteEmails) {
    const { error } = await admin.inviteUserByEmail(email, { redirectTo });

    if (!error) {
      invitations.push({ email, emailSent: true, inviteLink: null, error: null });
      continue;
    }

    invitations.push({
      email,
      emailSent: false,
      inviteLink: await generateStaffInviteLink(admin, email, redirectTo),
      error: error.message
    });
  }

  return invitations;
}

export function staffInviteRedirectTo(appUrl: string) {
  // No query string: the email template composes the link as
  // `{{ .RedirectTo }}?token_hash=...&type=invite`, and buildInviteLink above
  // appends the same suffix. Either would produce a second `?` if this carried
  // one of its own.
  return `${appUrl.replace(/\/$/, "")}/auth/confirm`;
}
