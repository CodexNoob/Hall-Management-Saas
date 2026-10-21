"use client";

import { useMemo, useState } from "react";
import { LineIcon } from "@/features/events/components/event-manager-shared";
import { useAuthenticatedMutation } from "@/features/dashboard/hooks/use-authenticated-mutation";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import { useDashboardPermission } from "@/features/dashboard/hooks/use-dashboard-permission";
import {
  AddFileDialog,
  type AddFileFormValues
} from "@/features/files/forms/add-file-dialog";
import {
  fileTypeGroup,
  type FilesResponse
} from "@/features/files/components/file-shared";
import {
  buildStoredFileName,
  formatFileSize,
  openStoredFile,
  uploadOrganizationFile
} from "@/features/files/lib/upload-file";
import {
  EVENT_FOLDER_SECTIONS,
  resolveDestinationFolder
} from "@/features/files/lib/event-folders";
import { useAppLanguage } from "@/components/providers/app-language-provider";

/** Sentinel for "no folder filter". Compared against, never printed raw. */
const ALL_FILES = "all-files";

/**
 * The event's documents, read from the same StoredFile rows the Files page
 * shows. This was a hardcoded list of three invented PDFs, so the tab promised
 * a filing system that did not exist.
 *
 * Files uploaded here are tagged with the event and filed under that event's
 * folder, which means one row is reachable from the booking, from the folder
 * tree, and - because the API fills clientId from the event - from the client.
 */
export function EventFilesContent({
  eventId,
  clientName,
  eventType
}: {
  eventId: string;
  clientName: string;
  eventType: string;
}) {
  const { t } = useAppLanguage();
  const canEdit = useDashboardPermission("file.create");
  const filesQuery = useAuthenticatedQuery<FilesResponse>("/api/files");
  const folderMutation = useAuthenticatedMutation<
    Record<string, unknown>,
    { folder: { id: string } }
  >("/api/files");
  const fileMutation = useAuthenticatedMutation<
    Record<string, unknown>,
    { file: { id: string } }
  >("/api/files");

  const [selectedSection, setSelectedSection] = useState(ALL_FILES);
  const [isAddFileOpen, setIsAddFileOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const folders = useMemo(
    () => filesQuery.data?.folders ?? [],
    [filesQuery.data]
  );

  /** This event's own folder, if one has been created yet. */
  const eventFolder = useMemo(
    () => folders.find((folder) => folder.eventId === eventId) ?? null,
    [folders, eventId]
  );

  const sectionFolders = useMemo(
    () =>
      eventFolder
        ? folders.filter((folder) => folder.parentId === eventFolder.id)
        : [],
    [folders, eventFolder]
  );

  /** Every file under this event, whichever section it sits in. */
  const eventFiles = useMemo(() => {
    const sectionIds = new Set(sectionFolders.map((folder) => folder.id));
    if (eventFolder) sectionIds.add(eventFolder.id);

    return (filesQuery.data?.files ?? []).filter(
      (file) =>
        file.eventId === eventId ||
        (file.folderId !== null && sectionIds.has(file.folderId))
    );
  }, [filesQuery.data, eventId, eventFolder, sectionFolders]);

  const sections = useMemo(() => {
    const named = EVENT_FOLDER_SECTIONS.map((name) => {
      const folder = sectionFolders.find((item) => item.name === name);
      return {
        name,
        folderId: folder?.id ?? null,
        count: folder
          ? eventFiles.filter((file) => file.folderId === folder.id).length
          : 0
      };
    });

    return [
      { name: ALL_FILES, folderId: null, count: eventFiles.length },
      ...named
    ];
  }, [sectionFolders, eventFiles]);

  const visibleFiles =
    selectedSection === ALL_FILES
      ? eventFiles
      : eventFiles.filter(
          (file) =>
            file.folderId ===
            sections.find((section) => section.name === selectedSection)
              ?.folderId
        );


  async function uploadFile(values: AddFileFormValues) {
    const bucket = filesQuery.data?.bucket;
    if (!bucket) {
      setUploadError(t("events.storageUnavailable"));
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      // Same resolver the Files page uses, so a booking filed from either
      // screen lands in one folder rather than two.
      const folderId = await resolveDestinationFolder({
        folders,
        createFolder: folderMutation.mutate,
        sectionName: values.sectionName,
        event: { id: eventId, clientName, eventType }
      });
      const storagePath = await uploadOrganizationFile(values.file, bucket);

      await fileMutation.mutate({
        resource: "file",
        bucket,
        storagePath,
        fileName: buildStoredFileName(values.fileName, values.file.name),
        contentType: values.file.type,
        sizeBytes: values.file.size,
        folderId,
        // What ties the row to this booking, and what the API uses to fill in
        // the client so the same document turns up in their history.
        eventId
      });

      await filesQuery.refetch();
      setIsAddFileOpen(false);
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : t("events.fileUploadFailed")
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function openFile(fileId: string) {
    setActionError(null);
    try {
      await openStoredFile(fileId);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : t("events.fileOpenFailed")
      );
    }
  }

  return (
    <div className="grid min-h-107.5 min-w-0 gap-3 overflow-hidden rounded-lg border border-[#d8dde5] bg-[#fbfcfd] p-3 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="overflow-hidden rounded-lg border border-[#d8dde5] bg-white">
        {sections.map((section) => {
          const isActive = selectedSection === section.name;

          return (
            <button
              key={section.name}
              className={`flex h-9.75 w-full items-center gap-2 border-b border-[#d8dde5] px-4 text-left text-sm last:border-b-0 ${
                isActive
                  ? "bg-[#eef4fa] font-black text-[#17202a]"
                  : "text-[#17202a] hover:bg-[#eef4fa]"
              }`}
              type="button"
              onClick={() => setSelectedSection(section.name)}
            >
              <LineIcon
                name={section.name === ALL_FILES ? "files" : "chevron"}
                className={`h-4 w-4 shrink-0 ${isActive ? "text-[#1f4d73]" : "text-[#17202a]"}`}
              />
              <span className="min-w-0 flex-1 truncate">{section.name}</span>
              <span className="text-xs font-normal text-[#17202a]">
                {section.count}
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
              {selectedSection}
            </h2>
          </div>
          {/* Held until the bucket name has arrived. Opening the dialog first
              let someone pick a file and only then be told storage was
              unavailable, when the truth was that the list had not loaded. */}
          <button
            className="inline-flex h-8 shrink-0 items-center gap-2 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white shadow-sm shadow-[#1f4d73]/20 hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canEdit || !filesQuery.data?.bucket}
            type="button"
            onClick={() => setIsAddFileOpen(true)}
          >
            <LineIcon name="upload" className="h-3.5 w-3.5" />
            {t("events.uploadFile")}
          </button>
        </header>

        {filesQuery.isLoading ? (
          <p className="p-4 text-sm font-medium text-[#6a7483]">
            {t("events.loadingFiles")}
          </p>
        ) : visibleFiles.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center px-6 text-center">
            <LineIcon name="files" className="h-8 w-8 text-[#b9c2cf]" />
            <p className="mt-3 text-sm font-black text-[#17202a]">
              {t("events.noFiles")}
            </p>
            <p className="mt-1 max-w-sm text-xs text-[#6a7483]">
              {t("events.filesBlurb")}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleFiles.map((file) => (
              <article
                key={file.id}
                className="flex min-h-28 flex-col justify-between rounded-lg border border-[#d8dde5] bg-white p-4"
              >
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-black text-[#17202a]">
                    {file.fileName}
                  </h3>
                  <p className="mt-1 truncate text-xs text-[#6a7483]">
                    {folders.find((folder) => folder.id === file.folderId)
                      ?.name ?? "Unfiled"}
                  </p>
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-5 items-center rounded-full border border-[#b9c2cf] bg-[#eef4fa] px-2 text-[11px] font-black text-[#1f4d73]">
                    {fileTypeGroup(file.contentType).toUpperCase()}
                  </span>
                  {file.sizeBytes ? (
                    <span className="inline-flex h-5 items-center rounded-full border border-[#b9c2cf] bg-[#fbfcfd] px-2 text-[11px] font-black text-[#17202a]">
                      {formatFileSize(file.sizeBytes)}
                    </span>
                  ) : null}
                  <button
                    className="ml-auto text-[11px] font-black text-[#1f4d73] hover:underline"
                    onClick={() => openFile(file.id)}
                    type="button"
                  >
                    {t("events.open")}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {actionError ? (
          <p className="px-4 pb-3 text-xs font-bold text-[#b42318]" role="alert">
            {actionError}
          </p>
        ) : null}
      </section>

      <AddFileDialog
        // Locked to this booking - the tab is already scoped to it, so the
        // picker would only offer a way to file it somewhere else by mistake.
        lockedEventId={eventId}
        isSaving={isUploading}
        saveError={uploadError}
        onClose={() => {
          setIsAddFileOpen(false);
          setUploadError(null);
        }}
        onSave={uploadFile}
        open={isAddFileOpen}
      />
    </div>
  );
}
