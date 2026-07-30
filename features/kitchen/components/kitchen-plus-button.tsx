"use client";



export function PlusButton({
  label,
  onClick
}: {
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="flex h-6 w-6 shrink-0 items-center justify-center border border-[#cbd5df] bg-[#f8fafc] text-sm font-black text-[#17202a] hover:bg-white"
      onClick={onClick}
      title={label}
      type="button"
    >
      +
    </button>
  );
}
