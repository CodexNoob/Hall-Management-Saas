"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { DashboardPageState } from "@/components/layout/dashboard-page-state";
import {
  AddFileDialog,
  type AddFileFormValues
} from "@/features/files/forms/add-file-dialog";
import {
  EVENT_FOLDER_SECTIONS,
  eventFolderName,
  resolveDestinationFolder
} from "@/features/files/lib/event-folders";
import {
  buildStoredFileName,
  formatFileSize,
  openStoredFile,
  uploadOrganizationFile
} from "@/features/files/lib/upload-file";
import {
  NewEventFolderDialog,
  type NewEventFolderFormValues
} from "@/features/files/forms/new-event-folder-dialog";
import {
  NewFolderDialog,
  type NewFolderFormValues
} from "@/features/files/forms/new-folder-dialog";
import { useAuthenticatedMutation } from "@/features/dashboard/hooks/use-authenticated-mutation";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import { useDashboardPageSearch } from "@/features/dashboard/hooks/use-dashboard-page-search";
import { useDashboardPermission } from "@/features/dashboard/hooks/use-dashboard-permission";

import {
  ChevronIcon,
  FileIcon,
  fileTypeGroup,
  FolderIcon,
  MoreIcon,
  DriveSyncBadge,
  type DriveStatusResponse,
  type FilesResponse,
  type Folder
} from "@/features/files/components/file-shared";
export function FilePage() {
  const canEdit = useDashboardPermission("canEditFiles");
  const filesQuery = useAuthenticatedQuery<FilesResponse>("/api/files");
  // Reports whether this deployment actually has Drive credentials, so the
  // badge describes reality rather than asserting a capability.
  const driveQuery = useAuthenticatedQuery<DriveStatusResponse>(
    "/api/integrations/google-drive"
  );
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
  const fileMutation = useAuthenticatedMutation<
    Record<string, unknown>,
    { file: { id: string } }
  >("/api/files");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [openFileError, setOpenFileError] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState("");

  const [expandedFolderIds, setExpandedFolderIds] = useState<string[]>([]);

  const [searchQuery, setSearchQuery] = useDashboardPageSearch("Files");
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

  /**
   * The documents in the open folder. Nothing rendered these before, so an
   * upload only moved a folder's counter and the file itself was unreachable.
   */
  const visibleFiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return (filesQuery.data?.files ?? []).filter((file) => {
      if (file.folderId !== (selectedFolderId || null)) return false;
      if (query && !file.fileName.toLowerCase().includes(query)) return false;
      if (fileType === "all") return true;

      return fileTypeGroup(file.contentType) === fileType;
    });
  }, [filesQuery.data, selectedFolderId, searchQuery, fileType]);

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


  function selectFolder(folderId: string) {
    setSelectedFolderId(folderId);
    setSearchQuery("");
    setIsMobileFoldersOpen(false);
  }

  async function createEventFolder(values: NewEventFolderFormValues) {
    if (!eventCoreFolder) return;

    // Same name and same subfolders the event's own Files tab creates, so a
    // booking filed from either screen lands in one folder rather than two.
    const result = await folderMutation.mutate({
      resource: "folder",
      name: eventFolderName(values.clientName, values.eventType),
      parentId: eventCoreFolder.id
    });
    await Promise.all(
      EVENT_FOLDER_SECTIONS.map((name) =>
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

  /**
   * Two steps that both have to succeed: the browser writes the object to
   * Supabase Storage, then the API records the row that makes it findable.
   * The dialog stays open until both are done, so a failure leaves the chosen
   * file in place to retry rather than closing over a silent loss.
   */
  async function uploadFile(values: AddFileFormValues) {
    const bucket = filesQuery.data?.bucket;
    if (!bucket) {
      setUploadError("Storage is unavailable. Reload the page and try again.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      // The chosen booking decides the parent folder, so a file added here
      // shows on that event's Files tab as well - the direction that was
      // missing while this page could only file into the open folder.
      const chosenEvent = (filesQuery.data?.events ?? []).find(
        (option) => option.id === values.eventId
      );
      const folderId = await resolveDestinationFolder({
        folders: filesQuery.data?.folders ?? [],
        createFolder: folderMutation.mutate,
        sectionName: values.sectionName,
        event: chosenEvent
          ? {
              id: chosenEvent.id,
              clientName: chosenEvent.clientName,
              eventType: chosenEvent.eventType ?? ""
            }
          : undefined
      });

      const storagePath = await uploadOrganizationFile(values.file, bucket);
      await fileMutation.mutate({
        resource: "file",
        bucket,
        storagePath,
        // The typed name wins, but keep the original extension so the file
        // still opens in the right application once downloaded.
        fileName: buildStoredFileName(values.fileName, values.file.name),
        contentType: values.file.type,
        sizeBytes: values.file.size,
        folderId,
        eventId: values.eventId || undefined
      });

      await filesQuery.refetch();
      setIsAddFileOpen(false);
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : "That file could not be uploaded."
      );
    } finally {
      setIsUploading(false);
    }
  }

  /**
   * The bucket is private, so the API signs a short-lived URL rather than the
   * browser holding a permanent link to the object.
   */
  async function openFile(fileId: string) {
    setOpenFileError(null);
    try {
      await openStoredFile(fileId);
    } catch (error) {
      setOpenFileError(
        error instanceof Error ? error.message : "That file could not be opened."
      );
    }
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
      <DashboardPageState
        error={filesQuery.error}
        isLoading={filesQuery.isLoading}
        onRetry={filesQuery.refetch}
        subtitle="Master file explorer with practical folders only."
        title="Files"
      />
    );
  }

  const folderPanel = (
    <section className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-[#d8dde5] px-4">
        <h2 className="text-sm font-black text-[#17202a]">Folders</h2>
        <DriveSyncBadge status={driveQuery.data} />
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
              disabled={!canEdit || !filesQuery.data?.bucket}
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
              disabled={!canEdit || !filesQuery.data?.bucket}
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
                    className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-0 bg-transparent leading-none text-[#17202a] hover:bg-[#eef4fa]"
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
                <DriveSyncBadge status={driveQuery.data} />
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
                  disabled={!canEdit || !filesQuery.data?.bucket}
                  onClick={() => setIsNewFolderOpen(true)}
                  type="button"
                >
                  New folder
                </button>

                <button
                  className="h-10 whitespace-nowrap rounded-lg bg-[#1f4d73] px-4 text-sm font-black text-white transition hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canEdit || !filesQuery.data?.bucket}
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
                                    disabled={!canEdit || !filesQuery.data?.bucket}
                                    onClick={() => startEditingFolder(folder)}
                                    role="menuitem"
                                    type="button"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="flex h-9 w-full items-center rounded-md px-3 text-left text-sm font-bold text-[#c3291b] hover:bg-[#fff4f2]"
                                    disabled={!canEdit || !filesQuery.data?.bucket}
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
                visibleFiles.length === 0 ? (
                  <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-[#b9c2cf] px-6 text-center">
                    <FolderIcon className="h-10 w-10 text-[#6a7483]" />

                    <h2 className="mt-4 text-base font-black">
                      Nothing in this folder
                    </h2>

                    <p className="mt-2 max-w-md text-sm text-[#6a7483]">
                      Add a file, or try changing the search or file-type
                      filter.
                    </p>
                  </div>
                ) : null
              )}

              {/* The documents themselves. Folder counts were the only sign a
                  file existed before this, and nothing could open one. */}
              {visibleFiles.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {visibleFiles.map((file) => (
                    <li key={file.id}>
                      <button
                        className="flex w-full min-w-0 items-center gap-4 rounded-xl border border-[#d8dde5] bg-white p-4 text-left transition hover:border-[#1f4d73] hover:bg-[#fbfcfd]"
                        onClick={() => openFile(file.id)}
                        type="button"
                      >
                        <FileIcon className="h-6 w-6 shrink-0 text-[#6a7483]" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-black">
                            {file.fileName}
                          </span>
                          <span className="mt-1 block text-xs font-medium text-[#6a7483]">
                            {fileTypeGroup(file.contentType).toUpperCase()}
                            {file.sizeBytes
                              ? ` - ${formatFileSize(file.sizeBytes)}`
                              : ""}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs font-black text-[#1f4d73]">
                          Open
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {openFileError ? (
                <p className="mt-3 text-xs font-bold text-[#b42318]" role="alert">
                  {openFileError}
                </p>
              ) : null}
            </div>
          </section>
        </div>
      </main>

      <AddFileDialog
        events={filesQuery.data?.events ?? []}
        isSaving={isUploading}
        saveError={uploadError}
        onClose={() => {
          setIsAddFileOpen(false);
          setUploadError(null);
        }}
        onSave={uploadFile}
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
