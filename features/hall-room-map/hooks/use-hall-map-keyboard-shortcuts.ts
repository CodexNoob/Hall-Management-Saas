"use client";

import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { MapObject, SavedHallMap } from "@/features/hall-room-map/components/hall-map-shared";
type Options = {
 clampObjectPosition: (object: MapObject, x: number, y: number) => {x:number;y:number}; clearObjectSelection:()=>void; getActiveObjectIds:()=>string[]; hasSelectedMap:boolean; latestObjectsRef:MutableRefObject<MapObject[]>; objectClipboardRef:MutableRefObject<MapObject[]>; objects:MapObject[]; rememberObjectsSnapshot:()=>void; saveCurrentMap:()=>Promise<void>; selectedMap:SavedHallMap|null; selectedObjectId:string|null; selectedObjectIds:string[]; setObjects:Dispatch<SetStateAction<MapObject[]>>; setSelectedObjectId:Dispatch<SetStateAction<string|null>>; setSelectedObjectIds:Dispatch<SetStateAction<string[]>>; showFeedback:(message:string)=>void; undoStackRef:MutableRefObject<MapObject[][]>;
};
export function useHallMapKeyboardShortcuts(options: Options) {
 const { clampObjectPosition, clearObjectSelection, getActiveObjectIds, hasSelectedMap, latestObjectsRef, objectClipboardRef, objects, rememberObjectsSnapshot, saveCurrentMap, selectedMap, selectedObjectId, selectedObjectIds, setObjects, setSelectedObjectId, setSelectedObjectIds, showFeedback, undoStackRef } = options;
  useEffect(() => {
    function isTypingTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      return Boolean(
        target.closest("input, textarea, select, [contenteditable='true']")
      );
    }

    function handleKeyDown(event: KeyboardEvent) {
      const isModifier = event.ctrlKey || event.metaKey;

      if (isModifier && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveCurrentMap();
        return;
      }

      if (!hasSelectedMap || isTypingTarget(event.target)) {
        return;
      }

      const activeIds = getActiveObjectIds();
      const activeIdSet = new Set(activeIds);

      if (isModifier && event.key.toLowerCase() === "a") {
        event.preventDefault();
        const allIds = latestObjectsRef.current.map((object) => object.id);
        setSelectedObjectIds(allIds);
        setSelectedObjectId(allIds.at(-1) ?? null);
        showFeedback(
          allIds.length
            ? `${allIds.length} shapes selected.`
            : "No shapes to select."
        );
        return;
      }

      if (isModifier && event.key.toLowerCase() === "c") {
        if (!activeIds.length) return;
        event.preventDefault();
        objectClipboardRef.current = latestObjectsRef.current
          .filter((object) => activeIdSet.has(object.id))
          .map((object) => ({ ...object }));
        showFeedback(`${objectClipboardRef.current.length} shape copied.`);
        return;
      }

      if (isModifier && event.key.toLowerCase() === "v") {
        const copiedObjects = objectClipboardRef.current;
        if (!copiedObjects.length) return;
        event.preventDefault();
        rememberObjectsSnapshot();
        const pastedObjects = copiedObjects.map((object, index) => {
          const nextPosition = clampObjectPosition(
            object,
            object.x + 24 + index * 6,
            object.y + 24 + index * 6
          );

          return {
            ...object,
            id: `${object.type}-${crypto.randomUUID()}`,
            name: `${object.name} copy`,
            ...nextPosition
          };
        });
        setObjects((current) => [...current, ...pastedObjects]);
        setSelectedObjectIds(pastedObjects.map((object) => object.id));
        setSelectedObjectId(pastedObjects.at(-1)?.id ?? null);
        showFeedback(`${pastedObjects.length} shape pasted.`);
        return;
      }

      if (isModifier && event.key.toLowerCase() === "z") {
        const previousSnapshot = undoStackRef.current.at(-1);
        if (!previousSnapshot) return;
        event.preventDefault();
        undoStackRef.current = undoStackRef.current.slice(0, -1);
        setObjects(previousSnapshot.map((object) => ({ ...object })));
        clearObjectSelection();
        showFeedback("Undo applied.");
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        if (!activeIds.length) return;
        event.preventDefault();
        rememberObjectsSnapshot();
        setObjects((current) =>
          current.filter((object) => !activeIdSet.has(object.id))
        );
        clearObjectSelection();
        showFeedback(
          activeIds.length === 1
            ? "Shape deleted."
            : `${activeIds.length} shapes deleted.`
        );
        return;
      }

      const movementByKey: Record<string, { x: number; y: number }> = {
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 }
      };
      const movement = movementByKey[event.key];

      if (!movement || !activeIds.length) {
        return;
      }

      event.preventDefault();
      rememberObjectsSnapshot();
      const step = event.shiftKey ? 10 : 1;
      setObjects((current) =>
        current.map((object) => {
          if (!activeIdSet.has(object.id)) {
            return object;
          }

          return {
            ...object,
            ...clampObjectPosition(
              object,
              object.x + movement.x * step,
              object.y + movement.y * step
            )
          };
        })
      );
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
    // The shortcut listener is intentionally keyed to selection/map state;
    // helper functions are recreated by the component but read that same state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hasSelectedMap,
    objects,
    selectedMap,
    selectedObjectId,
    selectedObjectIds
  ]);


}

