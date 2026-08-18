import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HallMapLibraryPanel } from "@/features/hall-room-map/components/hall-map-library-panel";

const baseProps = {
  halls: [{ id: "hall-1", name: "Main Hall" }],
  hallMaps: [],
  hasFloorPlan: false,
  hasSelectedHall: true,
  hasSelectedMap: true,
  onAddObject: vi.fn(),
  onAddShapeLibraryObject: vi.fn(),
  onAddTableRows: vi.fn(),
  onCopyMapToHall: vi.fn(),
  onCreateShapeLibraryItem: vi.fn(),
  onRemoveFloorPlan: vi.fn(),
  onUploadFloorPlan: vi.fn(),
  onDeleteMap: vi.fn(),
  onDeleteSelectedObject: vi.fn(),
  onDuplicateSelectedObject: vi.fn(),
  onLoadPreset: vi.fn(),
  onNewMap: vi.fn(),
  onRenameMap: vi.fn(),
  onSavePreset: vi.fn(),
  onSelectHall: vi.fn(),
  onSelectMap: vi.fn(),
  selectedHallId: "hall-1",
  selectedHallMaps: [],
  selectedMapId: "",
  selectedObjectExists: false,
  shapeLibrary: []
};

describe("HallMapLibraryPanel custom tables", () => {
  it("opens the new table modal and saves capacity with the table shape", async () => {
    const onCreateShapeLibraryItem = vi.fn().mockResolvedValue(undefined);

    render(
      <HallMapLibraryPanel
        {...baseProps}
        onCreateShapeLibraryItem={onCreateShapeLibraryItem}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "New table" }));

    expect(
      screen.getByRole("dialog", { name: "New table" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Capacity / seats")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Table name"), {
      target: { value: "60 inch round" }
    });
    fireEvent.change(screen.getByLabelText("Real size"), {
      target: { value: "60" }
    });
    fireEvent.change(screen.getByLabelText("Capacity / seats"), {
      target: { value: "10" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save table" }));

    await waitFor(() =>
      expect(onCreateShapeLibraryItem).toHaveBeenCalledWith({
        height: 60,
        name: "60 inch round",
        seats: 10,
        shapeType: "round-table",
        width: 60
      })
    );
  });
});
