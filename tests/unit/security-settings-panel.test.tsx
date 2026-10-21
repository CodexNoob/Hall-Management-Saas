import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SecuritySettingsPanel } from "@/features/settings/components/security-settings-panel";

/**
 * The organization's sign-in policy.
 *
 * Both values were stored, validated and audited by `PATCH /api/settings` long
 * before anything could set them - there was no Security section, and
 * `MfaSecurityPanel` was written but rendered nowhere. These cover the two
 * things the panel has to get right rather than the markup around them.
 */
function renderPanel(
  overrides: Partial<React.ComponentProps<typeof SecuritySettingsPanel>> = {}
) {
  const onChange = vi.fn();

  render(
    <SecuritySettingsPanel
      canEdit
      onChange={onChange}
      sessionTimeoutMinutes={30}
      twoFactorRequired={false}
      {...overrides}
    />
  );

  return { onChange };
}

describe("SecuritySettingsPanel", () => {
  it("reports a change to the two-factor requirement", () => {
    const { onChange } = renderPanel();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Require two-factor authentication"
      })
    );

    expect(onChange).toHaveBeenCalledWith({ twoFactorRequired: true });
  });

  it("reports the timeout as a number, not the string the select emits", () => {
    const { onChange } = renderPanel();

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "120" } });

    expect(onChange).toHaveBeenCalledWith({ sessionTimeoutMinutes: 120 });
  });

  /**
   * `settings.update` is what the route asserts before writing either field, so
   * a reader who cannot change them must not be offered controls that will be
   * refused. The enrolment panel below this one is deliberately not gated the
   * same way: the policy is the administrator's, the second factor is yours.
   */
  it("shows the policy read-only without the edit permission", () => {
    const { onChange } = renderPanel({ canEdit: false });

    const toggle = screen.getByRole("button", {
      name: "Require two-factor authentication"
    });

    expect(toggle).toBeDisabled();
    expect(screen.getByRole("combobox")).toBeDisabled();

    fireEvent.click(toggle);
    expect(onChange).not.toHaveBeenCalled();
  });

  /**
   * The API accepts 5 to 1440 and the picker offers seven of those. A value set
   * through the API, or stored before these choices existed, has to come back -
   * a select whose `value` matches no option renders blank, and the next save
   * would quietly move the organization to whichever option sat first.
   */
  it("offers a stored timeout back even when it is not one of the choices", () => {
    renderPanel({ sessionTimeoutMinutes: 45 });

    expect(screen.getByRole("combobox")).toHaveValue("45");
    expect(screen.getByRole("option", { name: "45 minutes" })).toBeInTheDocument();
  });

  it("names the timeouts in hours rather than minutes", () => {
    renderPanel();

    expect(screen.getByRole("option", { name: "2 hours" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "12 hours" })).toBeInTheDocument();
  });

  /**
   * "Never" is an option on purpose.
   *
   * A venue that does not want an inactivity timeout should be able to SAY so.
   * "Never" in a dropdown is a decision somebody made; twelve hours is a number
   * somebody typed hoping it was enough.
   */
  it("offers Never, and words it as a duration", () => {
    renderPanel();

    // Not `common.never`, which renders in Hebrew as "never has happened" -
    // correct for a last-login column and wrong for a length of time.
    expect(screen.getByRole("option", { name: "Never" })).toBeInTheDocument();
  });

  it("reports Never as zero, which is what the API stores", () => {
    const { onChange } = renderPanel();

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "0" } });

    expect(onChange).toHaveBeenCalledWith({ sessionTimeoutMinutes: 0 });
  });

  /**
   * The choices start at an hour now. A venue that stored fifteen or thirty
   * minutes before that change must still see its own value in the list, or
   * the select shows blank and the next save silently changes their policy.
   */
  it("still offers a shorter value that was stored before the choices changed", () => {
    renderPanel({ sessionTimeoutMinutes: 15 });

    expect(screen.getByRole("combobox")).toHaveValue("15");
    expect(
      screen.getByRole("option", { name: "15 minutes" })
    ).toBeInTheDocument();
  });
});
