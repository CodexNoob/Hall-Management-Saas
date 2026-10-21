"use client";

import {
  normalizeLocale,
  translate,
  type AppLocale,
  type MessageKey
} from "@/lib/i18n/messages";

/**
 * The current locale, for client modules that cannot hold a hook.
 *
 * Most translation goes through `useAppLanguage`, which is a React context and
 * re-renders everything under it when the language changes. A handful of
 * modules cannot use it at all: the shared query cache is a module-level store
 * whose `runQuery` is called from `prefetchAuthenticatedQuery` outside any
 * component, and the upload helpers are plain functions a dialog calls. Passing
 * a translator down to each of them would mean threading it through four or
 * five call sites that have no other reason to know about language.
 *
 * So the provider publishes the locale here, and those modules read it. The
 * value is written on every locale change, which happens in an effect - so a
 * read that races a change returns the previous locale for one tick. That is
 * acceptable for a rejection message; it is not acceptable for anything
 * rendered, which is why no component should reach for this instead of the
 * hook.
 *
 * DO NOT import this from server code. Module state on the server is shared by
 * every request, so one tenant's language would leak into another's response.
 * The `"use client"` directive above marks the boundary; the discipline is what
 * enforces it.
 */
let ambientLocale: AppLocale = "en-US";

/** Called by `AppLanguageProvider`. Nothing else should write this. */
export function setAmbientLocale(locale: string | AppLocale) {
  ambientLocale = normalizeLocale(locale);
}

export function ambientTranslate(
  key: MessageKey,
  values?: Record<string, string | number>
) {
  return translate(ambientLocale, key, values);
}
