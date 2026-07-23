"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { AddFileDialog } from "@/features/files/forms/add-file-dialog";
import {
  NewEventFolderDialog,
  type NewEventFolderFormValues
} from "@/features/files/forms/new-event-folder-dialog";
import {
  NewFolderDialog,
  type NewFolderFormValues
} from "@/features/files/forms/new-folder-dialog";
import { AsyncState } from "@/components/ui/async-state";
import { useAuthenticatedMutation } from "@/features/dashboard/hooks/use-authenticated-mutation";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import { useDashboardPermission } from "@/features/dashboard/hooks/use-dashboard-permission";

type Folder = {
  id: string;
  name: string;
  fileCount: number;
  parentId: string | null;
  isPermanent: boolean;
};

type FilesResponse = {
  folders: Array<{
    id: string;
    name: string;
    parentId: string | null;
    _count: { files: number };
  }>;
  files: Array<{
    id: string;
    folderId: string | null;
    fileName: string;
    contentType: string | null;
    sizeBytes: number | null;
  }>;
};

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

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`}
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
  const canEdit = useDashboardPermission("canEditFiles");
  const filesQuery = useAuthenticatedQuery<FilesResponse>("/api/files");
  const folderMutation = useAuthenticatedMutation<
    Record<string, unknown>,
    { folder: { id: string } }
  >("/api/files");
  const updateFolderMutation = useAuthenticatedMutation<
    { id: string; name: string },
    { success: boolean }
  >("/api/files", "PATCH");
  const deleteFolderMutation = useAuthenticatedMutation<
    { id: string },
    { success: boolean }
  >("/api/files", "DELETE");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState("");

  const [expandedFolderIds, setExpandedFolderIds] = useState<string[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [fileType, setFileType] = useState("all");
  const [isMobileFoldersOpen, setIsMobileFoldersOpen] = useState(false);
  const [isAddFileOpen, setIsAddFileOpen] = useState(false);
  const [isNewEventFolderOpen, setIsNewEventFolderOpen] = useState(false);
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [openFolderMenuId, setOpenFolderMenuId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState("");

  useEffect(() => {
    if (!filesQuery.data) return;
    const nextFolders = filesQuery.data.folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      parentId: folder.parentId,
      fileCount: folder._count.files,
      isPermanent:
        folder.parentId === null && folder.name === "Event Core Files"
    }));
    setFolders(nextFolders);
    setSelectedFolderId((current) =>
      current && nextFolders.some((folder) => folder.id === current)
        ? current
        : (nextFolders[0]?.id ?? "")
    );
  }, [filesQuery.data]);

  useEffect(() => {
    if (!openFolderMenuId) return;

    function closeMenuOnOutsideClick(event: PointerEvent) {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("[data-folder-actions-menu]")
      )
        return;
      setOpenFolderMenuId(null);
    }

    function closeMenuOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenFolderMenuId(null);
    }

    window.addEventListener("pointerdown", closeMenuOnOutsideClick);
    window.addEventListener("keydown", closeMenuOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeMenuOnOutsideClick);
      window.removeEventListener("keydown", closeMenuOnEscape);
    };
  }, [openFolderMenuId]);

  const selectedFolder = folders.find(
    (folder) => folder.id === selectedFolderId
  ) ??
    folders[0] ?? {
      id: "",
      name: "Files",
      fileCount: 0,
      parentId: null,
      isPermanent: false
    };
  const eventCoreFolder = folders.find((folder) => folder.isPermanent);

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
  }, [folders, selectedFolderId, searchQuery, fileType]);

  function hasChildren(folderId: string) {
    return folders.some((folder) => folder.parentId === folderId);
  }

  function toggleExpanded(folderId: string) {
    setExpandedFolderIds((current) =>
      current.includes(folderId)
        ? current.filter((id) => id !== folderId)
        : [...current, folderId]
    );
  }

  function getFolderPath(folderId: string) {
    const path: string[] = [];
    let currentFolder = folders.find((folder) => folder.id === folderId);

    while (currentFolder) {
      path.unshift(currentFolder.name);

      currentFolder = currentFolder.parentId
        ? folders.find((folder) => folder.id === currentFolder?.parentId)
        : undefined;
    }

    return path.join("/");
  }

  const selectedFolderPath = getFolderPath(selectedFolder.id);

  function selectFolder(folderId: string) {
    setSelectedFolderId(folderId);
    setSearchQuery("");
    setIsMobileFoldersOpen(false);
  }

  async function createEventFolder(values: NewEventFolderFormValues) {
    if (!eventCoreFolder) return;

    const eventFolderName = `${values.clientName} ${values.eventType}`.trim();
    const standardFolderNames = [
      "Invoicing",
      "Hall Layout",
      "Footage",
      "Pictures",
      "Videos",
      "Documents"
    ];

    const result = await folderMutation.mutate({
      resource: "folder",
      name: eventFolderName,
      parentId: eventCoreFolder.id
    });
    await Promise.all(
      standardFolderNames.map((name) =>
        folderMutation.mutate({
          resource: "folder",
          name,
          parentId: result.folder.id
        })
      )
    );
    await filesQuery.refetch();
    setExpandedFolderIds((current) =>
      Array.from(new Set([...current, eventCoreFolder.id, result.folder.id]))
    );
    setSelectedFolderId(result.folder.id);
  }

  async function createFolder(values: NewFolderFormValues) {
    if (!eventCoreFolder) return;

    const result = await folderMutation.mutate({
      resource: "folder",
      name: values.folderName,
      parentId: eventCoreFolder.id
    });
    await filesQuery.refetch();
    setExpandedFolderIds((current) =>
      Array.from(new Set([...current, eventCoreFolder.id]))
    );
    setSelectedFolderId(result.folder.id);
  }

  function startEditingFolder(folder: Folder) {
    setEditingFolderId(folder.id);
    setEditFolderName(folder.name);
    setOpenFolderMenuId(null);
  }

  async function saveFolderName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = editFolderName.trim();
    if (!editingFolderId || !normalizedName) return;

    await updateFolderMutation.mutate({
      id: editingFolderId,
      name: normalizedName
    });
    await filesQuery.refetch();
    setEditingFolderId(null);
    setEditFolderName("");
  }

  async function deleteFolder(folderId: string) {
    await deleteFolderMutation.mutate({ id: folderId });
    await filesQuery.refetch();
    setExpandedFolderIds((expandedIds) =>
      expandedIds.filter((id) => id !== folderId)
    );
    setOpenFolderMenuId(null);
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

  if (filesQuery.isLoading || filesQuery.error) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#f5f6f8] p-4">
        <AsyncState
          error={filesQuery.error}
          isLoading={filesQuery.isLoading}
          onRetry={filesQuery.refetch}
        />
      </main>
    );
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
        compactMobileActions
        title="Files"
        subtitle="Master file explorer with practical folders only."
        actionsSlot={
          <>
            <button
              aria-label="New event folder"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-transparent text-[#17202a] transition hover:text-[#1f4d73] disabled:cursor-not-allowed disabled:opacity-50 lg:h-11 lg:w-auto lg:whitespace-nowrap lg:rounded-xl lg:border lg:border-[#b9c2cf] lg:bg-white lg:px-5 lg:text-sm lg:font-bold lg:shadow-sm lg:hover:border-[#1f4d73]/60 lg:hover:bg-[#eef4fa]"
              disabled={!canEdit}
              type="button"
              onClick={() => setIsNewEventFolderOpen(true)}
            >
              <svg
                aria-hidden="true"
                className="h-6 w-6 lg:hidden"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M3 6.5h6l2 2h10v10.5H3z" />
                <path d="M12 11v5M9.5 13.5h5" />
              </svg>
              <span className="hidden lg:inline">New Event Folder</span>
            </button>

            <button
              aria-label="Add file"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-transparent text-[#1f4d73] transition hover:text-[#15344f] disabled:cursor-not-allowed disabled:opacity-50 lg:h-11 lg:w-auto lg:whitespace-nowrap lg:rounded-xl lg:bg-[#1f4d73] lg:px-5 lg:text-sm lg:font-bold lg:text-white lg:shadow-sm lg:hover:bg-[#15344f]"
              disabled={!canEdit}
              type="button"
              onClick={() => setIsAddFileOpen(true)}
            >
              <svg
                aria-hidden="true"
                className="h-6 w-6 lg:hidden"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M6 3h8l4 4v14H6z" />
                <path d="M14 3v5h4M12 11v6M9 14h6" />
              </svg>
              <span className="hidden lg:inline">Add File</span>
            </button>
          </>
        }
      />

      <main className="min-h-0 flex-1 overflow-hidden p-2 sm:p-4">
        <div className="mx-auto grid h-full max-w-[1800px] gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="hidden min-h-0 overflow-hidden rounded-xl border border-[#d8dde5] lg:block">
            {folderPanel}
          </aside>

          {isMobileFoldersOpen ? (
            <>
              <button
                aria-label="Close folder navigation"
                className="fixed inset-0 z-60 bg-[#17202a]/35 backdrop-blur-sm lg:hidden"
                onClick={() => setIsMobileFoldersOpen(false)}
                type="button"
              />

              <aside className="fixed bottom-0 left-0 top-0 z-70 w-[min(76vw,17rem)] overflow-hidden border-r border-[#d8dde5] bg-white shadow-2xl lg:hidden">
                <div className="flex items-center justify-between border-b border-[#d8dde5] p-3">
                  <strong className="text-sm">Folder navigation</strong>

                  <button
                    aria-label="Close folder navigation"
                    className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-0 bg-transparent text-[0] leading-none text-[#17202a] hover:bg-[#eef4fa]"
                    onClick={() => setIsMobileFoldersOpen(false)}
                    type="button"
                  >
                    <svg
                      aria-hidden="true"
                      className="absolute h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M5 5 19 19M19 5 5 19"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeWidth="2.25"
                      />
                    </svg>
                    ×
                  </button>
                </div>

                <div className="h-[calc(100%-64px)]">{folderPanel}</div>
              </aside>
            </>
          ) : null}

          <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-[#d8dde5] bg-white">
            <div className="flex min-h-14 flex-wrap items-center justify-between gap-2 border-b border-[#d8dde5] px-3 py-2 sm:px-4">
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

            <div className="flex flex-col gap-3 border-b border-[#d8dde5] p-3 md:flex-row md:items-center">
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
                  <option value="pdf">PDF</option>
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                  <option value="audio">Audio</option>
                  <option value="spreadsheet">Spreadsheet</option>
                  <option value="document">Document</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex">
                <button
                  className="h-10 whitespace-nowrap rounded-lg border border-[#d8dde5] bg-white px-3 text-sm font-black transition hover:bg-[#eef4fa] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canEdit}
                  onClick={() => setIsNewFolderOpen(true)}
                  type="button"
                >
                  New folder
                </button>

                <button
                  className="h-10 whitespace-nowrap rounded-lg bg-[#1f4d73] px-4 text-sm font-black text-white transition hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canEdit}
                  onClick={() => setIsAddFileOpen(true)}
                  type="button"
                >
                  Add file
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
              {visibleFolders.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {visibleFolders.map((folder) => (
                    <article
                      key={folder.id}
                      className={`group relative flex min-h-20 items-center gap-4 rounded-xl border border-[#d8dde5] bg-white p-4 transition hover:border-[#1f4d73]/50 hover:bg-[#fbfcfd] hover:shadow-sm ${openFolderMenuId === folder.id ? "z-20" : ""}`}
                    >
                      {editingFolderId === folder.id ? (
                        <form
                          className="flex min-w-0 flex-1 items-center gap-2"
                          onSubmit={saveFolderName}
                        >
                          <FolderIcon className="h-6 w-6 shrink-0 text-[#6a7483]" />
                          <input
                            aria-label={`Folder name for ${folder.name}`}
                            autoFocus
                            className="h-9 min-w-0 flex-1 rounded-lg border border-[#8fbce3] px-2 text-sm font-bold outline-none focus:ring-2 focus:ring-[#1f4d73]/15"
                            name="folderName"
                            onChange={(event) =>
                              setEditFolderName(event.target.value)
                            }
                            value={editFolderName}
                          />
                          <button
                            className="h-9 rounded-lg bg-[#1f4d73] px-3 text-xs font-black text-white"
                            type="submit"
                          >
                            Save
                          </button>
                          <button
                            className="h-9 rounded-lg border border-[#b9c2cf] px-3 text-xs font-black"
                            onClick={() => setEditingFolderId(null)}
                            type="button"
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <>
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

                          {!folder.isPermanent ? (
                          <div className="relative" data-folder-actions-menu>
                            <button
                              aria-expanded={openFolderMenuId === folder.id}
                              aria-haspopup="menu"
                              aria-label={`More actions for ${folder.name}`}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#6a7483] transition hover:bg-[#eef4fa] hover:text-[#17202a]"
                              onClick={() =>
                                setOpenFolderMenuId((current) =>
                                  current === folder.id ? null : folder.id
                                )
                              }
                              type="button"
                            >
                              <MoreIcon />
                            </button>

                            {openFolderMenuId === folder.id ? (
                              <div
                                className="absolute right-0 top-11 z-30 w-32 overflow-hidden rounded-lg border border-[#d8dde5] bg-white p-1 shadow-xl"
                                role="menu"
                              >
                                <button
                                  className="flex h-9 w-full items-center rounded-md px-3 text-left text-sm font-bold text-[#17202a] hover:bg-[#eef4fa]"
                                  disabled={!canEdit}
                                  onClick={() => startEditingFolder(folder)}
                                  role="menuitem"
                                  type="button"
                                >
                                  Edit
                                </button>
                                <button
                                  className="flex h-9 w-full items-center rounded-md px-3 text-left text-sm font-bold text-[#c3291b] hover:bg-[#fff4f2]"
                                  disabled={!canEdit}
                                  onClick={() => deleteFolder(folder.id)}
                                  role="menuitem"
                                  type="button"
                                >
                                  Delete
                                </button>
                              </div>
                            ) : null}
                          </div>
                          ) : null}
                        </>
                      )}
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
        folderPath={
          eventCoreFolder
            ? getFolderPath(eventCoreFolder.id)
            : selectedFolderPath
        }
        onClose={() => setIsAddFileOpen(false)}
        onSave={() => setIsAddFileOpen(false)}
        open={isAddFileOpen}
      />
      <NewEventFolderDialog
        onClose={() => setIsNewEventFolderOpen(false)}
        onCreate={createEventFolder}
        open={isNewEventFolderOpen}
      />
      <NewFolderDialog
        onClose={() => setIsNewFolderOpen(false)}
        onCreate={createFolder}
        open={isNewFolderOpen}
      />
    </div>
  );
}
