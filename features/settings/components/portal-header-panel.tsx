"use client";

import type { MessageKey } from "@/lib/i18n/messages";
import { useEffect, useState } from "react";
import { ClientPortalHeader } from "@/features/events/components/client-portal-header";
import { PortalHeaderImageField } from "@/features/settings/components/branding-image-field";
import {
  PanelHeader,
  type ControlCenterSettings
} from "@/features/settings/components/settings-shared";
import {
  PORTAL_HEADER_COLOR_PRESETS,
  isPortalHeaderColor,
  resolvePortalHeaderColor
} from "@/lib/ui/portal-header-theme";
import { useAppLanguage } from "@/components/providers/app-language-provider";

type PortalHeaderSettings = ControlCenterSettings["general"]["portalHeader"];

type PortalHeaderPanelProps = {
  value: PortalHeaderSettings;
  onChange: (next: PortalHeaderSettings) => void;
  canEdit: boolean;
  /**
   * The organization's own logo, so the preview shows the background under the
   * mark that will actually sit on it. Everything else in the preview is
   * placeholder copy.
   */
  logoUrl: string | null;
  /** The stored header image as a signed URL, or null when there is none. */
  imageUrl: string | null;
  imageFile: File | null;
  isImageCleared: boolean;
  isUploading?: boolean;
  onImageSelect: (file: File | null) => void;
  onImageClearStored: () => void;
  onImageRestoreStored: () => void;
};

const styleOptions = [
  {
    style: "color" as const,
    labelKey: "settings.solidColour",
    descriptionKey: "settings.solidColourHint"
  },
  {
    style: "image" as const,
    labelKey: "settings.styleImage",
    descriptionKey: "settings.styleImageHint"
  }
] as const satisfies ReadonlyArray<{
  style: "color" | "image";
  labelKey: MessageKey;
  descriptionKey: MessageKey;
}>;

/**
 * The background of the client portal's header, set here because the portal is
 * the one screen a venue's clients ever see - and until now it was Event Core's
 * navy on every venue's portal.
 *
 * A colour and an image rather than one or the other: a venue with a brand
 * colour is served in two clicks, and a venue with a photograph of its own hall
 * has somewhere to put it. Both are kept, so switching between them is not a
 * decision an operator has to redo the upload for.
 *
 * The preview is the real portal header component, not a drawing of it. What is
 * being chosen here is legibility as much as colour, so a preview that could
 * disagree with the portal would be worse than none.
 */
export function PortalHeaderPanel({
  value,
  onChange,
  canEdit,
  logoUrl,
  imageUrl,
  imageFile,
  isImageCleared,
  isUploading = false,
  onImageSelect,
  onImageClearStored,
  onImageRestoreStored
}: PortalHeaderPanelProps) {
  const { t } = useAppLanguage();
  const committedColor = resolvePortalHeaderColor(value.color);
  // The hex box is typed into a character at a time, and "#1f4" is not a colour
  // - so it holds its own text and only hands up what parses.
  const [colorText, setColorText] = useState(committedColor);
  const [pickedImageUrl, setPickedImageUrl] = useState<string | null>(null);

  useEffect(() => setColorText(committedColor), [committedColor]);

  // The panel's own object URL for the picked file: the field below has one for
  // its thumbnail, but the preview is the point of this panel and it cannot
  // wait for a save to show what was chosen.
  useEffect(() => {
    if (!imageFile) {
      setPickedImageUrl(null);
      return;
    }

    const url = URL.createObjectURL(imageFile);
    setPickedImageUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const shownImageUrl =
    value.style === "image"
      ? (pickedImageUrl ?? (isImageCleared ? null : imageUrl))
      : null;

  const setColor = (color: string) => {
    setColorText(color);
    if (isPortalHeaderColor(color)) onChange({ ...value, color });
  };

  return (
    <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
      <PanelHeader title={t("settings.portalHeader")} icon="eye" />

      <div className="space-y-4 p-4">
        <p className="text-[10px] leading-4 text-[#6a7483]">
          {t("settings.portalHeaderHint")}
        </p>

        <div className="grid gap-2 sm:grid-cols-2">
          {styleOptions.map((option) => {
            const isSelected = value.style === option.style;

            return (
              <label
                className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 transition ${
                  isSelected
                    ? "border-[#1f4d73] bg-[#eef4fa]"
                    : "border-[#d8dde5] bg-white hover:bg-[#fbfcfd]"
                } ${canEdit ? "" : "cursor-not-allowed opacity-60"}`}
                key={option.style}
              >
                <input
                  checked={isSelected}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#1f4d73]"
                  disabled={!canEdit}
                  name="portalHeaderStyle"
                  onChange={() => onChange({ ...value, style: option.style })}
                  type="radio"
                  value={option.style}
                />
                <span className="min-w-0">
                  <span className="block text-[11px] font-black text-[#17202a]">
                    {t(option.labelKey)}
                  </span>
                  <span className="mt-0.5 block text-[10px] leading-4 text-[#6a7483]">
                    {t(option.descriptionKey)}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        {value.style === "color" ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-[10px] font-bold text-[#17202a]">
                {t("settings.colour")}
                <input
                  aria-label={t("settings.headerColour")}
                  className="mt-1 block h-9 w-16 cursor-pointer rounded-lg border border-[#c7d0dc] bg-white p-1 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!canEdit}
                  name="portalHeaderColor"
                  onChange={(changeEvent) => setColor(changeEvent.target.value)}
                  type="color"
                  value={committedColor}
                />
              </label>
              <label className="text-[10px] font-bold text-[#17202a]">
                {t("settings.hex")}
                {/* Typed as well as picked: a venue with a brand colour has the
                    hex written down somewhere, and reproducing it by eye in the
                    swatch picker is not something to ask of anyone. */}
                <input
                  aria-label={t("settings.headerColourHex")}
                  className="mt-1 block h-9 w-28 rounded-lg border border-[#c7d0dc] bg-white px-3 font-mono text-xs uppercase disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!canEdit}
                  maxLength={7}
                  name="portalHeaderColorHex"
                  onBlur={() => setColorText(committedColor)}
                  onChange={(changeEvent) => setColor(changeEvent.target.value)}
                  placeholder="#1f4d73"
                  value={colorText}
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              {PORTAL_HEADER_COLOR_PRESETS.map((preset) => (
                <button
                  aria-label={preset.label}
                  aria-pressed={
                    committedColor.toLowerCase() === preset.value.toLowerCase()
                  }
                  className={`h-8 w-8 rounded-full border-2 transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    committedColor.toLowerCase() === preset.value.toLowerCase()
                      ? "border-[#1f4d73]"
                      : "border-[#d8dde5] hover:border-[#b9c2cf]"
                  }`}
                  disabled={!canEdit}
                  key={preset.value}
                  onClick={() => setColor(preset.value)}
                  style={{ backgroundColor: preset.value }}
                  title={preset.label}
                  type="button"
                />
              ))}
            </div>
          </div>
        ) : (
          <PortalHeaderImageField
            className=""
            currentUrl={imageUrl}
            file={imageFile}
            isCleared={isImageCleared}
            isDisabled={!canEdit || isUploading}
            onClearStored={onImageClearStored}
            onRestoreStored={onImageRestoreStored}
            onSelect={onImageSelect}
          />
        )}

        <div>
          <span className="text-[10px] font-bold text-[#17202a]">{t("settings.preview")}</span>
          <div className="mt-1 overflow-hidden rounded-lg border border-[#d8dde5]">
            {/* Placeholder copy, not a real event and not this organization's
                name: the preview is here to answer "is my text readable on
                that background", and standing in a client's name to do it puts
                someone's booking on a settings screen for no gain. */}
            <ClientPortalHeader
              background={{ color: committedColor, imageUrl: shownImageUrl }}
              logoUrl={logoUrl}
              subtitle={t("settings.dateTimeHall")}
              title={t("settings.eventName")}
              venueName=""
            />
          </div>
        </div>
      </div>
    </section>
  );
}
