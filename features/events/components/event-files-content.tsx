"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LineIcon } from "@/features/events/components/event-manager-shared";

export function EventFilesContent() {
  const router = useRouter();
  const [selectedFileCategory, setSelectedFileCategory] = useState("All files");

  const categories = [
    { label: "All files", count: 3 },
    { label: "Contracts", count: 1 },
    { label: "Billing / Invoices", count: 0 },
    { label: "Hall Map / Layouts", count: 1 },
    { label: "Menus", count: 1 },
    { label: "Client Files", count: 0 },
    { label: "Vendors", count: 0 },
    { label: "Kitchen", count: 0 },
    { label: "General", count: 0 }
  ];

  const files = [
    {
      title: "Signed agreement.pdf",
      category: "Contracts",
      type: "Contract",
      date: "Jun 12"
    },
    {
      title: "Grand Hall layout.pdf",
      category: "Hall Map / Layouts",
      type: "Layout",
      date: "Jun 27"
    },
    {
      title: "Client menu approval.pdf",
      category: "Menus",
      type: "Menu",
      date: "Jun 29"
    }
  ];
  const visibleFiles =
    selectedFileCategory === "All files"
      ? files
      : files.filter((file) => file.category === selectedFileCategory);

  return (
    <div className="grid min-h-107.5 min-w-0 gap-3 overflow-hidden rounded-lg border border-[#d8dde5] bg-[#fbfcfd] p-3 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="overflow-hidden rounded-lg border border-[#d8dde5] bg-white">
        {categories.map((category) => {
          const isActive = selectedFileCategory === category.label;

          return (
            <button
              key={category.label}
              className={`flex h-9.75 w-full items-center gap-2 border-b border-[#d8dde5] px-4 text-left text-sm last:border-b-0 ${
                isActive
                  ? "bg-[#eef4fa] font-black text-[#17202a]"
                  : "text-[#17202a] hover:bg-[#eef4fa]"
              }`}
              type="button"
              onClick={() => setSelectedFileCategory(category.label)}
            >
              <LineIcon
                name={category.label === "All files" ? "files" : "chevron"}
                className={`h-4 w-4 shrink-0 ${isActive ? "text-[#1f4d73]" : "text-[#17202a]"}`}
              />
              <span className="min-w-0 flex-1 truncate">{category.label}</span>
              <span className="text-xs font-normal text-[#17202a]">
                {category.count}
              </span>
            </button>
          );
        })}
      </aside>

      <section className="overflow-hidden rounded-lg border border-[#d8dde5] bg-white">
        <header className="flex items-center justify-between gap-3 border-b border-[#d8dde5] px-4 py-3">
          <div className="flex items-center gap-2">
            <LineIcon name="files" className="h-4 w-4 text-[#17202a]" />
            <h2 className="text-sm font-black text-[#17202a]">
              {selectedFileCategory}
            </h2>
          </div>
          <button
            className="inline-flex h-8 shrink-0 items-center gap-2 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white shadow-sm shadow-[#1f4d73]/20 hover:bg-[#15344f]"
            type="button"
            onClick={() => router.push("/dashboard/files")}
          >
            <LineIcon name="upload" className="h-3.5 w-3.5" />
            Upload file
          </button>
        </header>

        <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleFiles.map((file) => (
            <article
              key={file.title}
              className="flex min-h-28 flex-col justify-between rounded-lg border border-[#d8dde5] bg-white p-4"
            >
              <div>
                <h3 className="text-sm font-black text-[#17202a]">
                  {file.title}
                </h3>
                <p className="mt-1 text-xs text-[#6a7483]">{file.category}</p>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="inline-flex h-5 items-center rounded-full border border-[#b9c2cf] bg-[#eef4fa] px-2 text-[11px] font-black text-[#1f4d73]">
                  {file.type}
                </span>
                <span className="inline-flex h-5 items-center rounded-full border border-[#b9c2cf] bg-[#fbfcfd] px-2 text-[11px] font-black text-[#17202a]">
                  {file.date}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
