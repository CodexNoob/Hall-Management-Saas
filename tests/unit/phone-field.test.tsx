import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CountryCode } from "libphonenumber-js";

import { PhoneField } from "@/components/ui/phone-field";

function Harness({
  initialCountry = "US" as CountryCode,
  onValidChange,
  required = false,
  showCountry
}: {
  initialCountry?: CountryCode;
  onValidChange?: (value: string | null) => void;
  required?: boolean;
  showCountry?: boolean;
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
        showCountry={showCountry}
        value={value}
      />
    </>
  );
}

describe("PhoneField", () => {
  const onValidChange = vi.fn();

  beforeEach(() => vi.clearAllMocks());

  const input = () => screen.getByLabelText("Phone number");

  it("refuses to accept letters at all, and says that it did", async () => {
    // Filtering is only acceptable because it is announced. Dropping the
    // characters in silence is the type="number" failure all over again: the
    // field looks broken and a screen reader is told nothing.
    render(<Harness onValidChange={onValidChange} />);

    fireEvent.change(input(), { target: { value: "212abc555" } });

    expect(input()).toHaveValue("(212) 555");
    expect(await screen.findByText(/can only contain digits/i)).toBeInTheDocument();
  });

  it("keeps the live region mounted so the first message is announced", async () => {
    // Assistive tech only reports changes to regions it already knows about. A
    // <p aria-live> that appears with its text already in place is not spoken.
    const { container } = render(<Harness />);

    const region = container.querySelector('[aria-live="polite"]');
    expect(region).toBeInTheDocument();
    expect(region).toBeEmptyDOMElement();

    fireEvent.change(input(), { target: { value: "21a" } });

    await screen.findByText(/can only contain digits/i);
    expect(container.querySelector('[aria-live="polite"]')).toBe(region);
    expect(input().getAttribute("aria-describedby")).toContain(region!.id);
  });

  it("announces again on a second rejected keystroke", async () => {
    // A live region is silent when re-given the same string, so the text has
    // to be cleared between messages or only the first letter is ever spoken.
    const { container } = render(<Harness />);
    const region = () => container.querySelector('[aria-live="polite"]');

    fireEvent.change(input(), { target: { value: "21a" } });
    await screen.findByText(/can only contain digits/i);

    fireEvent.change(input(), { target: { value: "21b" } });
    // Cleared synchronously, which is what makes the re-announcement happen.
    expect(region()).toBeEmptyDOMElement();

    await screen.findByText(/can only contain digits/i);
  });

  it("leaves an all-letters entry empty rather than part-filled", async () => {
    render(<Harness onValidChange={onValidChange} />);

    fireEvent.change(input(), { target: { value: "abcdefghij" } });

    expect(input()).toHaveValue("");
    expect(await screen.findByText(/can only contain digits/i)).toBeInTheDocument();
  });

  it("keeps the number out of a pasted label instead of rejecting the paste", () => {
    // People paste "Tel: +63 917 123 4567" out of an email signature. Refusing
    // the whole paste would be worse than useless.
    render(<Harness onValidChange={onValidChange} />);

    fireEvent.change(input(), {
      target: { value: "Tel: +63 917 123 4567" }
    });

    expect(onValidChange).toHaveBeenLastCalledWith("+639171234567");
  });

  it("never loses digits to the formatter", () => {
    // AsYouType returns "" for input it does not expect - a single leading
    // space ahead of a "+" is enough. The field must keep the number even when
    // it cannot pretty-print it.
    render(<Harness onValidChange={onValidChange} />);

    fireEvent.change(input(), { target: { value: " +63 917 123 4567" } });

    expect(input()).not.toHaveValue("");
    expect(onValidChange).toHaveBeenLastCalledWith("+639171234567");
  });

  it("clears the notice once the next keystroke is clean", async () => {
    render(<Harness />);

    fireEvent.change(input(), { target: { value: "21a" } });
    await screen.findByText(/can only contain digits/i);

    fireEvent.change(input(), { target: { value: "212" } });

    expect(screen.queryByText(/can only contain digits/i)).toBeNull();
  });

  it("accepts digits that are not ASCII", () => {
    // A CJK keyboard emits full-width digits and an Arabic one emits ٠-٩.
    // libphonenumber normalizes both, so filtering them out would blank the
    // field for someone who typed nothing but digits.
    render(<Harness onValidChange={onValidChange} />);

    fireEvent.change(input(), { target: { value: "２１２５５５０１４２" } });

    expect(input()).not.toHaveValue("");
    expect(onValidChange).toHaveBeenLastCalledWith("+12125550142");
    expect(screen.queryByText(/can only contain digits/i)).toBeNull();
  });

  it("accepts Arabic-Indic digits under the country that owns them", () => {
    render(
      <Harness initialCountry={"PH" as CountryCode} onValidChange={onValidChange} />
    );

    fireEvent.change(input(), { target: { value: "٠٩١٧١٢٣٤٥٦٧" } });

    expect(onValidChange).toHaveBeenLastCalledWith("+639171234567");
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

  it("shows the country as a code and dialling code, not its full name", () => {
    // A native select is as wide as its widest option - "United States Minor
    // Outlying Islands (+1)" here - so the control has to be width-capped, and
    // capping it used to clip the selected country to "Philippines (+6". The
    // closed control shows a short, near-constant-width label instead, while
    // the menu keeps every full name.
    render(<Harness initialCountry={"PH" as CountryCode} />);

    expect(screen.getByText("PH")).toBeInTheDocument();
    expect(screen.getByText("+63")).toBeInTheDocument();

    // The full name survives, but only in the menu - one occurrence, and it is
    // an <option>. Still a real select underneath, with its label and value.
    const named = screen.getAllByText("Philippines (+63)");
    expect(named).toHaveLength(1);
    expect(named[0].tagName).toBe("OPTION");
    expect(screen.getByLabelText("Country")).toHaveValue("PH");
  });

  it("relabels the country trigger when the country changes", () => {
    render(<Harness initialCountry={"PH" as CountryCode} />);

    fireEvent.change(screen.getByLabelText("Country"), {
      target: { value: "GB" }
    });

    expect(screen.getByText("GB")).toBeInTheDocument();
    expect(screen.getByText("+44")).toBeInTheDocument();
    expect(screen.queryByText("+63")).toBeNull();
  });

  it("drops the country control entirely when it is not shown", () => {
    // Hidden, not merely invisible. A select left in the tree would still take
    // a tab stop and still answer to autofill, which is a control someone can
    // reach and change without ever being able to see what it says.
    render(<Harness initialCountry={"PH" as CountryCode} showCountry={false} />);

    expect(screen.queryByLabelText("Country")).toBeNull();
    expect(screen.queryByText("PH")).toBeNull();
    expect(screen.queryByText("+63")).toBeNull();
    expect(input()).toBeInTheDocument();
  });

  it("still validates against the host's country with the picker hidden", () => {
    // The picker is what makes the country visible, not what makes it apply.
    // Ten digits stays an impossible UK number with nothing on screen saying so.
    render(
      <Harness
        initialCountry={"GB" as CountryCode}
        onValidChange={onValidChange}
        showCountry={false}
      />
    );

    fireEvent.change(input(), { target: { value: "2125550142" } });
    fireEvent.blur(input());

    expect(onValidChange).not.toHaveBeenCalledWith(
      expect.stringContaining("+1")
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "not a valid United Kingdom phone number"
    );
  });

  it("takes an overseas number by its own + when the picker is hidden", () => {
    // The only way left to enter a number from elsewhere, so it has to work:
    // a leading "+" is read ahead of the country the host is holding.
    render(
      <Harness
        initialCountry={"US" as CountryCode}
        onValidChange={onValidChange}
        showCountry={false}
      />
    );

    fireEvent.change(input(), { target: { value: "+63 917 123 4567" } });

    expect(onValidChange).toHaveBeenLastCalledWith("+639171234567");
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
