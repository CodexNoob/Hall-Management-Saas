import { defineMessages } from "@/lib/i18n/types";

/**
 * Hall Room Map editor: the canvas, the shape and preset library, the object
 * inspector and the keyboard-shortcut sheet. Key chords such as `Ctrl/Cmd + Z`
 * are deliberately absent — they are keycaps, not prose, and are the same on a
 * Spanish or Hebrew keyboard.
 */
export const hallMapMessages = defineMessages({
  "hallMap.title": {
    en: "Hall Room Map",
    es: "Mapa de salones",
    he: "מפת האולם"
  },
  "hallMap.blurb": {
    en: "Build default hall layouts with movable, resizable, rotatable objects.",
    es: "Crea distribuciones de salón con objetos que se mueven, redimensionan y rotan.",
    he: "בניית פריסות אולם עם אובייקטים הניתנים להזזה, שינוי גודל וסיבוב."
  },
  "hallMap.grid": {
    en: "Hall map grid",
    es: "Cuadrícula del mapa",
    he: "רשת מפת האולם"
  },
  "hallMap.newMap": {
    en: "New hall room map",
    es: "Nuevo mapa de salón",
    he: "מפת אולם חדשה"
  },
  "hallMap.mapName": {
    en: "Map name",
    es: "Nombre del mapa",
    he: "שם המפה"
  },
  "hallMap.mapNameExample": {
    en: "Example: Main Ballroom",
    es: "Ejemplo: Salón principal",
    he: "לדוגמה: אולם ראשי"
  },
  "hallMap.assignToHall": {
    en: "Assign to hall",
    es: "Asignar a un salón",
    he: "שיוך לאולם"
  },
  "hallMap.assignedHall": {
    en: "Assigned hall",
    es: "Salón asignado",
    he: "האולם המשויך"
  },
  "hallMap.saveMap": {
    en: "Save map",
    es: "Guardar el mapa",
    he: "שמירת המפה"
  },
  "hallMap.saveLayout": {
    en: "Save layout",
    es: "Guardar la distribución",
    he: "שמירת הפריסה"
  },
  "hallMap.savingLayout": {
    en: "Saving layout",
    es: "Guardando la distribución",
    he: "שומר את הפריסה"
  },
  "hallMap.savingYourLayout": {
    en: "Saving your layout…",
    es: "Guardando tu distribución…",
    he: "שומר את הפריסה שלך…"
  },
  "hallMap.deleteMap": {
    en: "Delete map",
    es: "Eliminar el mapa",
    he: "מחיקת המפה"
  },
  "hallMap.copyMapTo": {
    en: "Copy this map to",
    es: "Copiar este mapa a",
    he: "העתקת המפה אל"
  },
  "hallMap.printMap": {
    en: "Print map",
    es: "Imprimir el mapa",
    he: "הדפסת המפה"
  },
  "hallMap.renameMap": {
    en: "Rename hall room map",
    es: "Renombrar el mapa del salón",
    he: "שינוי שם מפת האולם"
  },
  "hallMap.selectHall": {
    en: "Select a hall",
    es: "Selecciona un salón",
    he: "בחר אולם"
  },
  "hallMap.chooseHall": {
    en: "Choose a hall",
    es: "Elige un salón",
    he: "בחר אולם"
  },
  "hallMap.createMap": {
    en: "Create map",
    es: "Crear mapa",
    he: "יצירת מפה"
  },
  "hallMap.saveName": {
    en: "Save name",
    es: "Guardar nombre",
    he: "שמירת השם"
  },
  "hallMap.enterTableNameAndSize": {
    en: "Enter a table name and size.",
    es: "Introduce un nombre y un tamaño de mesa.",
    he: "הזן שם וגודל לשולחן."
  },
  "hallMap.enterValidCapacity": {
    en: "Enter a valid capacity.",
    es: "Introduce una capacidad válida.",
    he: "הזן קיבולת תקינה."
  },
  "hallMap.tableSaveFailed": {
    en: "Unable to save this table.",
    es: "No se pudo guardar esta mesa.",
    he: "לא ניתן לשמור את השולחן."
  },
  "hallMap.noPresetsForHall": {
    en: "No presets for this hall",
    es: "No hay preajustes para este salón",
    he: "אין הגדרות לאולם הזה"
  },
  "hallMap.replaceImage": {
    en: "Replace image",
    es: "Reemplazar imagen",
    he: "החלפת התמונה"
  },
  "hallMap.uploadImage": {
    en: "Upload image",
    es: "Subir imagen",
    he: "העלאת תמונה"
  },
  "hallMap.noSeating": {
    en: "No seating",
    es: "Sin asientos",
    he: "ללא ישיבה"
  },
  "hallMap.adultSeating": {
    en: "Adult seating",
    es: "Asientos de adultos",
    he: "ישיבת מבוגרים"
  },
  "hallMap.kidsSeating": {
    en: "Kids seating",
    es: "Asientos de niños",
    he: "ישיבת ילדים"
  },
  "hallMap.headTable": {
    en: "Head table",
    es: "Mesa principal",
    he: "שולחן ראשי"
  },
  "hallMap.oneSide": { en: "One side", es: "Un lado", he: "צד אחד" },
  "hallMap.twoSides": { en: "Two sides", es: "Dos lados", he: "שני צדדים" },
  "hallMap.fourSides": {
    en: "Four sides",
    es: "Cuatro lados",
    he: "ארבעה צדדים"
  },
  "hallMap.buffet": { en: "Buffet", es: "Bufé", he: "מזנון" },
  "hallMap.drinks": { en: "Drinks", es: "Bebidas", he: "משקאות" },
  "hallMap.box": { en: "Box", es: "Caja", he: "קופסה" },
  "hallMap.circle": { en: "Circle", es: "Círculo", he: "עיגול" },
  "hallMap.kidsTable": {
    en: "Kids table",
    es: "Mesa de niños",
    he: "שולחן ילדים"
  },
  "hallMap.rectTable": {
    en: "Rect table",
    es: "Mesa rectangular",
    he: "שולחן מלבני"
  },
  "hallMap.dragToResize": {
    en: "Drag to resize {shape} from the {edge} edge",
    es: "Arrastra para redimensionar {shape} desde el borde {edge}",
    he: "גרור כדי לשנות את גודל {shape} מהקצה ה{edge}"
  },
  "hallMap.dragToRotate": {
    en: "Drag to rotate {shape}",
    es: "Arrastra para rotar {shape}",
    he: "גרור כדי לסובב את {shape}"
  },

  "hallMap.layoutSaved": {
    en: "Layout saved",
    es: "Distribución guardada",
    he: "הפריסה נשמרה"
  },
  "hallMap.selectMapFirst": {
    en: "Create or select a hall room map first.",
    es: "Primero crea o selecciona un mapa de salón.",
    he: "תחילה צור או בחר מפת אולם."
  },
  "hallMap.tablesAddedInRows": {
    en: "{count} tables added in rows.",
    es: "{count} mesas agregadas en filas.",
    he: "נוספו {count} שולחנות בשורות."
  },
  "hallMap.copiedToHall": {
    en: "{name} copied to {hall}.",
    es: "{name} copiado a {hall}.",
    he: "{name} הועתק אל {hall}."
  },
  "hallMap.copyFailed": {
    en: "Unable to copy this map.",
    es: "No se pudo copiar este mapa.",
    he: "לא ניתן להעתיק את המפה."
  },
  "hallMap.floorPlanAdded": {
    en: "Floor plan added under the layout.",
    es: "Plano agregado bajo la distribución.",
    he: "תוכנית הקומה נוספה מתחת לפריסה."
  },
  "hallMap.floorPlanUploadFailed": {
    en: "The floor plan could not be uploaded.",
    es: "No se pudo subir el plano.",
    he: "לא ניתן היה להעלות את תוכנית הקומה."
  },
  "hallMap.floorPlanRemoved": {
    en: "Floor plan removed.",
    es: "Plano eliminado.",
    he: "תוכנית הקומה הוסרה."
  },
  "hallMap.floorPlanRemoveFailed": {
    en: "The floor plan could not be removed.",
    es: "No se pudo eliminar el plano.",
    he: "לא ניתן היה להסיר את תוכנית הקומה."
  },
  "hallMap.savedToLibrary": {
    en: "{name} saved to the shape library.",
    es: "{name} guardado en la biblioteca de formas.",
    he: "{name} נשמר בספריית הצורות."
  },
  "hallMap.oneShapeSelected": {
    en: "1 shape selected.",
    es: "1 forma seleccionada.",
    he: "נבחרה צורה אחת."
  },
  "hallMap.shapesSelected": {
    en: "{count} shapes selected.",
    es: "{count} formas seleccionadas.",
    he: "נבחרו {count} צורות."
  },
  // The rest of what the keyboard shortcuts announce.
  "hallMap.selectionCleared": {
    en: "Selection cleared.",
    es: "Selección borrada.",
    he: "הבחירה נוקתה."
  },
  "hallMap.noShapesToSelect": {
    en: "No shapes to select.",
    es: "No hay formas que seleccionar.",
    he: "אין צורות לבחירה."
  },
  "hallMap.rotationReset": {
    en: "{count} shape rotation reset.",
    es: "Rotación de {count} forma restablecida.",
    he: "סיבוב {count} צורות אופס."
  },
  "hallMap.rotatedClockwise": {
    en: "{count} shape rotated clockwise.",
    es: "{count} forma girada en sentido horario.",
    he: "{count} צורות סובבו עם כיוון השעון."
  },
  "hallMap.rotatedCounterclockwise": {
    en: "{count} shape rotated counterclockwise.",
    es: "{count} forma girada en sentido antihorario.",
    he: "{count} צורות סובבו נגד כיוון השעון."
  },
  "hallMap.shapeCopied": {
    en: "{count} shape copied.",
    es: "{count} forma copiada.",
    he: "{count} צורות הועתקו."
  },
  "hallMap.shapePasted": {
    en: "{count} shape pasted.",
    es: "{count} forma pegada.",
    he: "{count} צורות הודבקו."
  },
  "hallMap.redoApplied": {
    en: "Redo applied.",
    es: "Rehacer aplicado.",
    he: "בוצע ביצוע חוזר."
  },
  "hallMap.undoApplied": {
    en: "Undo applied.",
    es: "Deshacer aplicado.",
    he: "בוצע ביטול."
  },
  "hallMap.shapeDeleted": {
    en: "Shape deleted.",
    es: "Forma eliminada.",
    he: "הצורה נמחקה."
  },
  "hallMap.shapesDeleted": {
    en: "{count} shapes deleted.",
    es: "{count} formas eliminadas.",
    he: "{count} צורות נמחקו."
  },
  "hallMap.clearEveryShape": {
    en: "Clear every shape from this hall room map?",
    es: "¿Borrar todas las formas de este mapa de salón?",
    he: "לנקות את כל הצורות ממפת האולם הזו?"
  },
  "hallMap.mapCleared": {
    en: "Map cleared. Save the map to keep this change.",
    es: "Mapa borrado. Guarda el mapa para conservar este cambio.",
    he: "המפה נוקתה. שמור את המפה כדי לשמר את השינוי."
  },
  "hallMap.assignPresetFirst": {
    en: "Assign this preset to a hall before saving.",
    es: "Asigna este preajuste a un salón antes de guardar.",
    he: "שייך את ההגדרה לאולם לפני השמירה."
  },
  "hallMap.presetSavedTo": {
    en: "{name} saved to {hall}.",
    es: "{name} guardado en {hall}.",
    he: "{name} נשמר ב{hall}."
  },
  "hallMap.presetSaveFailed": {
    en: "Unable to save this preset.",
    es: "No se pudo guardar este preajuste.",
    he: "לא ניתן לשמור את ההגדרה."
  },
  "hallMap.mapRenamedTo": {
    en: "Map renamed to {name}.",
    es: "El mapa se renombró a {name}.",
    he: "שם המפה שונה ל{name}."
  },
  "hallMap.createdForHall": {
    en: "{name} created for {hall}.",
    es: "{name} creado para {hall}.",
    he: "{name} נוצר עבור {hall}."
  },
  "hallMap.mapSaveFailed": {
    en: "Unable to save this map.",
    es: "No se pudo guardar este mapa.",
    he: "לא ניתן לשמור את המפה."
  },
  "hallMap.mapDeleteFailed": {
    en: "Unable to delete this map.",
    es: "No se pudo eliminar este mapa.",
    he: "לא ניתן למחוק את המפה."
  },
  "hallMap.seatSummary": {
    en: "{adult} adult · {kids} kids · {head} head table",
    es: "{adult} adultos · {kids} niños · {head} mesa principal",
    he: "{adult} מבוגרים · {kids} ילדים · {head} שולחן ראשי"
  },
  "hallMap.close": { en: "Close", es: "Cerrar", he: "סגירה" },
  "hallMap.print": { en: "Print", es: "Imprimir", he: "הדפסה" },
  "hallMap.printPreview": {
    en: "Print preview",
    es: "Vista previa de impresión",
    he: "תצוגה מקדימה להדפסה"
  },
  "hallMap.viewOnly": {
    en: "View only",
    es: "Solo lectura",
    he: "צפייה בלבד"
  },
  "hallMap.seatCapacity": {
    en: "Seat capacity",
    es: "Capacidad de asientos",
    he: "קיבולת מושבים"
  },

  "hallMap.shapeLibrary": {
    en: "Shape library",
    es: "Biblioteca de formas",
    he: "ספריית הצורות"
  },
  "hallMap.clickToAdd": {
    en: "Click to add to the map.",
    es: "Haz clic para agregarlo al mapa.",
    he: "לחץ כדי להוסיף למפה."
  },
  "hallMap.hallPresets": {
    en: "Hall presets",
    es: "Preajustes de salón",
    he: "הגדרות אולם"
  },
  "hallMap.preset": {
    en: "Preset",
    es: "Preajuste",
    he: "הגדרה"
  },
  "hallMap.loadPreset": {
    en: "Load preset",
    es: "Cargar preajuste",
    he: "טעינת הגדרה"
  },
  "hallMap.savePreset": {
    en: "Save preset",
    es: "Guardar preajuste",
    he: "שמירת הגדרה"
  },
  "hallMap.customTables": {
    en: "Custom tables",
    es: "Mesas personalizadas",
    he: "שולחנות מותאמים"
  },
  "hallMap.newTable": {
    en: "New table",
    es: "Nueva mesa",
    he: "שולחן חדש"
  },
  "hallMap.saveTable": {
    en: "Save table",
    es: "Guardar mesa",
    he: "שמירת השולחן"
  },
  "hallMap.tableName": {
    en: "Table name",
    es: "Nombre de la mesa",
    he: "שם השולחן"
  },
  "hallMap.tableNameExample": {
    en: "Example: 60 inch round table",
    es: "Ejemplo: mesa redonda de 60 pulgadas",
    he: "לדוגמה: שולחן עגול 60 אינץ׳"
  },
  "hallMap.savedTablesHere": {
    en: "Saved tables will appear here.",
    es: "Las mesas guardadas aparecerán aquí.",
    he: "שולחנות שנשמרו יופיעו כאן."
  },
  "hallMap.tables": { en: "Tables", es: "Mesas", he: "שולחנות" },
  "hallMap.seats": { en: "Seats", es: "Asientos", he: "מושבים" },
  "hallMap.numberOfSeats": {
    en: "Number of seats",
    es: "Número de asientos",
    he: "מספר המושבים"
  },
  "hallMap.seatsPerTable": {
    en: "Seats per table",
    es: "Asientos por mesa",
    he: "מושבים לשולחן"
  },
  "hallMap.capacitySeats": {
    en: "Capacity / seats",
    es: "Capacidad / asientos",
    he: "קיבולת / מושבים"
  },
  "hallMap.shape": { en: "Shape", es: "Forma", he: "צורה" },
  "hallMap.roundTable": {
    en: "Round table",
    es: "Mesa redonda",
    he: "שולחן עגול"
  },
  "hallMap.squareTable": {
    en: "Square table",
    es: "Mesa cuadrada",
    he: "שולחן מרובע"
  },
  "hallMap.mechitzaDivider": {
    en: "Mechitza divider",
    es: "Separador mechitzá",
    he: "מחיצה"
  },
  "hallMap.floorPlan": {
    en: "Floor plan",
    es: "Plano",
    he: "תוכנית הקומה"
  },
  "hallMap.uploadFloorPlan": {
    en: "Upload floor plan image",
    es: "Subir imagen del plano",
    he: "העלאת תמונת תוכנית הקומה"
  },
  "hallMap.addInRows": {
    en: "Add in rows",
    es: "Agregar en filas",
    he: "הוספה בשורות"
  },
  "hallMap.addRoundInRows": {
    en: "Add round tables in rows",
    es: "Agregar mesas redondas en filas",
    he: "הוספת שולחנות עגולים בשורות"
  },
  "hallMap.perRow": {
    en: "Per row",
    es: "Por fila",
    he: "לשורה"
  },
  "hallMap.realSize": {
    en: "Real size",
    es: "Tamaño real",
    he: "גודל אמיתי"
  },
  "hallMap.duplicate": {
    en: "Duplicate",
    es: "Duplicar",
    he: "שכפול"
  },
  "hallMap.copy": { en: "Copy", es: "Copiar", he: "העתקה" },
  "hallMap.rename": {
    en: "Rename",
    es: "Renombrar",
    he: "שינוי שם"
  },

  "hallMap.objectInspector": {
    en: "Object inspector",
    es: "Inspector de objetos",
    he: "מפקח האובייקטים"
  },
  "hallMap.selectedShapeSettings": {
    en: "Selected shape settings.",
    es: "Ajustes de la forma seleccionada.",
    he: "הגדרות הצורה הנבחרת."
  },
  "hallMap.selectObject": {
    en: "Select object",
    es: "Selecciona un objeto",
    he: "בחר אובייקט"
  },
  "hallMap.width": { en: "Width", es: "Ancho", he: "רוחב" },
  "hallMap.height": { en: "Height", es: "Alto", he: "גובה" },
  "hallMap.rotation": {
    en: "Rotation",
    es: "Rotación",
    he: "סיבוב"
  },
  "hallMap.seatingSides": {
    en: "Seating sides",
    es: "Lados con asientos",
    he: "צדדים עם ישיבה"
  },
  "hallMap.seatingUse": {
    en: "Seating use",
    es: "Uso del asiento",
    he: "שימוש בישיבה"
  },

  "hallMap.zoomControls": {
    en: "Map zoom controls",
    es: "Controles de zoom del mapa",
    he: "פקדי הזום של המפה"
  },
  "hallMap.zoomIn": {
    en: "Zoom in",
    es: "Acercar",
    he: "הגדלה"
  },
  "hallMap.zoomOut": {
    en: "Zoom out",
    es: "Alejar",
    he: "הקטנה"
  },
  "hallMap.resetZoom": {
    en: "Reset zoom",
    es: "Restablecer el zoom",
    he: "איפוס הזום"
  },
  "hallMap.fitAllShapes": {
    en: "Fit all shapes",
    es: "Ajustar todas las formas",
    he: "התאמת כל הצורות"
  },
  "hallMap.snapToGrid": {
    en: "Snap dragged shapes to the grid. Hold Alt while dragging to bypass.",
    es: "Ajusta las formas arrastradas a la cuadrícula. Mantén Alt al arrastrar para omitirlo.",
    he: "הצמדת צורות נגררות לרשת. החזק Alt בגרירה כדי לעקוף."
  },
  "hallMap.undo": { en: "Undo", es: "Deshacer", he: "ביטול פעולה" },
  "hallMap.clearSelection": {
    en: "Clear selection",
    es: "Limpiar la selección",
    he: "ניקוי הבחירה"
  },
  "hallMap.selectAll": {
    en: "Select all",
    es: "Seleccionar todo",
    he: "בחירת הכול"
  },
  "hallMap.addToSelection": {
    en: "Add to selection",
    es: "Agregar a la selección",
    he: "הוספה לבחירה"
  },
  "hallMap.deleteShape": {
    en: "Delete shape",
    es: "Eliminar la forma",
    he: "מחיקת הצורה"
  },
  "hallMap.moveShape": {
    en: "Move shape",
    es: "Mover la forma",
    he: "הזזת הצורה"
  },
  "hallMap.move10Units": {
    en: "Move 10 units",
    es: "Mover 10 unidades",
    he: "הזזה ב-10 יחידות"
  },
  "hallMap.rotateClockwise": {
    en: "Rotate clockwise",
    es: "Rotar en sentido horario",
    he: "סיבוב עם כיוון השעון"
  },
  "hallMap.rotateCounterclockwise": {
    en: "Rotate counterclockwise",
    es: "Rotar en sentido antihorario",
    he: "סיבוב נגד כיוון השעון"
  },
  "hallMap.resetRotation": {
    en: "Reset rotation",
    es: "Restablecer la rotación",
    he: "איפוס הסיבוב"
  },
  "hallMap.copyPaste": {
    en: "Copy / paste",
    es: "Copiar / pegar",
    he: "העתקה / הדבקה"
  },
  "hallMap.zoomAtPointer": {
    en: "Zoom at pointer",
    es: "Zoom en el puntero",
    he: "זום במיקום הסמן"
  },
  "hallMap.shortcuts": {
    en: "Keyboard shortcuts",
    es: "Atajos de teclado",
    he: "קיצורי מקלדת"
  },
  "hallMap.shortcutsTitle": {
    en: "Hall map shortcuts",
    es: "Atajos del mapa del salón",
    he: "קיצורי מפת האולם"
  },
  "hallMap.showShortcuts": {
    en: "Show hall map shortcuts",
    es: "Mostrar los atajos del mapa",
    he: "הצגת קיצורי מפת האולם"
  },
  "hallMap.modifierHint": {
    en: "Use Ctrl on Windows and Linux. Use Cmd on macOS.",
    es: "Usa Ctrl en Windows y Linux. Usa Cmd en macOS.",
    he: "השתמש ב-Ctrl ב-Windows וב-Linux. השתמש ב-Cmd ב-macOS."
  },
  "hallMap.inspectorHint": {
    en: "The inspector updates one selected object. Tables have a seat count and seating use. Edit the name field to rename a shape.",
    es: "El inspector actualiza un objeto seleccionado. Las mesas tienen número de asientos y uso. Edita el campo de nombre para renombrar una forma.",
    he: "המפקח מעדכן אובייקט נבחר אחד. לשולחנות יש מספר מושבים ושימוש. ערוך את שדה השם כדי לשנות את שם הצורה."
  },
  "hallMap.floorPlanHint": {
    en: "Drawn under the shapes so you can lay tables over the hall's real plan.",
    es: "Se dibuja bajo las formas para que puedas colocar mesas sobre el plano real del salón.",
    he: "מצויר מתחת לצורות כדי שתוכל להניח שולחנות מעל התוכנית האמיתית של האולם."
  },
  "hallMap.arrowKeys": {
    en: "Arrow keys",
    es: "Teclas de flecha",
    he: "מקשי החצים"
  },
  "hallMap.shiftClick": {
    en: "Shift + click",
    es: "Mayús + clic",
    he: "Shift + לחיצה"
  },
  "hallMap.shiftArrows": {
    en: "Shift + arrows",
    es: "Mayús + flechas",
    he: "Shift + חצים"
  },
  "hallMap.ctrlWheel": {
    en: "Ctrl/Cmd + wheel",
    es: "Ctrl/Cmd + rueda",
    he: "Ctrl/Cmd + גלגלת"
  }
});
