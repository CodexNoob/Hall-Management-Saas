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
    data: { properties?: { action_link?: string } | null } | null;
  }>;
};

/**
 * Normalizes to null rather than `??`, so a present-but-blank action_link is
 * reported as "no link" instead of being handed to the inviter as an empty
 * string to copy.
 */
function readActionLink(result: {
  data: { properties?: { action_link?: string } | null } | null;
}) {
  return result.data?.properties?.action_link || null;
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
  const invited = readActionLink(
    await admin.generateLink({ type: "invite", email, options: { redirectTo } })
  );

  if (invited) return invited;

  // `invite` is rejected once Supabase knows the address, which includes an
  // earlier attempt that created the auth user before its email failed. A
  // recovery link works for those and lands on the same password setup step,
  // because /auth/callback treats invite and recovery identically.
  return readActionLink(
    await admin.generateLink({ type: "recovery", email, options: { redirectTo } })
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
  return `${appUrl.replace(/\/$/, "")}/auth/callback`;
}
