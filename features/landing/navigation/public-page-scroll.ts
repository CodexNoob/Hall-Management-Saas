"use client";

const PUBLIC_SCROLL_TARGET_KEY = "event-core.public-navigation.scroll-target";

function targetFromHref(href: string) {
  const url = new URL(href, window.location.origin);
  return decodeURIComponent(url.hash.slice(1));
}

function openContactModal() {
  window.dispatchEvent(new Event("event-core:open-contact"));
}

export function preparePublicPageNavigation(href: string) {
  window.sessionStorage.setItem(PUBLIC_SCROLL_TARGET_KEY, href);
}

export function restorePublicPageScroll() {
  const target = window.sessionStorage.getItem(PUBLIC_SCROLL_TARGET_KEY);
  if (!target) return;
  window.sessionStorage.removeItem(PUBLIC_SCROLL_TARGET_KEY);

  window.requestAnimationFrame(() => {
    const id = targetFromHref(target);
    if (id === "contact") {
      openContactModal();
      return;
    }
    if (id) {
      document.getElementById(id)?.scrollIntoView({ block: "start" });
      return;
    }
    window.scrollTo({ top: 0, left: 0 });
  });
}

export function openPublicPageTarget(href: string) {
  const url = new URL(href, window.location.origin);
  const currentPath = `${window.location.pathname}${window.location.search}`;
  const targetPath = `${url.pathname}${url.search}`;

  if (targetPath !== currentPath) {
    preparePublicPageNavigation(href);
    return false;
  }

  const id = targetFromHref(href);
  if (id === "contact") {
    openContactModal();
    return true;
  }

  if (!id) {
    window.history.pushState(null, "", targetPath || "/");
    window.scrollTo({ top: 0, left: 0 });
    return true;
  }

  const target = document.getElementById(id);
  if (!target) {
    preparePublicPageNavigation(href);
    return false;
  }

  window.history.pushState(null, "", `${targetPath}${url.hash}`);
  target.scrollIntoView({ block: "start" });
  return true;
}
