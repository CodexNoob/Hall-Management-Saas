"use client";

const PUBLIC_SCROLL_TARGET_KEY = "event-core.public-navigation.scroll-target";

export function preparePublicPageNavigation(href: string) {
  window.sessionStorage.setItem(PUBLIC_SCROLL_TARGET_KEY, href);
}

export function restorePublicPageScroll() {
  const target = window.sessionStorage.getItem(PUBLIC_SCROLL_TARGET_KEY);
  if (!target) return;
  window.sessionStorage.removeItem(PUBLIC_SCROLL_TARGET_KEY);

  window.requestAnimationFrame(() => {
    const url = new URL(target, window.location.origin);
    const id = decodeURIComponent(url.hash.slice(1));
    if (id) {
      document.getElementById(id)?.scrollIntoView({ block: "start" });
      return;
    }
    window.scrollTo({ top: 0, left: 0 });
  });
}
