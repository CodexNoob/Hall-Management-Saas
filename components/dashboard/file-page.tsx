"use client";

import { useMemo, useState } from "react";
import { DashboardTopbar } from "@/components/topbars/dashboard-topbar";
import { AddFileDialog } from "@/components/forms-and-modals/add-file-dialog";

type Folder = {
  id: string;
  name: string;
  fileCount: number;
  parentId: string | null;
};

const folders: Folder[] = [
  {
    id: "event-core-files",
    name: "Event Core Files",
    fileCount: 11,
    parentId: null,
  },
  {
    id: "billing",
    name: "Billing",
    fileCount: 1,
    parentId: "event-core-files",
  },
  {
    id: "events",
    name: "Events",
    fileCount: 7,
    parentId: "event-core-files",
  },
  {
    id: "friedman-wedding",
    name: "Friedman Wedding",
    fileCount: 5,
    parentId: "events",
  },
  {
    id: "klein-sheva-brachos",
    name: "Klein Sheva Brachos",
    fileCount: 1,
    parentId: "events",
  },
  {
    id: "weiss-bar-mitzvah",
    name: "Weiss Bar Mitzvah",
    fileCount: 1,
    parentId: "events",
  },
  {
    id: "menu",
    name: "Menu",
    fileCount: 1,
    parentId: "event-core-files",
  },
  {
    id: "pictures",
    name: "Pictures",
    fileCount: 1,
    parentId: "event-core-files",
  },
  {
    id: "videos",
    name: "Videos",
    fileCount: 1,
    parentId: "event-core-files",
  },
];

function FolderIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="M3.5 6.5h6l2 2h9v10a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2Z" />
    </svg>
  );
}

function ChevronIcon({
  expanded,
}: {
  expanded: boolean;
}) {
  return (
    <svg
      aria-hidden="true"
      className={`h-3 w-3 transition-transform ${
        expanded ? "rotate-90" : ""
      }`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    </svg>
  );
}

function SyncBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#abdccc] bg-[#effbf6] px-3 py-1 text-xs font-black text-[#146c43]">
      {children}
    </span>
  );
}

export function FilePage() {
  const [selectedFolderId, setSelectedFolderId] =
    useState("event-core-files");

  const [expandedFolderIds, setExpandedFolderIds] = useState([
    "event-core-files",
    "events",
  ]);

  const [searchQuery, setSearchQuery] = useState("");
  const [fileType, setFileType] = useState("all");
  const [isMobileFoldersOpen, setIsMobileFoldersOpen] = useState(false);
  const [isAddFileOpen, setIsAddFileOpen] = useState(false);

  const selectedFolder =
    folders.find((folder) => folder.id === selectedFolderId) ?? folders[0];

  const visibleFolders = useMemo(() => {
    return folders.filter((folder) => {
      if (folder.parentId !== selectedFolderId) {
        return false;
      }

      const matchesSearch = folder.name
        .toLowerCase()
        .includes(searchQuery.trim().toLowerCase());

      return matchesSearch && fileType === "all";
    });
  }, [selectedFolderId, searchQuery, fileType]);

  function hasChildren(folderId: string) {
    return folders.some((folder) => folder.parentId === folderId);
  }

  function toggleExpanded(folderId: string) {
    setExpandedFolderIds((current) =>
      current.includes(folderId)
        ? current.filter((id) => id !== folderId)
        : [...current, folderId],
    );
  }

  function getFolderPath(folderId:string){
    const path:string[]=[];
    let currentFolder = folders.find((folder) => folder.id === folderId);

    while (currentFolder) {
      path.unshift(currentFolder.name);

      currentFolder = currentFolder.parentId? folders.find((folder) => folder.id === currentFolder?.parentId)
      :undefined;
    }

    return path.join("/");
  }

  const selectedFolderPath = getFolderPath(selectedFolder.id);

  
  function selectFolder(folderId: string) {
    setSelectedFolderId(folderId);
    setSearchQuery("");
    setIsMobileFoldersOpen(false);
  }

  function renderFolderTree(parentId: string | null, depth = 0) {
    return folders
      .filter((folder) => folder.parentId === parentId)
      .map((folder) => {
        const isSelected = folder.id === selectedFolderId;
        const isExpanded = expandedFolderIds.includes(folder.id);
        const folderHasChildren = hasChildren(folder.id);

        return (
          <div key={folder.id}>
            <div
              className={`flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm transition ${
                isSelected
                  ? "bg-[#eef4fa] text-[#17202a] ring-1 ring-[#bfd2e2]"
                  : "text-[#17202a] hover:bg-[#f5f6f8]"
              }`}
              style={{ paddingLeft: `${8 + depth * 18}px` }}
            >
              {folderHasChildren ? (
                <button
                  aria-label={
                    isExpanded
                      ? `Collapse ${folder.name}`
                      : `Expand ${folder.name}`
                  }
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#1f4d73] hover:bg-white"
                  onClick={() => toggleExpanded(folder.id)}
                  type="button"
                >
                  <ChevronIcon expanded={isExpanded} />
                </button>
              ) : (
                <span className="h-6 w-6 shrink-0" />
              )}

              <button
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                onClick={() => selectFolder(folder.id)}
                type="button"
              >
                <FolderIcon className="h-4 w-4 shrink-0 text-[#1f4d73]" />

                <span className="min-w-0 flex-1 truncate font-semibold">
                  {folder.name}
                </span>

                <span className="shrink-0 text-xs font-semibold text-[#6a7483]">
                  {folder.fileCount}
                </span>
              </button>
            </div>

            {folderHasChildren && isExpanded
              ? renderFolderTree(folder.id, depth + 1)
              : null}
          </div>
        );
      });
  }

  const folderPanel = (
    <section className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-[#d8dde5] px-4">
        <h2 className="text-sm font-black text-[#17202a]">Folders</h2>
        <SyncBadge>Drive synced</SyncBadge>
      </div>

      <nav
        aria-label="File folders"
        className="min-h-0 flex-1 overflow-y-auto p-3"
      >
        <div className="space-y-1">{renderFolderTree(null)}</div>
      </nav>
    </section>
  );

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#f5f6f8] text-[#17202a]">
      <DashboardTopbar
        title="Files"
        subtitle="Master file explorer with practical folders only."
        actionsSlot={
            <>
            <button className="h-11 whitespace-nowrap rounded-xl border border-[#b9c2cf] bg-white px-5 text-sm font-bold text-[#17202a] shadow-sm transition hover:border-[#1f4d73]/60 hover:bg-[#eef4fa]" 
            type="button" onClick={() => {
                //Open the New Event Folder dialog here.
            }}>
                New Event Folder
            </button>

            <button className="h-11 whitespace-nowrap rounded-xl bg-[#1f4d73] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#15344f]"
            type="button"
            onClick={() => setIsAddFileOpen(true)}
            >
                Add File
            </button>
            </>
        }
      />

      <main className="min-h-0 flex-1 overflow-hidden p-3 sm:p-4">
        <div className="mx-auto grid h-full max-w-[1800px] gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="hidden min-h-0 overflow-hidden rounded-xl border border-[#d8dde5] lg:block">
            {folderPanel}
          </aside>

          {isMobileFoldersOpen ? (
            <>
              <button
                aria-label="Close folder navigation"
                className="fixed inset-0 z-60 bg-[#17202a]/40 lg:hidden"
                onClick={() => setIsMobileFoldersOpen(false)}
                type="button"
              />

              <aside className="fixed bottom-0 left-0 top-0 z-70 w-[min(88vw,340px)] overflow-hidden border-r border-[#d8dde5] bg-white shadow-2xl lg:hidden">
                <div className="flex items-center justify-between border-b border-[#d8dde5] p-3">
                  <strong className="text-sm">Folder navigation</strong>

                  <button
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#d8dde5]"
                    onClick={() => setIsMobileFoldersOpen(false)}
                    type="button"
                  >
                    ×
                  </button>
                </div>

                <div className="h-[calc(100%-64px)]">{folderPanel}</div>
              </aside>
            </>
          ) : null}

          <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-[#d8dde5] bg-white">
            <div className="flex min-h-14 items-center justify-between gap-3 border-b border-[#d8dde5] px-4">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  className="flex h-9 items-center gap-2 rounded-lg border border-[#d8dde5] px-3 text-sm font-black lg:hidden"
                  onClick={() => setIsMobileFoldersOpen(true)}
                  type="button"
                >
                  <FolderIcon className="h-4 w-4" />
                  Folders
                </button>

                <h1 className="truncate text-sm font-black">
                  {selectedFolder.name}
                </h1>
              </div>

              <div className="hidden sm:block">
                <SyncBadge>Google Drive sync ready</SyncBadge>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-b border-[#d8dde5] p-3 sm:flex-row sm:items-center">
              <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(180px,260px)_150px]">
                <label className="sr-only" htmlFor="folder-search">
                  Search this folder
                </label>

                <input
                  id="folder-search"
                  className="h-10 min-w-0 rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm outline-none transition placeholder:text-[#6a7483] focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/10"
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search this folder"
                  type="search"
                  value={searchQuery}
                />

                <label className="sr-only" htmlFor="file-type">
                  Filter by file type
                </label>

                <select
                  id="file-type"
                  className="h-10 rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm outline-none focus:border-[#1f4d73]"
                  onChange={(event) => setFileType(event.target.value)}
                  value={fileType}
                >
                  <option value="all">All types</option>
                  <option value="document">Documents</option>
                  <option value="image">Images</option>
                  <option value="video">Videos</option>
                  <option value="pdf">PDF files</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:flex">

                <button
                  className="h-10 whitespace-nowrap rounded-lg border border-[#d8dde5] bg-white px-3 text-sm font-black transition hover:bg-[#eef4fa]"
                  type="button"
                >
                  New folder
                </button>

                <button
                  className="h-10 whitespace-nowrap rounded-lg bg-[#1f4d73] px-4 text-sm font-black text-white transition hover:bg-[#15344f]"
                  onClick={() => setIsAddFileOpen(true)}
                  type="button"
                >
                  Add file
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {visibleFolders.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {visibleFolders.map((folder) => (
                    <article
                      key={folder.id}
                      className="group flex min-h-20 items-center gap-4 rounded-xl border border-[#d8dde5] bg-white p-4 transition hover:border-[#1f4d73]/50 hover:bg-[#fbfcfd] hover:shadow-sm"
                    >
                      <button
                        className="flex min-w-0 flex-1 items-center gap-4 text-left"
                        onClick={() => selectFolder(folder.id)}
                        type="button"
                      >
                        <FolderIcon className="h-6 w-6 shrink-0 text-[#6a7483]" />

                        <span className="min-w-0">
                          <span className="block truncate text-sm font-black">
                            {folder.name}
                          </span>

                          <span className="mt-1 block text-xs font-medium text-[#6a7483]">
                            {folder.fileCount}{" "}
                            {folder.fileCount === 1 ? "file" : "files"}
                          </span>
                        </span>
                      </button>

                      <button
                        aria-label={`More actions for ${folder.name}`}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#6a7483] transition hover:bg-[#eef4fa] hover:text-[#17202a]"
                        type="button"
                      >
                        <MoreIcon />
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-[#b9c2cf] px-6 text-center">
                  <FolderIcon className="h-10 w-10 text-[#6a7483]" />

                  <h2 className="mt-4 text-base font-black">
                    No folders found
                  </h2>

                  <p className="mt-2 max-w-md text-sm text-[#6a7483]">
                    Try changing the search or file-type filter.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      <AddFileDialog
        folderPath={selectedFolderPath}
        onClose={() => setIsAddFileOpen(false)}
        onSave={() => setIsAddFileOpen(false)}
        open={isAddFileOpen}
      />
    </div>
  );
}
