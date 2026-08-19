"use client";

import { useEffect } from "react";

// Module state, because `document.body` is module state: what the page's
// overflow was before anything locked it is one fact, not one per component.
let lockCount = 0;
let overflowBeforeFirstLock = "";

/**
 * Holds the page unscrollable for as long as `isLocked` is set.
 *
 * Counted rather than each caller saving and restoring `body.style.overflow`
 * itself, because dialogs stack: the remove confirmation opens on top of the
 * library item editor, and both are open at once. Two components each
 * remembering "what it was before me" hand the value back in whatever order
 * React runs their cleanups in - and the order it actually uses, cleanups in
 * tree order before any of the new effects, has the outer dialog restore first
 * and the inner one write `hidden` back over it. Closing both then leaves a
 * page that cannot scroll and nothing on screen to unlock it.
 *
 * Only the first lock reads the page's own value and only the last one puts it
 * back, so any number of stacked dialogs is one lock.
 */
export function useScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked) return;

    if (lockCount === 0) {
      overflowBeforeFirstLock = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }

    lockCount += 1;

    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        document.body.style.overflow = overflowBeforeFirstLock;
      }
    };
  }, [isLocked]);
}
