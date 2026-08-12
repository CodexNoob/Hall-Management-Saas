import { describe, expect, it } from "vitest";

import { readMutationResponse } from "@/features/administration/components/staff-dialog";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("readMutationResponse", () => {
  it("returns the payload so the caller can read per-invite delivery status", async () => {
    const invites = [
      {
        email: "coordinator@example.com",
        emailSent: false,
        inviteLink: "https://app.example.com/invite-token",
        error: "email rate limit exceeded"
      }
    ];

    const payload = await readMutationResponse(jsonResponse({ invites }));

    expect(payload?.invites).toEqual(invites);
  });

  it("throws the server's message on a failed response", async () => {
    await expect(
      readMutationResponse(
        jsonResponse({ error: "Enter a valid staff Gmail or email address." }, 400)
      )
    ).rejects.toThrow("Enter a valid staff Gmail or email address.");
  });

  it("falls back to a generic message when a failure has no body", async () => {
    await expect(
      readMutationResponse(new Response(null, { status: 500 }))
    ).rejects.toThrow("Unable to update staff.");
  });

  it("resolves to null when a successful response has no JSON body", async () => {
    expect(await readMutationResponse(new Response(null, { status: 204 }))).toBeNull();
  });

  it("leaves invites undefined for the responses that do not carry them", async () => {
    const payload = await readMutationResponse(jsonResponse({ staff: {} }));

    expect(payload?.invites).toBeUndefined();
  });
});
