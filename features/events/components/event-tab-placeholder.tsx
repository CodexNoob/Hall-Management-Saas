"use client";



export function EventTabPlaceholder({ label }: { label: string }) {
  return (
    <section className="rounded-lg border border-[#d8dde5] bg-white p-6">
      <h2 className="text-sm font-black text-[#17202a]">{label}</h2>
      <p className="mt-2 text-sm text-[#6a7483]">
        This event section is ready for the next workspace panel.
      </p>
    </section>
  );
}
