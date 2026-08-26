import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { PictureField } from "@/features/menu/components/picture-field";

/**
 * The library item's picture control: what it shows, and what it refuses.
 *
 * The field is controlled - the dialog owns the pick and the "clear the stored
 * one" flag - so each case renders it in the state the dialog would put it in
 * and checks what comes back out.
 *
 * jsdom has no object URLs, so `createObjectURL` is stubbed to a fixed string;
 * what matters here is that the preview points at the file rather than at
 * whatever is stored.
 */

const createObjectURL = vi.fn(() => "blob:preview");
const revokeObjectURL = vi.fn();

beforeAll(() => {
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
});

beforeEach(() => {
  vi.clearAllMocks();
});

function jpeg(name = "brisket.jpg", size = 2048) {
  const file = new File(["x"], name, { type: "image/jpeg" });
  // Rather than allocating megabytes for the size check below.
  Object.defineProperty(file, "size", { value: size });

  return file;
}

function renderField(overrides: Partial<React.ComponentProps<typeof PictureField>> = {}) {
  const props = {
    file: null,
    isCleared: false,
    onSelect: vi.fn(),
    onClearStored: vi.fn(),
    onRestoreStored: vi.fn(),
    ...overrides
  };

  return { ...render(<PictureField {...props} />), props };
}

describe("PictureField", () => {
  it("draws the stored picture rather than an empty file input", () => {
    const { container } = renderField({
      currentPictureUrl: "https://storage.test/menu/brisket.jpg?token=abc"
    });

    expect(screen.getByText("Current picture")).toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://storage.test/menu/brisket.jpg?token=abc"
    );
  });

  it("previews the chosen file, before anything has been uploaded", () => {
    const file = jpeg();
    const { container } = renderField({ file });

    expect(createObjectURL).toHaveBeenCalledWith(file);
    expect(container.querySelector("img")).toHaveAttribute("src", "blob:preview");
    expect(screen.getByText("brisket.jpg")).toBeInTheDocument();
  });

  it("keeps a file the upload would reject out of the form", () => {
    const { props } = renderField();

    fireEvent.change(screen.getByLabelText("Picture"), {
      target: { files: [jpeg("huge.jpg", 6 * 1024 * 1024)] }
    });

    expect(props.onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Pictures must be 5 MB or smaller."
    );
  });

  it("hands up a file that passes", () => {
    const { props } = renderField();
    const file = jpeg();

    fireEvent.change(screen.getByLabelText("Picture"), {
      target: { files: [file] }
    });

    expect(props.onSelect).toHaveBeenCalledWith(file);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // The two meanings of Remove, which is the whole reason it is one button:
  // whichever picture is on screen is the one it takes away.
  it("discards the pick and falls back to the stored picture", () => {
    const { props } = renderField({
      currentPictureUrl: "https://storage.test/menu/brisket.jpg?token=abc",
      file: jpeg()
    });

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(props.onSelect).toHaveBeenCalledWith(null);
    expect(props.onClearStored).not.toHaveBeenCalled();
  });

  it("marks the stored picture for removal, and offers an undo until the save", () => {
    const { props, rerender } = renderField({
      currentPictureUrl: "https://storage.test/menu/brisket.jpg?token=abc"
    });

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(props.onClearStored).toHaveBeenCalled();

    rerender(
      <PictureField
        currentPictureUrl="https://storage.test/menu/brisket.jpg?token=abc"
        file={null}
        isCleared
        onClearStored={props.onClearStored}
        onRestoreStored={props.onRestoreStored}
        onSelect={props.onSelect}
      />
    );

    expect(
      screen.getByText(/will be removed when you save/)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(props.onRestoreStored).toHaveBeenCalled();
  });
});
