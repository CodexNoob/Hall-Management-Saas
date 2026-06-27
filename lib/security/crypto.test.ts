import { describe, expect, it } from "vitest";
import { decryptText, encryptText } from "@/lib/security/crypto";

describe("crypto helpers", () => {
  it("round trips encrypted text", () => {
    const secret = "test-secret";
    const encrypted = encryptText("refresh-token", secret);
    expect(decryptText(encrypted, secret)).toBe("refresh-token");
  });
});
