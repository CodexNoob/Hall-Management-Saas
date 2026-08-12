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
const undeliveredNotice = /these invitation emails were not delivered/i;

/**
 * Routes every run to one real mailbox through + subaddressing, so no invite is
 * ever sent to a fabricated address. Invented recipients hard-bounce, and
 * bounces are charged against the sending domain's reputation.
 */
function uniqueInviteAddress(mailbox: string) {
  const [local, domain] = mailbox.split("@");
  return `${local.split("+")[0]}+e2e-${Date.now()}@${domain}`;
}

// The form carries role="dialog" without an accessible name, so anchor on the
// invite field it uniquely contains rather than on a name lookup.
function inviteDialog(page: Page) {
  return page
    .locator("form[role=dialog]")
    .filter({ has: page.locator("#staff-invite-email") });
}

async function openInviteDialog(page: Page) {
  await page.goto("/dashboard/staff");

  const addStaff = page.getByRole("button", { name: "Add staff" });
  await expect(
    addStaff,
    "the mutation account needs canEditStaff to invite anyone"
  ).toBeEnabled({ timeout: 30_000 });
  await addStaff.click();

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
  const dialog = await openInviteDialog(page);
  await dialog.locator("#staff-invite-email").fill(inviteEmail);

  const invitePost = page.waitForResponse(
    (response) =>
      response.url().includes("/api/staff") &&
      response.request().method() === "POST"
  );
  const directoryRefresh = page.waitForResponse(
    (response) =>
      response.url().includes("/api/staff") &&
      response.request().method() === "GET" &&
      response.status() === 200
  );

  await dialog.getByRole("button", { name: "Invite staff" }).click();
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
    await expect(
      page.getByText("Staff invitation email sent. They can use the invite link to join.")
    ).toBeVisible();
  } else {
    expect(
      invite.inviteLink,
      "an undelivered invitation must still yield a shareable link"
    ).toBeTruthy();
    await expect(page.getByText(undeliveredNotice)).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy" })).toBeVisible();
  }

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
  const inviteLink =
    "https://app.example.com/auth/callback#access_token=e2e-token&type=invite";

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
          }
        ]
      })
    });
  });

  const dialog = await openInviteDialog(page);
  await dialog.locator("#staff-invite-email").fill(inviteEmail);
  await dialog.getByRole("button", { name: "Invite staff" }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });

  await expect(page.getByText(undeliveredNotice)).toBeVisible();

  const inviteRow = page.getByRole("listitem").filter({ hasText: inviteEmail });
  await expect(inviteRow).toBeVisible();
  await expect(inviteRow.getByText("email rate limit exceeded")).toBeVisible();
  await expect(inviteRow.locator("input")).toHaveValue(inviteLink);

  await inviteRow.getByRole("button", { name: "Copy" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    inviteLink
  );

  // The panel is the only copy of that token, so it must survive the notice
  // timeout and only leave when the inviter dismisses it.
  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(page.getByText(undeliveredNotice)).toBeHidden();
});
