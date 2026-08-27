"use client";

import { useEffect, useMemo, useState } from "react";
import type { PermissionKey } from "@/lib/authz/catalog";
import {
  describeApiError,
  epochHeaders,
  roleTone,
  type ApiError,
  type CatalogResponse,
  type RoleSummary
} from "@/features/access/components/access-shared";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";

/**
 * The role editor. THIS is the step that delivers the headline property:
 * until it ships, adding a role means writing SQL.
 *
 * It renders the catalog the server sends and nothing it invents itself, and it
 * carries the epoch it was composed against on every save - so two
 * administrators with the same grid open get a 409 and a refetch rather than a
 * silent lost update.
 */

type RoleEditorProps = {
  catalog: CatalogResponse | null;
  role: RoleSummary | null;
  /** Null when composing a brand-new role. */
  epoch: number;
  canManage: boolean;
  onSaved: () => void;
  onClose: () => void;
};

const RANK_HELP =
  "Lower outranks higher. The starter roles sit at 100, 200, 300, 400 and 500, so a new role slots between two of them without renumbering anything.";

export function RoleEditor({
  catalog,
  role,
  epoch,
  canManage,
  onSaved,
  onClose
}: RoleEditorProps) {
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [rank, setRank] = useState(role?.rank ?? 350);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(role?.permissions ?? [])
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setName(role?.name ?? "");
    setDescription(role?.description ?? "");
    setRank(role?.rank ?? 350);
    setSelected(new Set(role?.permissions ?? []));
    setError("");
  }, [role]);

  const groups = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return catalog?.groups ?? [];

    return (catalog?.groups ?? [])
      .map((section) => ({
        ...section,
        permissions: section.permissions.filter((permission) =>
          `${permission.key} ${permission.label} ${permission.description}`
            .toLowerCase()
            .includes(query)
        )
      }))
      .filter((section) => section.permissions.length > 0);
  }, [catalog?.groups, search]);

  const toggle = (key: PermissionKey) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleGroup = (keys: PermissionKey[], on: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      for (const key of keys) {
        if (on) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  };

  const save = async () => {
    setIsSaving(true);
    setError("");

    try {
      const body = JSON.stringify({
        name: name.trim(),
        description: description.trim() || null,
        rank,
        permissions: [...selected]
      });

      const response = await authenticatedFetch(
        role ? `/api/access/roles/${role.id}` : "/api/access/roles",
        {
          method: role ? "PATCH" : "POST",
          headers: epochHeaders(epoch),
          body
        }
      );

      if (!response.ok) {
        const payload = (await response
          .json()
          .catch(() => null)) as ApiError | null;

        // A 409 means somebody else committed first. Say so plainly and let the
        // list refetch - never silently retry, because the user's intent may no
        // longer apply once they can see what changed.
        setError(describeApiError(payload));

        if (payload?.code === "epoch_stale") onSaved();
        return;
      }

      onSaved();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Save failed.");
    } finally {
      setIsSaving(false);
    }
  };

  const disabled = !canManage || isSaving;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
      {/*
        A named dialog, not an anonymous overlay. It lets assistive technology
        distinguish this editor's permission checkboxes from the controls in the
        Roles & Permissions panels behind it.
      */}
      <div
        aria-labelledby="role-editor-title"
        aria-modal="true"
        className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[#d8dde5] px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-black" id="role-editor-title">
              {role ? `Edit ${role.name}` : "New role"}
            </h2>
            <p className="mt-0.5 text-[10px] text-[#6a7483]">
              {selected.size} of{" "}
              {catalog?.groups.reduce(
                (total, section) => total + section.permissions.length,
                0
              ) ?? 0}{" "}
              permissions selected
              {role?.isSystem
                ? " · starter role: its name and permissions are editable, its key is not"
                : ""}
            </p>
          </div>
          <button
            className="rounded-lg border border-[#c7d0dc] px-3 py-1.5 text-xs font-black"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </header>

        <div className="grid gap-3 border-b border-[#eef1f5] px-4 py-3 sm:grid-cols-[2fr_1fr]">
          <label className="block text-[10px] font-black uppercase tracking-wide text-[#6a7483]">
            Name
            <input
              className="mt-1 h-9 w-full rounded-lg border border-[#c7d0dc] px-3 text-xs font-semibold text-[#17202a]"
              disabled={disabled}
              name="roleName"
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </label>
          <label className="block text-[10px] font-black uppercase tracking-wide text-[#6a7483]">
            Rank
            <input
              className="mt-1 h-9 w-full rounded-lg border border-[#c7d0dc] px-3 text-xs font-semibold text-[#17202a]"
              disabled={disabled}
              name="roleRank"
              min={1}
              onChange={(event) => setRank(Number(event.target.value))}
              title={RANK_HELP}
              type="number"
              value={rank}
            />
          </label>
          <label className="block text-[10px] font-black uppercase tracking-wide text-[#6a7483] sm:col-span-2">
            Description
            <input
              className="mt-1 h-9 w-full rounded-lg border border-[#c7d0dc] px-3 text-xs font-semibold text-[#17202a]"
              disabled={disabled}
              name="roleDescription"
              onChange={(event) => setDescription(event.target.value)}
              value={description}
            />
          </label>
          <p className="text-[10px] text-[#6a7483] sm:col-span-2">{RANK_HELP}</p>
        </div>

        <div className="border-b border-[#eef1f5] px-4 py-2">
          <input
            className="h-9 w-full rounded-lg border border-[#c7d0dc] px-3 text-xs"
            name="permissionSearch"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter permissions"
            value={search}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {groups.map((section) => {
            const keys = section.permissions.map(
              (permission) => permission.key
            );
            const allOn = keys.every((key) => selected.has(key));

            return (
              <section className="mb-4" key={section.group}>
                <div className="mb-1.5 flex items-center justify-between">
                  <h3 className="text-[11px] font-black uppercase tracking-wide text-[#39465a]">
                    {section.group}
                  </h3>
                  <button
                    className="text-[10px] font-black text-[#1769aa] disabled:text-[#9aa5b4]"
                    disabled={disabled}
                    onClick={() => toggleGroup(keys, !allOn)}
                    type="button"
                  >
                    {allOn ? "Clear group" : "Select group"}
                  </button>
                </div>
                <ul className="space-y-1">
                  {section.permissions.map((permission) => (
                    <li key={permission.key}>
                      <label className="flex items-start gap-2 rounded-lg border border-[#eef1f5] px-2.5 py-2 hover:bg-[#f7f9fb]">
                        <input
                          checked={selected.has(permission.key)}
                          className="mt-0.5"
                          disabled={disabled}
                          name={`permission-${permission.key}`}
                          onChange={() => toggle(permission.key)}
                          type="checkbox"
                        />
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-black text-[#17202a]">
                              {permission.label}
                            </span>
                            <code className="rounded bg-[#eef1f5] px-1 py-0.5 text-[9px] text-[#536172]">
                              {permission.key}
                            </code>
                            {permission.isDangerous ? (
                              // Marked, not blocked. The catalog says which keys
                              // escalate privilege or move money; deciding to
                              // grant one is still the administrator's call.
                              <span className="rounded border border-[#f2b7ba] bg-[#fff2f2] px-1 py-0.5 text-[9px] font-black text-[#d63740]">
                                Sensitive
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 block text-[10px] text-[#6a7483]">
                            {permission.description}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <footer className="flex flex-col gap-2 border-t border-[#d8dde5] px-4 py-3">
          {error ? (
            <p className="rounded-lg border border-[#f2b7ba] bg-[#fff2f2] px-3 py-2 text-[11px] font-semibold text-[#a52a3d]">
              {error}
            </p>
          ) : null}
          {!canManage ? (
            <p className="text-[10px] text-[#6a7483]">
              You can read roles but not author them. That needs
              <code className="mx-1 rounded bg-[#eef1f5] px-1">role.manage</code>
              .
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              className="h-9 rounded-lg border border-[#c7d0dc] px-4 text-xs font-black"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="h-9 rounded-lg bg-[#17202a] px-4 text-xs font-black text-white disabled:opacity-50"
              disabled={disabled || !name.trim()}
              onClick={save}
              type="button"
            >
              {isSaving ? "Saving..." : role ? "Save role" : "Create role"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export function RoleBadge({ name }: { name: string }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-md border px-2 py-1 text-[10px] font-black ${roleTone(name)}`}
    >
      {name}
    </span>
  );
}
