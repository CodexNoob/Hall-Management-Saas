import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LandingFooter } from "@/features/landing/components/landing-footer";

const scrollIntoView = vi.fn();

vi.mock("next/image", () => ({
  default: ({
    alt = "",
    unoptimized,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => {
    void unoptimized;
    return (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
    );
  }
}));

vi.mock("next/link", () => ({
  default: (
    props: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    scroll?: boolean;
  }) => {
    const { href, onClick, scroll, ...anchorProps } = props;
    void scroll;

    return (
      <a
        href={href}
        onClick={(event) => {
          onClick?.(event);
          event.preventDefault();
        }}
        {...anchorProps}
      />
    );
  }
}));

describe("LandingFooter quick links", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    window.sessionStorage.clear();
    scrollIntoView.mockReset();
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView
    });
  });

  it("scrolls same-page quick links to their section", () => {
    const target = document.createElement("section");
    target.id = "features";
    document.body.append(target);

    render(<LandingFooter />);

    fireEvent.click(screen.getByRole("link", { name: "Features" }));

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
    expect(window.location.hash).toBe("#features");
  });

  it("opens the contact modal trigger instead of linking to a missing section", () => {
    const openContact = vi.fn();
    window.addEventListener("event-core:open-contact", openContact);

    render(<LandingFooter />);

    fireEvent.click(screen.getByRole("link", { name: "Contact" }));

    expect(openContact).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe("");
    window.removeEventListener("event-core:open-contact", openContact);
  });

  it("keeps cross-page documentation navigation ready for scroll restoration", () => {
    render(<LandingFooter />);

    fireEvent.click(screen.getByRole("link", { name: "Documentation" }));

    expect(
      window.sessionStorage.getItem("event-core.public-navigation.scroll-target")
    ).toBe("/documentation");
  });
});
