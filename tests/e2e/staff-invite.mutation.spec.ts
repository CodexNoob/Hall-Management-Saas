import { expect, test, type Page } from "@playwright/test";

/**
 * Covers the staff invite flow end to end: the dialog, the real POST /api/staff,
 * and what the directory shows afterwards.
 *
 * Deliberately does not assert that a message lands in an inbox. Delivery
 * depends on the receiving provider - Gmail defers mail from a young sending
 * domain for hours - so an inbox assertion would be a flaky test of someone
 * else's infrastructure. What this suite pins down is the part the app owns:
 * staff access is created, the request succeeds either way, and an invitation
 * that could not be sent degrades to a link the inviter can share by hand.
 */

const inviteMailbox = process.env.E2E_STAFF_INVITE_EMAIL;
const undeliveredNotice = /some invitations could not be emailed/i;

/**
 * Routes every run to one real mailbox through + subaddressing, so no invite is
 * ever sent to a fabricated address. Invented recipients hard-bounce, and
 * bounces are charged against the sending domain's reputation.
 */
function uniqueInviteAddress(mailbox: string) {
  const [local, domain] = mailbox.split("@");
  return `${local.split("+")[0]}+e2e-${Date.now()}@${domain}`;
}

// The form carries no dialog role and no accessible name, so anchor on the
// address field it uniquely contains rather than on a name lookup.
function inviteDialog(page: Page) {
  return page
    .locator("form")
    .filter({ has: page.getByLabel("Email addresses") });
}

/**
 * Fills the address field and hands back the dialog, ready to submit.
 *
 * The blur is not ceremony: the textarea takes a list, and it is parsed into
 * addresses on blur - until then `Send invitations` is disabled, and clicking a
 * disabled button moves no focus, so a click alone would wait on a state that
 * only the click could have produced.
 */
async function fillInvite(page: Page, email: string) {
  const dialog = await openInviteDialog(page);
  const addresses = dialog.getByLabel("Email addresses");

  await addresses.fill(email);
  await addresses.blur();

  return dialog;
}

async function openInviteDialog(page: Page) {
  await page.goto("/dashboard/staff");

  const invite = page.getByRole("button", { name: "Invite", exact: true });
  await expect(
    invite,
    "the mutation account needs staff.invite to invite anyone"
  ).toBeEnabled({ timeout: 30_000 });
  await invite.click();

  const dialog = inviteDialog(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

test.beforeEach(async () => {
  test.skip(
    !process.env.E2E_MUTATION_EMAIL || !process.env.E2E_MUTATION_PASSWORD,
    "Mutation E2E credentials are not set."
  );
});

test("creates staff access and reports invitation delivery without failing the request", async ({
  page
}) => {
  test.skip(
    !inviteMailbox,
    "E2E_STAFF_INVITE_EMAIL is not set, and this test refuses to send invites to an invented address."
  );

  // No teardown exists for staff, matching events.mutation.spec.ts. The unique
  // address keeps back-to-back runs from colliding on the email unique index.
  const inviteEmail = uniqueInviteAddress(inviteMailbox!);
  const dialog = await fillInvite(page, inviteEmail);

  const invitePost = page.waitForResponse(
    (response) =>
      response.url().includes("/api/staff") &&
      response.request().method() === "POST"
  );
  /**
   * The refetch the page runs AFTER the invite, told apart from the one it ran
   * on the way in by the address it carries.
   *
   * The directory loads itself on mount, and that fetch is issued after
   * hydration - which is after `fillInvite` returned and after this waiter is
   * registered. Matching on method and status alone resolved with that one, and
   * a snapshot taken before the invite is exactly the snapshot that cannot
   * contain it. Registering the waiter after the POST instead would swap this
   * race for the opposite one: `refresh()` runs the moment the POST resolves, so
   * the response could land before anything was listening.
   */
  const directoryRefresh = page.waitForResponse(
    async (response) =>
      response.url().includes("/api/staff") &&
      response.request().method() === "GET" &&
      response.status() === 200 &&
      (await response.text()).includes(inviteEmail)
  );

  await dialog.getByRole("button", { name: "Send invitations" }).click();
  const response = await invitePost;

  // The original defect: staff rows were committed inside the transaction and
  // then a rate-limited invitation email threw, turning the whole request into
  // a 500 while the records already existed.
  expect(response.status()).toBe(200);
  await expect(dialog).toBeHidden({ timeout: 30_000 });

  const payload = await response.json();
  expect(payload.staff.map((member: { email: string }) => member.email)).toContain(
    inviteEmail
  );

  const invite = payload.invites.find(
    (item: { email: string }) => item.email === inviteEmail
  );
  expect(invite, "every invited address needs a delivery result").toBeTruthy();

  if (invite.emailSent) {
    // A delivered email owns the only valid token, so nothing may regenerate it.
    expect(invite.inviteLink).toBeNull();
    await expect(page.getByText("Invitations sent.")).toBeVisible();
  } else {
    expect(
      invite.inviteLink,
      "an undelivered invitation must still yield a shareable link"
    ).toBeTruthy();
    await expect(page.getByText(undeliveredNotice)).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy link" })).toBeVisible();
  }

  // Kept as an assertion on `staff` rather than left to the predicate's
  // substring match: the invited address has to come back as a member of the
  // directory, not merely somewhere in the body.
  const directory = await (await directoryRefresh).json();
  expect(
    directory.staff.map((member: { email: string }) => member.email)
  ).toContain(inviteEmail);
});

test("hands the inviter a copyable link when the invitation email cannot be sent", async ({
  context,
  page
}) => {
  const inviteEmail = `e2e-undelivered-${Date.now()}@example.com`;
  const linklessEmail = `e2e-linkless-${Date.now()}@example.com`;
  const inviteLink =
    "https://app.example.com/auth/confirm?token_hash=e2e-token-hash&type=invite";

  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  // The send fails inside the route handler, which the browser cannot provoke.
  // Stubbing only the POST leaves the rest of the page real: the directory
  // refetch still hits the server, and the panel and clipboard are the app's.
  await page.route("**/api/staff", async (route) => {
    if (route.request().method() !== "POST") return route.continue();

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        staff: [],
        invites: [
          {
            email: inviteEmail,
            emailSent: false,
            inviteLink,
            error: "email rate limit exceeded"
          },
          // A second failure with no link to fall back on. The panel shows a row
          // the inviter can act on OR the reason it cannot be acted on, never
          // both, so covering the reason takes an invitation that produced no
          // link - which is also the worse case for the inviter to be told about.
          {
            email: linklessEmail,
            emailSent: false,
            inviteLink: null,
            error: "email rate limit exceeded"
          }
        ]
      })
    });
  });

  const dialog = await fillInvite(page, inviteEmail);
  await dialog.getByRole("button", { name: "Send invitations" }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });

  await expect(page.getByText(undeliveredNotice)).toBeVisible();

  const inviteRow = page.getByRole("listitem").filter({ hasText: inviteEmail });
  await expect(inviteRow).toBeVisible();

  // The one that failed without a link says why instead of offering a button.
  const linklessRow = page
    .getByRole("listitem")
    .filter({ hasText: linklessEmail });
  await expect(linklessRow.getByText("email rate limit exceeded")).toBeVisible();
  await expect(linklessRow.getByRole("button", { name: "Copy link" })).toHaveCount(
    0
  );

  // The clipboard, not a rendered field, is where the token has to arrive: the
  // panel holds it in the button's handler and never draws it on the page.
  await inviteRow.getByRole("button", { name: "Copy link" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    inviteLink
  );

  // The panel is the only copy of that token, so it must not be swept away on a
  // timer. The green `notice` beside it clears itself after 2800ms; this panel is
  // deliberately held out of that (staff-page.tsx), and only the next submit
  // replaces it. Waiting past that window is what proves the two are separate -
  // there is no dismiss control to click, by design.
  await page.waitForTimeout(3500);
  await expect(page.getByText(undeliveredNotice)).toBeVisible();
  await expect(inviteRow.getByRole("button", { name: "Copy link" })).toBeVisible();
});
