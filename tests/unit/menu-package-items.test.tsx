import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/menu/services/menu-packages", () => ({
  updateMenuPackage: vi.fn()
}));

import { usePackageItems } from "@/features/menu/hooks/use-package-items";
import {
  updateMenuPackage,
  type MenuPackageChanges
} from "@/features/menu/services/menu-packages";

/**
 * Editing which library items a package includes, from the click's side.
 *
 * The bug these are written against: adding an item used to send the whole list
 * rebuilt from the last fetch, so clicking a second card before the first
 * round trip came back sent a list that had never heard of the first item, and
 * the add was silently undone. So what is asserted is that each click names
 * only what it touched, that the panel moves the card on the click rather than
 * on the answer, and that the server's copy of the list always wins over the
 * one guessed at here.
 */

const packageId = "package-1";
const otherPackageId = "package-2";
const soupId = "item-soup";
const roastId = "item-roast";
const kugelId = "item-kugel";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((settle, fail) => {
    resolve = settle;
    reject = fail;
  });

  return { promise, resolve, reject };
}

/**
 * A stand-in for the column, which applies changes the way the SQL does rather
 * than replacing what it holds. Without this the test could not tell a delta
 * that composes from one that overwrites - both look like a resolved promise.
 */
function fakeStoredList(initial: string[] = []) {
  let stored = [...initial];

  vi.mocked(updateMenuPackage).mockImplementation(
    async (id: string, changes: MenuPackageChanges) => {
      const removed = changes.removeMenuItemIds ?? [];
      const added = (changes.addMenuItemIds ?? []).filter(
        (menuItemId) => !stored.includes(menuItemId)
      );

      stored = [
        ...stored.filter((menuItemId) => !removed.includes(menuItemId)),
        ...added
      ];

      return { id, includedMenuItemIds: [...stored] };
    }
  );

  return { read: () => [...stored] };
}

type PackageProps = { id: string; includedMenuItemIds: string[] };

function setup(includedMenuItemIds: string[] = [], id = packageId) {
  const onChanged = vi.fn(async () => undefined);
  const view = renderHook(
    (props: PackageProps) =>
      usePackageItems({
        activePackage: {
          id: props.id,
          includedMenuItemIds: props.includedMenuItemIds
        },
        onChanged
      }),
    { initialProps: { id, includedMenuItemIds } }
  );

  return { ...view, onChanged };
}

describe("package item editing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("names only the item that was clicked", async () => {
    fakeStoredList([soupId]);

    const { result } = setup([soupId]);

    await act(async () => {
      result.current.addItems([roastId]);
    });

    // Not `includedMenuItemIds: [soup, roast]`. The whole list is the thing
    // that made a second click overwrite the first.
    expect(updateMenuPackage).toHaveBeenCalledWith(packageId, {
      addMenuItemIds: [roastId]
    });
  });

  it("keeps both items when two cards are clicked before either answers", async () => {
    const stored = fakeStoredList([]);

    const { result } = setup([]);

    await act(async () => {
      result.current.addItems([soupId]);
      result.current.addItems([roastId]);
    });
    await waitFor(() => expect(result.current.pendingItemIds.size).toBe(0));

    expect(stored.read()).toEqual([soupId, roastId]);
    expect(result.current.itemIds).toEqual([soupId, roastId]);
  });

  it("moves the item on the click, not on the answer", async () => {
    const pending = deferred<{ id: string; includedMenuItemIds: string[] }>();
    vi.mocked(updateMenuPackage).mockReturnValue(pending.promise);

    const { result } = setup([]);

    act(() => {
      result.current.addItems([soupId]);
    });

    // Nothing has come back yet, and the card has already crossed over.
    expect(result.current.itemIds).toEqual([soupId]);
    expect(result.current.pendingItemIds.has(soupId)).toBe(true);

    await act(async () => {
      pending.resolve({ id: packageId, includedMenuItemIds: [soupId] });
    });

    expect(result.current.pendingItemIds.size).toBe(0);
  });

  it("takes the item off the list on the click", async () => {
    const stored = fakeStoredList([soupId, roastId]);

    const { result } = setup([soupId, roastId]);

    act(() => {
      result.current.removeItems([soupId]);
    });

    expect(result.current.itemIds).toEqual([roastId]);

    await waitFor(() => expect(result.current.pendingItemIds.size).toBe(0));
    expect(updateMenuPackage).toHaveBeenCalledWith(packageId, {
      removeMenuItemIds: [soupId]
    });
    expect(stored.read()).toEqual([roastId]);
  });

  it("prefers the stored list to the one it guessed at", async () => {
    // Someone else added a dish between this click and its answer.
    fakeStoredList([kugelId]);

    const { result } = setup([]);

    await act(async () => {
      result.current.addItems([soupId]);
    });

    expect(result.current.itemIds).toEqual([kugelId, soupId]);
  });

  it("holds the optimistic list until the refetched package agrees", async () => {
    fakeStoredList([]);

    const { result, rerender } = setup([]);

    await act(async () => {
      result.current.addItems([soupId]);
    });

    // The refetch has not landed, so the package still reads as empty. Handing
    // back to it here is what would flash the card away and back again.
    expect(result.current.itemIds).toEqual([soupId]);

    rerender({ id: packageId, includedMenuItemIds: [soupId] });

    expect(result.current.itemIds).toEqual([soupId]);
  });

  it("puts the list back and says why when the write is refused", async () => {
    vi.mocked(updateMenuPackage).mockRejectedValue(
      new Error("You cannot edit the menu.")
    );

    const { result, onChanged } = setup([soupId]);

    await act(async () => {
      result.current.addItems([roastId]);
    });
    await waitFor(() =>
      expect(result.current.errorMessage).toBe("You cannot edit the menu.")
    );

    expect(result.current.itemIds).toEqual([soupId]);
    // Refetched even on the failure: the package is the only thing that knows
    // what actually stuck.
    expect(onChanged).toHaveBeenCalled();
  });

  it("does not draw one package's pending list under another's name", async () => {
    const pending = deferred<{ id: string; includedMenuItemIds: string[] }>();
    vi.mocked(updateMenuPackage).mockReturnValue(pending.promise);

    const { result, rerender } = setup([]);

    act(() => {
      result.current.addItems([soupId]);
    });

    rerender({ id: otherPackageId, includedMenuItemIds: [kugelId] });

    expect(result.current.itemIds).toEqual([kugelId]);

    await act(async () => {
      pending.resolve({ id: packageId, includedMenuItemIds: [soupId] });
    });

    // The answer belongs to the package that is no longer open, so it stays off
    // the one that is.
    expect(result.current.itemIds).toEqual([kugelId]);
  });

  it("puts a whole selection in one request", async () => {
    const stored = fakeStoredList([]);

    const { result } = setup([]);

    await act(async () => {
      result.current.addItems([soupId, roastId, kugelId]);
    });

    // One call, not three. This is the point of selecting before acting: a
    // dozen dishes cost one round trip rather than a dozen.
    expect(updateMenuPackage).toHaveBeenCalledTimes(1);
    expect(updateMenuPackage).toHaveBeenCalledWith(packageId, {
      addMenuItemIds: [soupId, roastId, kugelId]
    });
    expect(stored.read()).toEqual([soupId, roastId, kugelId]);
  });

  it("takes a whole selection off in one request", async () => {
    const stored = fakeStoredList([soupId, roastId, kugelId]);

    const { result } = setup([soupId, roastId, kugelId]);

    act(() => {
      result.current.removeItems([soupId, kugelId]);
    });

    expect(result.current.itemIds).toEqual([roastId]);

    await waitFor(() => expect(result.current.pendingItemIds.size).toBe(0));
    expect(updateMenuPackage).toHaveBeenCalledTimes(1);
    expect(stored.read()).toEqual([roastId]);
  });

  it("reads every item of a selection as busy while it saves", async () => {
    const pending = deferred<{ id: string; includedMenuItemIds: string[] }>();
    vi.mocked(updateMenuPackage).mockReturnValue(pending.promise);

    const { result } = setup([]);

    act(() => {
      result.current.addItems([soupId, roastId]);
    });

    expect(result.current.pendingItemIds.has(soupId)).toBe(true);
    expect(result.current.pendingItemIds.has(roastId)).toBe(true);

    await act(async () => {
      pending.resolve({
        id: packageId,
        includedMenuItemIds: [soupId, roastId]
      });
    });

    expect(result.current.pendingItemIds.size).toBe(0);
  });

  it("ignores an empty selection rather than writing nothing", async () => {
    fakeStoredList([soupId]);

    const { result } = setup([soupId]);

    await act(async () => {
      result.current.addItems([]);
      result.current.removeItems([]);
    });

    expect(updateMenuPackage).not.toHaveBeenCalled();
  });

  it("clears the message once a later write goes through", async () => {
    vi.mocked(updateMenuPackage).mockRejectedValueOnce(new Error("Nope."));

    const { result } = setup([]);

    await act(async () => {
      result.current.addItems([soupId]);
    });
    await waitFor(() => expect(result.current.errorMessage).toBe("Nope."));

    fakeStoredList([]);

    await act(async () => {
      result.current.addItems([roastId]);
    });

    expect(result.current.errorMessage).toBeNull();
    expect(result.current.itemIds).toEqual([roastId]);
  });
});
