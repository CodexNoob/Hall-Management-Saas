import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CountryCode } from "libphonenumber-js";

import { PhoneField } from "@/components/ui/phone-field";

function Harness({
  initialCountry = "US" as CountryCode,
  onValidChange,
  required = false
}: {
  initialCountry?: CountryCode;
  onValidChange?: (value: string | null) => void;
  required?: boolean;
}) {
  const [country, setCountry] = useState<CountryCode>(initialCountry);
  const [value, setValue] = useState("");

  return (
    <>
      {/* The field takes its name from the page's own label, exactly as it does
          in create-organization-page.tsx. */}
      <label htmlFor="phone">Phone number</label>
      <PhoneField
        country={country}
        id="phone"
        onChange={setValue}
        onCountryChange={setCountry}
        onValidChange={onValidChange}
        required={required}
        value={value}
      />
    </>
  );
}

describe("PhoneField", () => {
  const onValidChange = vi.fn();

  beforeEach(() => vi.clearAllMocks());

  const input = () => screen.getByLabelText("Phone number");

  it("keeps text it cannot format instead of silently eating it", () => {
    // libphonenumber's AsYouType drops every character it does not recognise:
    // "212abc555" comes back as "(212)". Formatting blindly would leave the
    // user staring at a field that quietly discarded their typo - the exact
    // failure that type="number" inputs had.
    render(<Harness onValidChange={onValidChange} />);

    fireEvent.change(input(), { target: { value: "212abc555" } });

    expect(input()).toHaveValue("212abc555");
    expect(onValidChange).not.toHaveBeenCalled();
  });

  it("reports letters rather than treating the field as empty", () => {
    render(<Harness onValidChange={onValidChange} />);

    fireEvent.change(input(), { target: { value: "abcdefghij" } });
    fireEvent.blur(input());

    expect(input()).toHaveValue("abcdefghij");
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("formats as you type once the text is only phone characters", () => {
    render(<Harness />);

    fireEvent.change(input(), { target: { value: "2125550142" } });

    expect(input()).toHaveValue("(212) 555-0142");
  });

  it("emits E.164 when the number becomes valid", () => {
    render(<Harness onValidChange={onValidChange} />);

    fireEvent.change(input(), { target: { value: "2125550142" } });

    expect(onValidChange).toHaveBeenLastCalledWith("+12125550142");
  });

  it("judges the same digits differently per country", () => {
    // Ten digits is a real US number and an impossible UK one. If the picker
    // were cosmetic, these two would behave identically.
    render(<Harness onValidChange={onValidChange} />);

    fireEvent.change(input(), { target: { value: "2125550142" } });
    expect(onValidChange).toHaveBeenLastCalledWith("+12125550142");

    onValidChange.mockClear();
    fireEvent.change(screen.getByLabelText("Country"), {
      target: { value: "GB" }
    });

    expect(onValidChange).not.toHaveBeenCalledWith(
      expect.stringContaining("+44")
    );
    fireEvent.blur(input());
    expect(screen.getByRole("alert")).toHaveTextContent(
      "not a valid United Kingdom phone number"
    );
  });

  it("accepts a national number under the country that owns it", () => {
    render(<Harness initialCountry={"PH" as CountryCode} onValidChange={onValidChange} />);

    fireEvent.change(input(), { target: { value: "9171234567" } });

    expect(onValidChange).toHaveBeenLastCalledWith("+639171234567");
  });

  it("stays quiet until the field has been left", () => {
    render(<Harness />);

    fireEvent.change(input(), { target: { value: "21" } });
    expect(screen.queryByRole("alert")).toBeNull();

    fireEvent.blur(input());
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("reports an empty field as null, and only complains when required", () => {
    const { unmount } = render(<Harness onValidChange={onValidChange} />);

    fireEvent.change(input(), { target: { value: "2125550142" } });
    fireEvent.change(input(), { target: { value: "" } });
    fireEvent.blur(input());

    expect(onValidChange).toHaveBeenLastCalledWith(null);
    expect(screen.queryByRole("alert")).toBeNull();
    unmount();

    render(<Harness required />);
    fireEvent.blur(input());
    expect(screen.getByRole("alert")).toHaveTextContent("is required");
  });

  it("describes its error for screen readers", () => {
    render(<Harness />);

    fireEvent.change(input(), { target: { value: "123" } });
    fireEvent.blur(input());

    expect(input()).toHaveAttribute("aria-invalid", "true");
    expect(input()).toHaveAttribute(
      "aria-describedby",
      screen.getByRole("alert").id
    );
  });
});
