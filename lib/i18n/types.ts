/**
 * One string in every language the dashboard ships. The three fields are
 * required on purpose: a namespace entry cannot be added with a missing
 * translation, so a locale can never silently fall back to English because
 * somebody forgot a line. That guarantee is the whole reason the translations
 * live next to each other instead of in three parallel dictionaries.
 */
export type LocaleBundle = {
  /** Source text. Also what `en-US` and `en-GB` render. */
  en: string;
  /** Spanish (`es-US`). */
  es: string;
  /** Hebrew (`he-IL`), rendered right-to-left. */
  he: string;
};

export type Namespace = Record<string, LocaleBundle>;

/**
 * Identity helper. It exists so a namespace object keeps its literal key type
 * (needed to build `MessageKey`) while still being checked against
 * `Namespace`, which a plain `satisfies` on a large object does more slowly.
 */
export function defineMessages<const T extends Namespace>(messages: T): T {
  return messages;
}
