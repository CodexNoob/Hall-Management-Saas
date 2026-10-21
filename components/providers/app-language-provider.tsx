"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import {
  localeDirection,
  normalizeLocale,
  translate,
  type AppLocale,
  type MessageKey
} from "@/lib/i18n/messages";
import { setAmbientLocale } from "@/lib/i18n/ambient";

export const APP_LANGUAGE_CHANGE_EVENT = "event-core-language-change";

type LanguageContextValue = {
  locale: AppLocale;
  direction: "ltr" | "rtl";
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue>({
  locale: "en-US",
  direction: "ltr",
  t: (key, values) => translate("en-US", key, values)
});

export function AppLanguageProvider({
  children,
  initialLocale
}: {
  children: ReactNode;
  initialLocale?: string;
}) {
  const [locale, setLocale] = useState(() => normalizeLocale(initialLocale));
  const direction = localeDirection(locale);

  // The dashboard layout mounts this provider before the session has loaded, so
  // the first `initialLocale` is undefined and the real one arrives a render
  // later. `useState`'s initialiser only runs once, which would leave the whole
  // app in English for the rest of the session.
  useEffect(() => {
    if (initialLocale) setLocale(normalizeLocale(initialLocale));
  }, [initialLocale]);

  useEffect(() => {
    const applyLanguage = (event: Event) => {
      setLocale(
        normalizeLocale((event as CustomEvent<{ language?: string }>).detail?.language)
      );
    };

    window.addEventListener(APP_LANGUAGE_CHANGE_EVENT, applyLanguage);
    return () =>
      window.removeEventListener(APP_LANGUAGE_CHANGE_EVENT, applyLanguage);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
    // Published for the client modules that cannot hold a hook - see
    // lib/i18n/ambient.ts for which ones and why.
    setAmbientLocale(locale);
  }, [direction, locale]);

  const t = useCallback(
    (key: MessageKey, values?: Record<string, string | number>) =>
      translate(locale, key, values),
    [locale]
  );
  const value = useMemo(
    () => ({ locale, direction, t }),
    [direction, locale, t]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useAppLanguage() {
  return useContext(LanguageContext);
}
