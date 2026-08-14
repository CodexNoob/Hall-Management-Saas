import { afterEach, describe, expect, it, vi } from "vitest";

import { copyText } from "@/lib/ui/copy-text";

describe("copyText", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the Clipboard API when it is available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });

    await expect(copyText("https://example.com/client/1")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("https://example.com/client/1");
  });

  it("falls back when Clipboard API access is rejected", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) }
    });
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand
    });

    await expect(copyText("portal-link")).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("does not attempt to copy an empty value", async () => {
    await expect(copyText("")).resolves.toBe(false);
  });
});
