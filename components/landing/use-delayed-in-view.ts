"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

type DelayedInViewOptions = {
  threshold?: number;
  rootMargin?: string;
  resetDelay?: number;
};

export function useDelayedInView<T extends Element>({
  threshold = 0.2,
  rootMargin = "-8% 0px -12% 0px",
  resetDelay = 260
}: DelayedInViewOptions = {}): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    const clearResetTimer = () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          clearResetTimer();
          setIsVisible(true);
          return;
        }

        clearResetTimer();
        resetTimerRef.current = setTimeout(() => {
          setIsVisible(false);
          resetTimerRef.current = null;
        }, resetDelay);
      },
      { threshold, rootMargin }
    );

    observer.observe(element);

    return () => {
      clearResetTimer();
      observer.disconnect();
    };
  }, [resetDelay, rootMargin, threshold]);

  return [ref, isVisible];
}
