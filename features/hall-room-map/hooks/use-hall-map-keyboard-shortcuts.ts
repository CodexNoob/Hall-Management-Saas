"use client";

import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { MapObject, SavedHallMap } from "@/features/hall-room-map/components/hall-map-shared";
import type { MessageKey } from "@/lib/i18n/messages";
type Options = {
 clampObjectPosition: (object: MapObject, x: number, y: number) => {x:number;y:number}; clearObjectSelection:()=>void; fitAllShapes:()=>void; getActiveObjectIds:()=>string[]; hasSelectedMap:boolean; latestObjectsRef:MutableRefObject<MapObject[]>; objectClipboardRef:MutableRefObject<MapObject[]>; objects:MapObject[]; redoStackRef:MutableRefObject<MapObject[][]>; rememberObjectsSnapshot:()=>void; resetMapZoom:()=>void; saveCurrentMap:()=>Promise<void>; selectedMap:SavedHallMap|null; selectedObjectId:string|null; selectedObjectIds:string[]; setObjects:Dispatch<SetStateAction<MapObject[]>>; setSelectedObjectId:Dispatch<SetStateAction<string|null>>; setSelectedObjectIds:Dispatch<SetStateAction<string[]>>; showFeedback:(message:string)=>void; t:(key:MessageKey,values?:Record<string,string|number>)=>string; undoStackRef:MutableRefObject<MapObject[][]>; zoomAtPointer:(direction:"in"|"out",clientX:number,clientY:number)=>void; zoomIn:()=>void; zoomOut:()=>void;
};
export function useHallMapKeyboardShortcuts(options: Options) {
 const { clampObjectPosition, clearObjectSelection, fitAllShapes, getActiveObjectIds, hasSelectedMap, latestObjectsRef, objectClipboardRef, objects, redoStackRef, rememberObjectsSnapshot, resetMapZoom, saveCurrentMap, selectedMap, selectedObjectId, selectedObjectIds, setObjects, setSelectedObjectId, setSelectedObjectIds, showFeedback, t, undoStackRef, zoomAtPointer, zoomIn, zoomOut } = options;
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
      const isFitAll =
        event.shiftKey &&
        !isModifier &&
        (event.key === "!" || event.code === "Digit1");
      const isZoomIn =
        isModifier &&
        (event.key === "+" ||
          event.key === "=" ||
          event.code === "Equal" ||
          event.code === "NumpadAdd");
      const isZoomOut =
        isModifier &&
        (event.key === "-" ||
          event.code === "Minus" ||
          event.code === "NumpadSubtract");
      const isZoomReset =
        isModifier &&
        (event.key === "0" || event.code === "Digit0" || event.code === "Numpad0");

      if (hasSelectedMap && isFitAll && !isTypingTarget(event.target)) {
        event.preventDefault();
        fitAllShapes();
        return;
      }

      // Capture browser zoom combinations before checking the focused element.
      // Ctrl/Cmd with +, -, or 0 does not edit a form value, so it is safe for
      // map zoom even when an inspector input still has focus.
      if (hasSelectedMap && isZoomIn) {
        event.preventDefault();
        zoomIn();
        return;
      }

      if (hasSelectedMap && isZoomOut) {
        event.preventDefault();
        zoomOut();
        return;
      }

      if (hasSelectedMap && isZoomReset) {
        event.preventDefault();
        if (event.shiftKey) {
          fitAllShapes();
        } else {
          resetMapZoom();
        }
        return;
      }

      if (isModifier && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveCurrentMap();
        return;
      }

      if (!hasSelectedMap || isTypingTarget(event.target)) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        clearObjectSelection();
        showFeedback(t("hallMap.selectionCleared"));
        return;
      }

      const activeIds = getActiveObjectIds();
      const activeIdSet = new Set(activeIds);

      if (!isModifier && event.key.toLowerCase() === "r" && activeIds.length) {
        event.preventDefault();
        rememberObjectsSnapshot();
        setObjects((current) =>
          current.map((object) => {
            if (!activeIdSet.has(object.id)) return object;

            const rotation = event.altKey
              ? 0
              : ((object.rotation + (event.shiftKey ? -15 : 15)) % 360 +
                  360) %
                360;

            return { ...object, rotation };
          })
        );
        showFeedback(
          event.altKey
            ? t("hallMap.rotationReset", { count: activeIds.length })
            : t(
                event.shiftKey
                  ? "hallMap.rotatedCounterclockwise"
                  : "hallMap.rotatedClockwise",
                { count: activeIds.length }
              )
        );
        return;
      }

      if (isModifier && event.key.toLowerCase() === "a") {
        event.preventDefault();
        const allIds = latestObjectsRef.current.map((object) => object.id);
        setSelectedObjectIds(allIds);
        setSelectedObjectId(allIds.at(-1) ?? null);
        showFeedback(
          allIds.length
            ? t("hallMap.shapesSelected", { count: allIds.length })
            : t("hallMap.noShapesToSelect")
        );
        return;
      }

      if (isModifier && event.key.toLowerCase() === "c") {
        if (!activeIds.length) return;
        event.preventDefault();
        objectClipboardRef.current = latestObjectsRef.current
          .filter((object) => activeIdSet.has(object.id))
          .map((object) => ({ ...object }));
        showFeedback(
          t("hallMap.shapeCopied", {
            count: objectClipboardRef.current.length
          })
        );
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
        showFeedback(
          t("hallMap.shapePasted", { count: pastedObjects.length })
        );
        return;
      }

      // Redo before undo: Ctrl+Shift+Z also matches the plain "z" check below.
      const isRedo =
        isModifier &&
        ((event.key.toLowerCase() === "z" && event.shiftKey) ||
          event.key.toLowerCase() === "y");

      if (isRedo) {
        const nextSnapshot = redoStackRef.current.at(-1);
        if (!nextSnapshot) return;
        event.preventDefault();
        redoStackRef.current = redoStackRef.current.slice(0, -1);
        // Straight onto the undo stack, not through rememberObjectsSnapshot -
        // that would clear the redo stack this step is walking.
        undoStackRef.current = [
          ...undoStackRef.current.slice(-24),
          latestObjectsRef.current.map((object) => ({ ...object }))
        ];
        setObjects(nextSnapshot.map((object) => ({ ...object })));
        clearObjectSelection();
        showFeedback(t("hallMap.redoApplied"));
        return;
      }

      if (isModifier && event.key.toLowerCase() === "z") {
        const previousSnapshot = undoStackRef.current.at(-1);
        if (!previousSnapshot) return;
        event.preventDefault();
        undoStackRef.current = undoStackRef.current.slice(0, -1);
        redoStackRef.current = [
          ...redoStackRef.current.slice(-24),
          latestObjectsRef.current.map((object) => ({ ...object }))
        ];
        setObjects(previousSnapshot.map((object) => ({ ...object })));
        clearObjectSelection();
        showFeedback(t("hallMap.undoApplied"));
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
            ? t("hallMap.shapeDeleted")
            : t("hallMap.shapesDeleted", { count: activeIds.length })
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

    function handleWheel(event: WheelEvent) {
      if (
        !(event.ctrlKey || event.metaKey) ||
        !hasSelectedMap
      ) {
        return;
      }

      event.preventDefault();
      zoomAtPointer(
        event.deltaY < 0 ? "in" : "out",
        event.clientX,
        event.clientY
      );
    }

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("wheel", handleWheel, {
      capture: true,
      passive: false
    });

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("wheel", handleWheel, true);
    };
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
