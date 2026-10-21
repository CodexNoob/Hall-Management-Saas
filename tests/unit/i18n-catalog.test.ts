import { describe, expect, it } from "vitest";

import { ACTIVITY_MODULES, activityActions } from "@/lib/audit/activity-actions";
import { PERMISSION_GROUPS, permissionCatalog } from "@/lib/authz/catalog";
import { SUPPORTED_LOCALES, translate, type MessageKey } from "@/lib/i18n/messages";
import { messageCatalog } from "@/lib/i18n/messages";

/**
 * The two vocabularies whose message keys are DERIVED from an identifier rather
 * than written out at a call site.
 *
 * Everywhere else, a missing translation is a compile error: `t("...")` only
 * accepts a `MessageKey`. These two build the key from a permission key or an
 * action key at runtime, which buys a catalog that cannot drift out of order -
 * and costs the compiler's check. So the check lives here instead: add a
 * permission or an action without its wording and this fails, rather than the
 * Access screen quietly rendering `authz.something.label` at a customer.
 */
describe("derived message keys", () => {
  it("has a label and a description for every permission", () => {
    const missing = permissionCatalog.flatMap((entry) =>
      [`authz.${entry.key}.label`, `authz.${entry.key}.desc`].filter(
        (key) => !(key in messageCatalog)
      )
    );

    expect(missing).toEqual([]);
  });

  it("has a name for every permission group", () => {
    const missing = PERMISSION_GROUPS.filter(
      (group) => !(`authz.group.${group}` in messageCatalog)
    );

    expect(missing).toEqual([]);
  });

  it("has a label for every activity action and module", () => {
    const missing = [
      ...activityActions.map((entry) => `activity.${entry.key}`),
      ...ACTIVITY_MODULES.map((module) => `activity.module.${module}`)
    ].filter((key) => !(key in messageCatalog));

    expect(missing).toEqual([]);
  });
});

describe("message catalog", () => {
  it("gives every key a string in every locale", () => {
    const keys = Object.keys(messageCatalog) as MessageKey[];
    const blank: string[] = [];

    for (const key of keys) {
      for (const locale of SUPPORTED_LOCALES) {
        if (!translate(locale, key).trim()) blank.push(`${locale} ${key}`);
      }
    }

    expect(blank).toEqual([]);
  });

  it("leaves no placeholder unfilled when values are supplied", () => {
    // `{name}` in one locale and `{nombre}` in another would render the brace
    // form to a customer, so every locale of a key has to use the same names.
    const mismatched: string[] = [];
    const names = (text: string) =>
      [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort().join(",");

    for (const [key, bundle] of Object.entries(messageCatalog)) {
      const expected = names(bundle.en);

      for (const column of ["es", "he"] as const) {
        if (names(bundle[column]) !== expected) {
          mismatched.push(`${key} (${column})`);
        }
      }
    }

    expect(mismatched).toEqual([]);
  });
});
