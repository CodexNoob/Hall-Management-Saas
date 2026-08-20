import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LandingNavbar } from "@/features/landing/components/landing-navbar";
import {
  REMEMBER_AUTH_COOKIE,
  REMEMBER_UNTIL_COOKIE
} from "@/lib/supabase/cookie-policy";

const SESSION_COOKIE = "sb-testproject-auth-token";

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/`;
}

function clearCookies() {
  for (const entry of document.cookie.split(";")) {
    const name = entry.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=; Path=/; Max-Age=0`;
  }
}

afterEach(clearCookies);

/**
 * Every auth destination the navbar points at, across all three CTA slots - the
 * compact button below `sm`, the desktop cluster, and the mobile menu. Asserted
 * by href rather than by label because jsdom applies no Tailwind, so all three
 * are in the tree at once no matter which breakpoint would show them.
 */
function ctaTargets() {
  return screen
    .getAllByRole("link")
    .map((link) => link.getAttribute("href"))
    .filter(
      (href) => href === "/login" || href === "/signup" || href === "/dashboard"
    );
}

describe("the landing navbar CTA", () => {
  it("offers sign-in to an anonymous visitor", () => {
    render(<LandingNavbar />);

    const targets = ctaTargets();

    expect(targets).toContain("/login");
    expect(targets).toContain("/signup");
    expect(targets).not.toContain("/dashboard");
    expect(screen.getAllByRole("link", { name: "Login" })).not.toHaveLength(0);
  });

  it("offers the dashboard to a visitor carrying a session", () => {
    setCookie(SESSION_COOKIE, "base64-session");

    render(<LandingNavbar />);

    const targets = ctaTargets();

    expect(targets).toContain("/dashboard");
    expect(targets).not.toContain("/login");
    expect(targets).not.toContain("/signup");
    expect(
      screen.getAllByRole("link", { name: "Go to Dashboard" })
    ).not.toHaveLength(0);
  });

  /**
   * The verifier is written before the redirect to the OAuth provider and
   * survives an abandoned sign-in. Treating it as a session would invite people
   * who never finished signing in to a dashboard they cannot reach.
   */
  it("does not count a stranded PKCE verifier as a session", () => {
    setCookie(`${SESSION_COOKIE}-code-verifier`, "verifier");

    render(<LandingNavbar />);

    expect(ctaTargets()).not.toContain("/dashboard");
    expect(ctaTargets()).toContain("/login");
  });

  /**
   * proxy.ts expires these cookies on the next navigation, so advertising the
   * dashboard here would send the visitor to a sign-in page instead.
   */
  it("ignores a session whose remember window has closed", () => {
    setCookie(SESSION_COOKIE, "base64-session");
    setCookie(REMEMBER_AUTH_COOKIE, "true");
    setCookie(REMEMBER_UNTIL_COOKIE, String(Date.now() - 1000));

    render(<LandingNavbar />);

    expect(ctaTargets()).not.toContain("/dashboard");
  });

  /**
   * Sign-out writes `name=; Max-Age=0`, and the browser can still hand the
   * empty cookie back on the render that immediately follows. Reading that as a
   * session is the logout trap: signed out, but still shown the dashboard.
   */
  it("ignores an emptied cookie mid-sign-out", () => {
    setCookie(SESSION_COOKIE, "");

    render(<LandingNavbar />);

    expect(ctaTargets()).not.toContain("/dashboard");
    expect(ctaTargets()).toContain("/login");
  });
});
