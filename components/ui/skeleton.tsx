import { cn } from "@/lib/utilities/cn";

/**
 * A single grey placeholder block.
 *
 * Decorative and hidden from assistive technology on purpose: a skeleton stands
 * in for content that is not there yet, so there is nothing to announce. The
 * panel drawing the skeleton is the one that owns the `aria-busy` and the
 * "loading" text a screen reader hears.
 *
 * Size and shape come from the caller, so a skeleton can be laid out with the
 * same classes as the thing it replaces and take up exactly its space.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("block animate-pulse rounded-md bg-[#e6ebf1]", className)}
    />
  );
}
