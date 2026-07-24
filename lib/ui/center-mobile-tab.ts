export function centerMobileTab(tab: HTMLElement) {
  if (
    typeof window === "undefined" ||
    !window.matchMedia("(max-width: 1023px)").matches
  ) {
    return;
  }

  window.requestAnimationFrame(() => {
    tab.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center"
    });
  });
}
