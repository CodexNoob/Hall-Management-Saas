import { describe, expect, it } from "vitest";

import { tabs } from "@/features/events/components/event-manager-shared";
import { hiddenEventWorkspaceTabs } from "@/lib/ui/mvp-features";

// The event workspace's counterpart to tests/e2e/mvp-hidden-routes: the routes
// are gated by a redirect a browser has to observe, but which tabs the strip
// draws is settled by one filtered array.
describe("event workspace tabs", () => {
  it("draws no tab for a module the MVP hides", () => {
    const labels = tabs.map((tab) => tab.label);

    for (const hidden of hiddenEventWorkspaceTabs) {
      expect(labels, `${hidden} is still offered`).not.toContain(hidden);
    }
  });

  it("keeps every tab the MVP ships, in order", () => {
    expect(tabs.map((tab) => tab.label)).toEqual([
      "Event details",
      "Menu",
      "Client portal",
      "Kitchen"
    ]);
  });

  it("gives every visible tab an icon the strip can render", () => {
    for (const tab of tabs) {
      expect(tab.icon, tab.label).toBeTruthy();
    }
  });
});
