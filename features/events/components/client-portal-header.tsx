"use client";

import {
  PORTAL_HEADER_FALLBACK_LOGO,
  portalHeaderTone
} from "@/lib/ui/portal-header-theme";
import { useAppLanguage } from "@/components/providers/app-language-provider";

export type ClientPortalHeaderBackground = {
  /** A resolved hex colour - never the empty string the settings may hold. */
  color: string;
  /** A signed URL for the uploaded background, or null for a plain colour. */
  imageUrl: string | null;
};

type ClientPortalHeaderProps = {
  title: string;
  subtitle: string;
  /** Named so a screen reader is told whose logo this is, when it is theirs. */
  venueName: string;
  logoUrl: string | null;
  background: ClientPortalHeaderBackground;
};

/**
 * The band at the top of the client portal.
 *
 * Its own component because two screens draw it: the portal itself, and the
 * preview in Settings > General that an operator adjusts the background with.
 * A preview that is a separate implementation is a preview that drifts, and the
 * whole point of this one is to answer "what will my clients see".
 */
export function ClientPortalHeader({
  title,
  subtitle,
  venueName,
  logoUrl,
  background
}: ClientPortalHeaderProps) {
  const { t } = useAppLanguage();
  // A photograph has no single luminance to measure, so an image header is
  // always the light treatment - and the scrim below is what makes that true
  // rather than hoped for.
  const tone = background.imageUrl
    ? "light"
    : portalHeaderTone(background.color);

  return (
    // A column on a phone and a row from `sm` up: the logo is wide enough that
    // sitting it beside the title in a 360px viewport would leave the event
    // name breaking a word at a time.
    <header
      className={`relative flex flex-col gap-3 overflow-hidden rounded-t-lg p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-6 ${
        tone === "dark" ? "text-[#17202a]" : "text-white"
      }`}
      style={{ backgroundColor: background.color }}
    >
      {background.imageUrl ? (
        <>
          {/* An <img> rather than a CSS background: the URL is signed and
              carries a query string, and this way it never has to survive being
              quoted into an inline style. `object-cover` because a header is a
              crop of a photograph whatever its aspect ratio is. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            src={background.imageUrl}
          />
          {/* The scrim is not decoration. Nothing vets the photograph an
              operator uploads, so this is what keeps white text legible over a
              bright one. */}
          <span aria-hidden="true" className="absolute inset-0 bg-black/45" />
        </>
      ) : null}

      <div className="relative min-w-0">
        <h1 className="wrap-break-word text-xl font-black sm:text-2xl">
          {title}
        </h1>
        <p
          className={`mt-2 text-sm font-semibold ${
            tone === "dark" ? "text-[#3f4b5a]" : ""
          }`}
        >
          {subtitle}
        </p>
      </div>

      {/* The image and nothing else - no plate, no border. It sits straight on
          the header, so a logo with a transparent background reads as part of
          it.

          `order-first` puts it above the title while the header is a column,
          which is how a client reads a letterhead; from `sm` up it takes its
          place at the end of the row again.

          Sized by height with the width left to follow, capped: that is what
          keeps a square mark and a wide wordmark at the same visual weight
          without either being cropped or stretched.

          Plain <img> rather than next/image even for the fallback, which is a
          local file the optimizer could handle: the venue's own logo is a
          signed URL that expires in minutes, so the optimizer would never serve
          a cache hit and its host would have to be listed in remotePatterns -
          and one element for both keeps the two from drifting apart in size. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={
          logoUrl
            ? venueName
              ? `${venueName} logo`
              : t("events.venueLogo")
            : "Event Core"
        }
        className="relative order-first h-12 w-auto max-w-36 shrink-0 self-start object-contain sm:order-0 sm:h-16 sm:max-w-44 sm:self-auto"
        src={logoUrl ?? PORTAL_HEADER_FALLBACK_LOGO[tone]}
      />
    </header>
  );
}
