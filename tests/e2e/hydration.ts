import type { Page } from "@playwright/test";

/**
 * Waits until React has attached its handlers to an element.
 *
 * These pages are server-rendered, so the markup - including a submit button -
 * exists before any JavaScript runs. Clicking that early triggers a native form
 * submission instead of the component's onSubmit, and the validation under test
 * never runs. React tags every hydrated DOM node with a `__reactFiber$` key, so
 * that is the signal to wait for.
 */
export async function waitForHydration(page: Page, selector = "form") {
  await page.waitForFunction(
    (target) => {
      const element = document.querySelector(target);
      if (!element) return false;

      return Object.keys(element).some(
        (key) =>
          key.startsWith("__reactFiber$") || key.startsWith("__reactProps$")
      );
    },
    selector,
    // Poll on a timer, not the default requestAnimationFrame: the suite runs
    // nine workers in parallel, so most browser windows are backgrounded and
    // rAF is throttled to the point where the probe can stop re-evaluating.
    { polling: 100 }
  );
}
