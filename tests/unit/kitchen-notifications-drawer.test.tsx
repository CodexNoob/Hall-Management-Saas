import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KitchenNotificationsDrawer } from "@/features/kitchen/components/kitchen-notifications-drawer";

describe("KitchenNotificationsDrawer", () => {
  it("shows an acknowledgment failure inside the drawer", () => {
    render(
      <KitchenNotificationsDrawer
        acknowledgmentError="Could not acknowledge notification."
        notifications={[]}
        onAcknowledge={vi.fn()}
        onClose={vi.fn()}
        open
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not acknowledge notification."
    );
  });
});
