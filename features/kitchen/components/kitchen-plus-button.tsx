"use client";



export function PlusButton({
  disabled,
  label,
  onClick
}: {
  disabled?: boolean;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="flex h-6 w-6 shrink-0 items-center justify-center border border-[#cbd5df] bg-[#f8fafc] text-sm font-black text-[#17202a] hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[#f8fafc]"
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      +
    </button>
  );
}
