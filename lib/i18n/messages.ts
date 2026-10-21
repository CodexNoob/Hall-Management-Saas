import { billingMessages } from "@/lib/i18n/namespaces/billing";
import { bookingsMessages } from "@/lib/i18n/namespaces/bookings";
import { calendarMessages } from "@/lib/i18n/namespaces/calendar";
import { commonMessages } from "@/lib/i18n/namespaces/common";
import { dashboardMessages } from "@/lib/i18n/namespaces/dashboard";
import { diningMessages } from "@/lib/i18n/namespaces/dining";
import { directoryMessages } from "@/lib/i18n/namespaces/directory";
import { eventsMessages } from "@/lib/i18n/namespaces/events";
import { filesMessages } from "@/lib/i18n/namespaces/files";
import { hallMapMessages } from "@/lib/i18n/namespaces/hall-map";
import { kitchenMessages } from "@/lib/i18n/namespaces/kitchen";
import { menuMessages } from "@/lib/i18n/namespaces/menu";
import { navMessages } from "@/lib/i18n/namespaces/nav";
import { settingsMessages } from "@/lib/i18n/namespaces/settings";
import { staffMessages } from "@/lib/i18n/namespaces/staff";
import { supportMessages } from "@/lib/i18n/namespaces/support";
import { validationMessages } from "@/lib/i18n/namespaces/validation";
import { activityMessages } from "@/lib/i18n/namespaces/activity";
import { authzMessages } from "@/lib/i18n/namespaces/authz";
import { accountMessages } from "@/lib/i18n/namespaces/account";
import type { LocaleBundle } from "@/lib/i18n/types";

export const SUPPORTED_LOCALES = ["en-US", "en-GB", "es-US", "he-IL"] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Every message, with all three languages side by side.
 *
 * Exported so `tests/unit/i18n-catalog.test.ts` can walk it. Application code
 * goes through `translate` or the `useAppLanguage` hook - reading a bundle
 * directly would be reading one language out of a structure whose whole point
 * is that the three cannot drift apart.
 */
export const messageCatalog = {
  ...commonMessages,
  ...navMessages,
  ...dashboardMessages,
  ...calendarMessages,
  ...bookingsMessages,
  ...eventsMessages,
  ...menuMessages,
  ...kitchenMessages,
  ...billingMessages,
  ...filesMessages,
  ...staffMessages,
  ...settingsMessages,
  ...diningMessages,
  ...hallMapMessages,
  ...directoryMessages,
  ...supportMessages,
  ...validationMessages,
  ...activityMessages,
  ...authzMessages,
  ...accountMessages
};

export type MessageKey = keyof typeof messageCatalog;

/**
 * `en-GB` shares the `en` copy: the dashboard has no spelling fork, and giving
 * it its own column would only invite one to drift in.
 */
const localeColumn: Record<AppLocale, "en" | "es" | "he"> = {
  "en-US": "en",
  "en-GB": "en",
  "es-US": "es",
  "he-IL": "he"
};

/** Hebrew is the only right-to-left locale the dashboard ships. */
export function localeDirection(locale: AppLocale): "ltr" | "rtl" {
  return locale === "he-IL" ? "rtl" : "ltr";
}

export function normalizeLocale(locale: string | null | undefined): AppLocale {
  return SUPPORTED_LOCALES.includes(locale as AppLocale)
    ? (locale as AppLocale)
    : "en-US";
}

/**
 * Whether the catalog carries this key.
 *
 * For the vocabularies whose keys are DERIVED rather than written out at the
 * call site - a permission key, an activity action - where a miss is an
 * ordinary outcome rather than a bug: the server may send an entry this build
 * has never heard of, and the honest answer there is the English it sent
 * rather than the raw key. Everything written as a literal `t("...")` is
 * checked by the compiler and has no use for this.
 */
export function hasMessage(key: string): key is MessageKey {
  return Object.hasOwn(messageCatalog, key);
}

export function translate(
  locale: AppLocale,
  key: MessageKey,
  values: Record<string, string | number> = {}
): string {
  const entry: LocaleBundle | undefined = messageCatalog[key];
  // A key that is not in the catalog can only come from a cast, but rendering
  // the key itself beats rendering "undefined" on somebody's screen.
  if (!entry) return key;

  const source: string = entry[localeColumn[locale]] || entry.en;

  return Object.entries(values).reduce<string>(
    (message, [name, value]) => message.replaceAll(`{${name}}`, String(value)),
    source
  );
}
