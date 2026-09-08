import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  ACTIVITY_MODULES,
  activityActionKeys,
  activityActionLabel,
  activityActionModule,
  activityActions,
  activityActionsInModule,
  isActivityAction
} from "@/lib/audit/activity-actions";

const ROOT = path.resolve(__dirname, "../..");

function* walk(directory: string): Generator<string> {
  for (const entry of readdirSync(directory)) {
    const full = path.join(directory, entry);

    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      yield* walk(full);
      continue;
    }

    if (/\.tsx?$/.test(entry)) yield full;
  }
}

describe("activity catalog", () => {
  it("has no duplicate keys", () => {
    expect(new Set(activityActionKeys).size).toBe(activityActionKeys.length);
  });

  it("uses dotted lowercase keys", () => {
    for (const key of activityActionKeys) {
      expect(key, `${key} is not resource.verb`).toMatch(
        /^[a-z]+(?:_[a-z]+)*(\.[a-z]+(?:_[a-z]+)*){1,2}$/
      );
    }
  });

  it("gives every entry a label and a declared module", () => {
    for (const entry of activityActions) {
      expect(entry.label.length, `${entry.key} has no label`).toBeGreaterThan(2);
      expect(ACTIVITY_MODULES).toContain(entry.module);
    }
  });

  it("covers all six phase-1 modules", () => {
    // A module with no keys is a module nothing records, and the Activity
    // screen would offer a filter that always answers empty.
    // `name`, not `module` - the Next lint rule reserves that identifier.
    for (const name of [
      "Events",
      "Menu",
      "Kitchen",
      "Calendar",
      "Staff",
      "Settings"
    ] as const) {
      expect(
        activityActionsInModule(name).length,
        `${name} has no actions`
      ).toBeGreaterThan(0);
    }
  });

  it("files no key under Access", () => {
    // "Access" names rows that come from `authorization_audit`, which this
    // catalog does not write. A key here would mean a duplicated privilege
    // entry - the exact thing keeping the two tables separate avoids.
    expect(activityActionsInModule("Access")).toEqual([]);
  });

  it("returns an unknown action verbatim rather than hiding it", () => {
    // The legacy Billing and Clients rows say "Client Created" and "Invoice
    // Status Changed", which are already sentences a person can read. A
    // placeholder would lose real history to a naming decision made after it
    // was written.
    expect(activityActionLabel("Client Created")).toBe("Client Created");
    expect(activityActionModule("Client Created")).toBe("Other");
    expect(isActivityAction("Client Created")).toBe(false);
  });

  it("references every key from at least one write site", () => {
    // A key nothing writes is not an action - it is a filter option that always
    // answers empty. The same half of INV-5 the permission catalog enforces.
    const sources = ["app", "features", "lib"]
      .flatMap((directory) => [...walk(path.join(ROOT, directory))])
      .filter(
        (file) => !file.includes(path.join("lib", "audit", "activity-actions"))
      )
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");

    const unreferenced = activityActionKeys.filter(
      (key) => !sources.includes(`"${key}"`)
    );

    expect(
      unreferenced,
      "these keys exist in the catalog but nothing writes them"
    ).toEqual([]);
  });
});
