"use client";

import { useId, useState } from "react";

import {
  APP_LANGUAGE_CHANGE_EVENT,
  useAppLanguage
} from "@/components/providers/app-language-provider";
import { cacheAuthSession, getCachedAuthSession } from "@/lib/auth/client";
import type { AppLanguage } from "@/lib/auth/session-context";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * A person's own dashboard language.
 *
 * It lives in the profile dialog rather than in Settings because Settings is
 * gated on `settings.read`, and the people this is for do not have it: a cook
 * who reads Spanish can open the sidebar and nothing else. Putting a preference
 * about somebody's own screen behind an administrator's permission would have
 * left the two non-English languages this app ships reachable only by the
 * person least likely to need them.
 *
 * It applies on change rather than on the dialog's Save, and says so. The rest
 * of that dialog does not persist anything yet, so hanging this off its button
 * would promise something the button does not do.
 */
const OPTIONS: Array<{ value: AppLanguage; labelKey: MessageKey }> = [
  { value: "en-US", labelKey: "settings.langEnUs" },
  { value: "en-GB", labelKey: "settings.langEnGb" },
  { value: "es-US", labelKey: "settings.langEs" },
  { value: "he-IL", labelKey: "settings.langHe" }
];

/** The sentinel for "no preference", which is a real choice and not an absence. */
const FOLLOW_ORGANIZATION = "";

export function ProfileLanguageField({
  className = "block rounded-md border border-white/30 px-3 py-2 focus-within:border-white/70",
  labelClassName = "block text-xs text-white",
  selectClassName = "mt-1 w-full bg-transparent text-sm text-white outline-none [&>option]:text-[#17202a]",
  hintClassName = "mt-1 block text-[10px] text-white/60"
}: {
  className?: string;
  labelClassName?: string;
  selectClassName?: string;
  hintClassName?: string;
}) {
  const { t } = useAppLanguage();
  const fieldId = useId();
  const [value, setValue] = useState<string>(
    getCachedAuthSession()?.user.language ?? FOLLOW_ORGANIZATION
  );
  const [error, setError] = useState("");

  const apply = async (next: string) => {
    const previous = value;
    const language = next === FOLLOW_ORGANIZATION ? null : (next as AppLanguage);

    setValue(next);
    setError("");

    try {
      const response = await authenticatedFetch("/api/me/language", {
        method: "PATCH",
        body: JSON.stringify({ language })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        throw new Error(payload?.error ?? t("profile.languageSaveFailed"));
      }

      const session = getCachedAuthSession();

      if (session) {
        // The cached payload is what the next cold load renders from, so
        // without this the choice would survive the request and not the reload.
        cacheAuthSession({
          ...session,
          user: { ...session.user, language },
          language: language ?? session.language
        });
      }

      window.dispatchEvent(
        new CustomEvent(APP_LANGUAGE_CHANGE_EVENT, {
          // Falling back to the organization means asking the session what that
          // was, which the cached payload still holds.
          detail: { language: language ?? session?.language ?? "en-US" }
        })
      );
    } catch (caught) {
      setValue(previous);
      setError(
        caught instanceof Error
          ? caught.message
          : t("profile.languageSaveFailed")
      );
    }
  };

  return (
    <label className={className} htmlFor={fieldId}>
      <span className={labelClassName}>{t("profile.myLanguage")}</span>
      <select
        className={selectClassName}
        id={fieldId}
        name="profileLanguage"
        onChange={(event) => void apply(event.target.value)}
        value={value}
      >
        <option value={FOLLOW_ORGANIZATION}>
          {t("profile.followOrganization")}
        </option>
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {t(option.labelKey)}
          </option>
        ))}
      </select>
      <span className={hintClassName} role={error ? "alert" : undefined}>
        {error || t("profile.languageAppliesNow")}
      </span>
    </label>
  );
}
