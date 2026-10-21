"use client";

import { type Dispatch, type SetStateAction } from "react";
import { CompactSelect } from "@/components/ui/compact-select";
import { type HallMapsResponse } from "@/features/hall-room-map/components/hall-map-shared";
import { useAppLanguage } from "@/components/providers/app-language-provider";

type Hall = HallMapsResponse["halls"][number];

export function HallMapDialog({
  halls,
  isCreating,
  isUpdating,
  mapHallId,
  mapName,
  mode,
  onSubmit,
  open,
  setMapHallId,
  setMapName,
  setOpen
}: {
  halls: Hall[];
  isCreating: boolean;
  isUpdating: boolean;
  mapHallId: string;
  mapName: string;
  mode: "create" | "rename";
  onSubmit: () => void | Promise<void>;
  open: boolean;
  setMapHallId: Dispatch<SetStateAction<string>>;
  setMapName: Dispatch<SetStateAction<string>>;
  setOpen: Dispatch<SetStateAction<boolean>>;
}) {
  const { t } = useAppLanguage();
  const mapDialogMode = mode;
  const setIsMapDialogOpen = setOpen;
  const submitMapDialog = onSubmit;
  return open ? (
    <div
      className="pointer-events-auto fixed inset-0 z-100 flex items-center justify-center bg-[#07162d]/50 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          setIsMapDialogOpen(false);
        }
      }}
      role="presentation"
    >
      <section
        aria-labelledby="hall-map-dialog-title"
        aria-modal="true"
        className="w-full max-w-md overflow-visible rounded-2xl border border-[#d8dde5] bg-white shadow-2xl"
        role="dialog"
      >
        <header className="flex items-center gap-3 border-b border-[#d8dde5] px-5 py-4">
          <h2
            className="min-w-0 flex-1 text-lg font-black"
            id="hall-map-dialog-title"
          >
            {mapDialogMode === "create"
              ? t("hallMap.newMap")
              : t("hallMap.renameMap")}
          </h2>
          <button
            aria-label={t("common.close")}
            className="flex h-9 w-9 items-center justify-center rounded-md text-2xl leading-none hover:bg-[#eef4fa]"
            onClick={() => setIsMapDialogOpen(false)}
            type="button"
          >
            &times;
          </button>
        </header>
        <form
          className="p-5"
          onSubmit={(event) => {
            event.preventDefault();
            submitMapDialog();
          }}
        >
          <label
            className="text-xs font-black uppercase tracking-wide text-[#59677c]"
            htmlFor="hall-map-name"
          >
            {t("hallMap.mapName")}
          </label>
          <input
            autoFocus
            className="mt-2 h-11 w-full rounded-xl border border-[#b9c2cf] px-3 text-sm outline-none focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15"
            id="hall-map-name"
            onChange={(event) => setMapName(event.target.value)}
            placeholder={t("hallMap.mapNameExample")}
            value={mapName}
          />
          <label
            className="mt-4 block text-xs font-black uppercase tracking-wide text-[#59677c]"
            htmlFor="hall-map-assignment"
          >
            {t("hallMap.assignToHall")}
          </label>
          <CompactSelect
            id="hall-map-assignment"
            onChange={(value) => setMapHallId(value)}
            options={[
              { label: t("hallMap.selectHall"), value: "" },
              ...(halls ?? []).map((hall) => ({
                label: hall.name,
                value: hall.id
              }))
            ]}
            value={mapHallId}
          />
          <div className="mt-5 flex justify-end gap-2">
            <button
              className="h-10 rounded-xl border border-[#b9c2cf] bg-white px-4 text-sm font-bold hover:bg-[#eef4fa]"
              onClick={() => setIsMapDialogOpen(false)}
              type="button"
            >
              {t("common.cancel")}
            </button>
            <button
              className="h-10 rounded-xl bg-[#1f4d73] px-4 text-sm font-bold text-white hover:bg-[#15344f] disabled:opacity-50"
              disabled={
                !mapName.trim() || !mapHallId || isCreating || isUpdating
              }
              type="submit"
            >
              {mapDialogMode === "create" ? t("hallMap.createMap") : t("hallMap.saveName")}
            </button>
          </div>
        </form>
      </section>
    </div>
  ) : null;
}
