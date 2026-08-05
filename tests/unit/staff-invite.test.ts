import { describe, expect, it } from "vitest";

import { normalizeInviteEmails } from "../../features/administration/components/staff-invite-utils";

describe("normalizeInviteEmails", () => {
  it("splits comma or semicolon separated emails and trims whitespace", () => {
    expect(normalizeInviteEmails("one@gmail.com, two@gmail.com; three@gmail.com")).toEqual([
      "one@gmail.com",
      "two@gmail.com",
      "three@gmail.com"
    ]);
  });

  it("returns an empty array for blank input", () => {
    expect(normalizeInviteEmails("   ")).toEqual([]);
  });
});
