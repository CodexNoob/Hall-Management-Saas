"use client";

export function SeatingRow({
  current,
  label,
  maximum
}: {
  current: number;
  label: string;
  maximum: number;
}) {
  const percentage = maximum ? Math.min((current / maximum) * 100, 100) : 100;
  const complete = current >= maximum;

  return (
    <div>
      <div className="flex items-center gap-3">
        <strong className="w-14 shrink-0 text-xs">{label}</strong>
        <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[#e7edf3]">
          <div
            className={`h-full rounded-full ${
              complete ? "bg-[#178151]" : "bg-[#c0a048]"
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="w-16 shrink-0 text-right text-[10px] text-[#36465a]">
          {current}/{maximum}
        </span>
      </div>
    </div>
  );
}
