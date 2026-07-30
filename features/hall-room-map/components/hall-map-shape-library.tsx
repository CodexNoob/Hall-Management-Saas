"use client";

import { type ShapeType } from "@/features/hall-room-map/components/hall-map-shared";

export function ShapePreview({ type }: { type: ShapeType }) {
  if (type === "divider") {
    return <span className="h-1 w-6 bg-[#36516b]" />;
  }

  const isCircle =
    type === "round-table" || type === "kids-table" || type === "circle";

  return (
    <span
      className={`h-5 w-5 border-2 border-[#36516b] bg-[#f7fbff] ${
        isCircle ? "rounded-full" : ""
      }`}
    />
  );
}

export function ShapeButton({
  disabled,
  label,
  onClick,
  type
}: {
  disabled?: boolean;
  label: string;
  onClick: () => void;
  type: ShapeType;
}) {
  return (
    <button
      className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border border-[#d1dae5] bg-white px-1.5 text-[10px] font-black whitespace-nowrap transition enabled:hover:border-[#1f4d73] enabled:hover:bg-[#eef6fc] disabled:cursor-not-allowed disabled:opacity-45"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <ShapePreview type={type} />
      {label}
    </button>
  );
}
