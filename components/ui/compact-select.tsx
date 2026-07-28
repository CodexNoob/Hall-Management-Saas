"use client";

import { useEffect, useId, useRef, useState } from "react";

export type CompactSelectOption = {
  label: string;
  value: string;
};

export function CompactSelect({
  disabled,
  id,
  onChange,
  options,
  placeholder,
  value
}: {
  disabled?: boolean;
  id?: string;
  onChange: (value: string) => void;
  options: CompactSelectOption[];
  placeholder?: string;
  value: string;
}) {
  const generatedId = useId();
  const buttonId = id ?? generatedId;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);
  const label = selectedOption?.label ?? placeholder ?? "Select";

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: MouseEvent | PointerEvent) {
      const target = event.target;

      if (
        target instanceof Node &&
        wrapperRef.current &&
        !wrapperRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex min-h-8 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-[#b9c2cf] bg-white px-2 py-1 text-left text-xs leading-4 text-[#17202a] disabled:cursor-not-allowed disabled:bg-[#f5f6f8] disabled:text-[#8a95a5] sm:min-h-9 sm:text-sm"
        disabled={disabled}
        id={buttonId}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="min-w-0 flex-1 break-words">{label}</span>
        <span aria-hidden="true" className="shrink-0 text-[10px]">
          ▾
        </span>
      </button>

      {open ? (
        <div
          aria-labelledby={buttonId}
          className="absolute z-50 mt-1 max-h-44 w-full overflow-y-auto rounded-lg border border-[#b9c2cf] bg-white py-1 text-xs shadow-lg shadow-[#17202a]/15 sm:text-sm"
          role="listbox"
        >
          {options.map((option) => (
            <button
              aria-selected={option.value === value}
              className={`block w-full px-2 py-1.5 text-left leading-4 break-words ${
                option.value === value
                  ? "bg-[#1f4d73] text-white"
                  : "text-[#17202a] hover:bg-[#eef4fa]"
              }`}
              key={`${buttonId}-${option.value}`}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              role="option"
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
