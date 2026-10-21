import { defineMessages } from "@/lib/i18n/types";

/** Menu module: library, packages, add-ons, pictures and the bulk uploader. */
export const menuMessages = defineMessages({
  "menu.title": { en: "Menu", es: "Menú", he: "תפריט" },

  // The tab strip. `label` on each tab stays English because `activeTab`
  // switches on it; these are what the strip draws.
  "menu.tab.library": {
    en: "Menu Library",
    es: "Biblioteca del menú",
    he: "ספריית התפריט"
  },
  "menu.tab.packages": {
    en: "Packages",
    es: "Paquetes",
    he: "חבילות"
  },
  "menu.tab.buffet": {
    en: "Buffet Menu",
    es: "Menú de bufé",
    he: "תפריט מזנון"
  },
  "menu.tab.plated": {
    en: "Plated Menu",
    es: "Menú emplatado",
    he: "תפריט מוגש"
  },
  "menu.tab.drinks": {
    en: "Drink Menu",
    es: "Menú de bebidas",
    he: "תפריט משקאות"
  },
  "menu.tab.addOns": {
    en: "Add-ons",
    es: "Extras",
    he: "תוספות"
  },
  "menu.blurb": {
    en: "Menu library, packages, buffet, plated, drinks and add-ons.",
    es: "Biblioteca de menú, paquetes, bufé, emplatado, bebidas y extras.",
    he: "ספריית התפריט, חבילות, מזנון, מוגש, משקאות ותוספות."
  },
  "menu.new": { en: "New", es: "Nuevo", he: "חדש" },

  "menu.includedItems": {
    en: "{count} included items",
    es: "{count} platos incluidos",
    he: "{count} פריטים כלולים"
  },
  "menu.everyDrink": {
    en: "Every drink, however it is served.",
    es: "Todas las bebidas, sea cual sea su forma de servirse.",
    he: "כל המשקאות, בכל אופן הגשה."
  },
  // The Drink Menu's three views. `id` is the identifier the tab compares
  // against; these are only what the strip reads.
  // What a counting rule divides by. Lower case, because every one of these
  // reads inside a phrase such as "1 tray per 30 guests".
  "menu.basisTotalGuests": { en: "guests", es: "invitados", he: "אורחים" },
  "menu.basisCouples": { en: "couples", es: "parejas", he: "זוגות" },
  "menu.basisMen": { en: "men", es: "hombres", he: "גברים" },
  "menu.basisLadies": { en: "ladies", es: "mujeres", he: "נשים" },
  "menu.basisBoys": { en: "boys", es: "niños", he: "בנים" },
  "menu.basisGirls": { en: "girls", es: "niñas", he: "בנות" },
  "menu.basisKids": { en: "kids", es: "niños", he: "ילדים" },
  "menu.basisWaiters": { en: "waiters", es: "camareros", he: "מלצרים" },
  "menu.basisTables": { en: "tables", es: "mesas", he: "שולחנות" },
  "menu.basisEvent": { en: "event", es: "evento", he: "אירוע" },

  // The rounding picker. "Exact" is the mode that does not round at all.
  "menu.roundUp": { en: "round up", es: "redondear hacia arriba", he: "עיגול למעלה" },
  "menu.roundDown": {
    en: "round down",
    es: "redondear hacia abajo",
    he: "עיגול למטה"
  },
  "menu.roundNearest": {
    en: "round nearest",
    es: "redondear al más cercano",
    he: "עיגול לקרוב"
  },

  // `formatServiceRule` writes the rule line under a dish's name.
  "menu.noCountingRule": {
    en: "No counting rule set",
    es: "Sin regla de conteo",
    he: "לא הוגדר כלל ספירה"
  },
  "menu.rulePerEvent": {
    en: "{quantity} {unit} per event",
    es: "{quantity} {unit} por evento",
    he: "{quantity} {unit} לאירוע"
  },
  "menu.rulePerBasis": {
    en: "{quantity} {unit} per {per} {basis}",
    es: "{quantity} {unit} por cada {per} {basis}",
    he: "{quantity} {unit} לכל {per} {basis}"
  },
  "menu.ruleWithMinimum": {
    en: "{rule}, min {minimum}",
    es: "{rule}, mín. {minimum}",
    he: "{rule}, מינימום {minimum}"
  },

  // The service style named inside a sentence on the Buffet and Plated tabs.
  // Lower case on purpose: it reads mid-sentence, never on its own.
  "menu.ruleModeBuffet": { en: "buffet", es: "bufé", he: "מזנון" },
  "menu.ruleModePlated": { en: "plated", es: "emplatado", he: "מוגש" },
  "menu.addSectionItem": {
    en: "Add {section} item",
    es: "Agregar plato de {section}",
    he: "הוספת פריט {section}"
  },
  "menu.drinkViewAll": { en: "All", es: "Todas", he: "הכול" },
  "menu.drinkViewBuffet": { en: "Buffet", es: "Bufé", he: "מזנון" },
  "menu.drinkViewTable": { en: "Table", es: "Mesa", he: "שולחן" },
  "menu.drinksStationHint": {
    en: "A drinks station guests help themselves from. Counted per guests.",
    es: "Una estación de bebidas de la que los invitados se sirven. Se cuenta por invitados.",
    he: "עמדת משקאות שהאורחים מוזגים מעצמם. נספרת לפי אורחים."
  },
  "menu.removeFromLibraryConfirm": {
    en: "“{name}” will be removed from the menu library. This cannot be undone.",
    es: "“{name}” se quitará de la biblioteca de menú. Esto no se puede deshacer.",
    he: "“{name}” יוסר מספריית התפריט. לא ניתן לבטל את הפעולה."
  },
  "menu.bottlesPerTable": {
    en: "Bottles set out on each table. Counted per table.",
    es: "Botellas dispuestas en cada mesa. Se cuentan por mesa.",
    he: "בקבוקים על כל שולחן. נספרים לפי שולחן."
  },
  "menu.noRuleYet": {
    en: "No rule yet",
    es: "Aún sin regla",
    he: "אין עדיין כלל"
  },
  "menu.noRuleYetHint": {
    en: "Still available to put on an event, which is where the rule gets asked for.",
    es: "Aún se puede añadir a un evento, que es donde se pide la regla.",
    he: "עדיין ניתן להוסיף לאירוע, ושם נשאלת שאלת הכלל."
  },
  "menu.notCountedYet": {
    en: "Not counted yet",
    es: "Aún sin contar",
    he: "טרם נספר"
  },
  "menu.newItem": { en: "New item", es: "Nuevo plato", he: "פריט חדש" },
  "menu.removeFailed": {
    en: "The item could not be removed. Please try again.",
    es: "No se pudo quitar el plato. Inténtalo de nuevo.",
    he: "לא ניתן היה להסיר את הפריט. נסה שוב."
  },
  "menu.noItemsMatchSearch": {
    en: "No {section} items match “{query}”.",
    es: "Ningún plato de {section} coincide con “{query}”.",
    he: "אין פריטי {section} שתואמים ל“{query}”."
  },
  "menu.noItemsServedYet": {
    en: "No items are served {section} yet. Add one here, or open a library item and set its service style.",
    es: "Aún no hay platos servidos {section}. Agrega uno aquí, o abre un plato de la biblioteca y define su estilo de servicio.",
    he: "אין עדיין פריטים שמוגשים {section}. הוסף אחד כאן, או פתח פריט מהספרייה והגדר את סגנון ההגשה."
  },
  "menu.drinksOnlyHint": {
    en: "Drinks only. Serving rules are set on the item; price stays on the package.",
    es: "Solo bebidas. Las reglas de servicio se definen en el plato; el precio se mantiene en el paquete.",
    he: "משקאות בלבד. כללי ההגשה נקבעים על הפריט; המחיר נשאר על החבילה."
  },
  "menu.baseItemsHint": {
    en: "Base food items only. No rules, no prices, no hall usage.",
    es: "Solo platos base. Sin reglas, sin precios, sin uso de salón.",
    he: "פריטי מזון בסיסיים בלבד. ללא כללים, מחירים או שימוש באולם."
  },
  "menu.newDrink": {
    en: "New drink",
    es: "Nueva bebida",
    he: "משקה חדש"
  },
  "menu.searchDrinks": {
    en: "Search drinks",
    es: "Buscar bebidas",
    he: "חיפוש משקאות"
  },
  "menu.searchMenuItems": {
    en: "Search menu items",
    es: "Buscar platos",
    he: "חיפוש פריטי תפריט"
  },
  "menu.buffetOrTable": {
    en: "Buffet or Table?",
    es: "¿Bufé o mesa?",
    he: "מזנון או שולחן?"
  },
  "menu.moreActionsFor": {
    en: "More actions for {name}",
    es: "Más acciones para {name}",
    he: "פעולות נוספות עבור {name}"
  },
  "menu.itemsInPackage": {
    en: "Items in this package",
    es: "Platos de este paquete",
    he: "פריטים בחבילה הזו"
  },
  "menu.selectNone": {
    en: "Select none",
    es: "No seleccionar ninguno",
    he: "בטל בחירה"
  },
  "menu.selectAll": {
    en: "Select all",
    es: "Seleccionar todos",
    he: "בחר הכול"
  },
  "menu.libraryEmpty": {
    en: "The Menu Library is empty. Create an item there first, then add it here.",
    es: "La biblioteca del menú está vacía. Crea primero un plato allí y luego agrégalo aquí.",
    he: "ספריית התפריט ריקה. צור שם פריט תחילה, ואז הוסף אותו כאן."
  },
  "menu.everyItemInPackage": {
    en: "Every library item is already in this package.",
    es: "Todos los platos de la biblioteca ya están en este paquete.",
    he: "כל פריטי הספרייה כבר נמצאים בחבילה הזו."
  },
  "menu.currentPicture": {
    en: "Current picture",
    es: "Imagen actual",
    he: "התמונה הנוכחית"
  },
  "menu.savedWithItem": {
    en: "Saved with this item",
    es: "Guardada con este plato",
    he: "נשמרה עם הפריט"
  },
  // The rule row is six unlabelled controls in a line, so each one names
  // itself for a screen reader. {label} is the style the row belongs to.
  "menu.quantityFor": {
    en: "{label} quantity",
    es: "Cantidad de {label}",
    he: "כמות {label}"
  },
  "menu.unitFor": {
    en: "{label} unit",
    es: "Unidad de {label}",
    he: "יחידת {label}"
  },
  "menu.roundingFor": {
    en: "{label} rounding",
    es: "Redondeo de {label}",
    he: "עיגול {label}"
  },
  "menu.minimumFor": {
    en: "{label} minimum",
    es: "Mínimo de {label}",
    he: "מינימום {label}"
  },
  "menu.perQuantity": {
    en: "{label} per quantity",
    es: "{label} por cantidad",
    he: "{label} לכמות"
  },
  "menu.perBasis": {
    en: "{label} per basis",
    es: "{label} por base",
    he: "{label} לפי בסיס"
  },
  "menu.noRounding": {
    en: "no rounding",
    es: "sin redondeo",
    he: "ללא עיגול"
  },
  "menu.roundMode": {
    en: "round {mode}",
    es: "redondear {mode}",
    he: "עיגול {mode}"
  },

  "menu.stepSetUpSheet": {
    en: "Set up your sheet",
    es: "Prepara tu hoja",
    he: "הכן את הגיליון"
  },
  "menu.stepChooseFile": {
    en: "Choose the file",
    es: "Elige el archivo",
    he: "בחר את הקובץ"
  },
  "menu.stepReview": {
    en: "Review and import",
    es: "Revisa e importa",
    he: "בדוק וייבא"
  },
  "menu.willImport": {
    en: "Will import",
    es: "Se importará",
    he: "ייובא"
  },
  // The import guide's column notes. The column HEADERS stay English: they are
  // written into the downloadable template and read back by the parser, so a
  // translated header would be a sheet this build cannot import.
  "menu.csv.helpName": {
    en: "Required. The dish name, up to 200 characters.",
    es: "Obligatorio. El nombre del plato, hasta 200 caracteres.",
    he: "חובה. שם המנה, עד 200 תווים."
  },
  "menu.csv.helpCategory": {
    en: "Appetizer, Soup, Main, Side, Drink, Dessert - or your own. Leave blank to file it under More.",
    es: "Entrante, Sopa, Principal, Guarnición, Bebida, Postre - o el tuyo. Déjalo en blanco para archivarlo en Más.",
    he: "מנה ראשונה, מרק, עיקרית, תוספת, משקה, קינוח - או משלכם. השאירו ריק כדי לתייק תחת ״עוד״."
  },
  "menu.csv.helpKashrut": {
    en: "Parve, Fleishig or Milchig. Dairy and Meat are understood too.",
    es: "Parve, Fleishig o Milchig. También se entienden Lácteo y Carne.",
    he: "פרווה, בשרי או חלבי. גם ״חלב״ ו״בשר״ מובנים."
  },
  "menu.csv.helpAllergies": {
    en: "Several in one cell, separated by commas. Type them straight into the cell - saving as CSV adds the quotes for you.",
    es: "Varias en una celda, separadas por comas. Escríbelas directamente en la celda: al guardar como CSV se añaden las comillas.",
    he: "כמה בתא אחד, מופרדות בפסיקים. הקלידו אותן ישירות בתא - השמירה כ-CSV מוסיפה את המרכאות."
  },
  "menu.csv.helpDescription": {
    en: "Free text, for your own reference.",
    es: "Texto libre, para tu propia referencia.",
    he: "טקסט חופשי, לשימושכם."
  },
  "menu.csv.helpKind": {
    en: "Food or Drink. Blank means Food.",
    es: "Comida o Bebida. En blanco significa Comida.",
    he: "מזון או משקה. ריק פירושו מזון."
  },

  "menu.csv.headerMismatch": {
    en: "The header row does not match the expected order. Columns should be {expected}. Every row will be read by position, so reorder the sheet before importing.",
    es: "La fila de encabezado no coincide con el orden esperado. Las columnas deberían ser {expected}. Cada fila se lee por posición, así que reordena la hoja antes de importar.",
    he: "שורת הכותרות אינה תואמת לסדר הצפוי. העמודות צריכות להיות {expected}. כל שורה נקראת לפי מיקום, אז סדרו מחדש את הגיליון לפני הייבוא."
  },
  "menu.csv.badKashrut": {
    en: "Kashrut type “{value}” is not one of {allowed}.",
    es: "El tipo de kashrut “{value}” no es ninguno de {allowed}.",
    he: "סוג הכשרות ״{value}״ אינו אחד מ-{allowed}."
  },
  "menu.csv.badKind": {
    en: "“{value}” is not {allowed}.",
    es: "“{value}” no es {allowed}.",
    he: "״{value}״ אינו {allowed}."
  },
  "menu.csv.nameEmpty": {
    en: "Item name is empty.",
    es: "El nombre del plato está vacío.",
    he: "שם הפריט ריק."
  },
  "menu.csv.nameTooLong": {
    en: "Item name is longer than {max} characters.",
    es: "El nombre del plato supera los {max} caracteres.",
    he: "שם הפריט ארוך מ-{max} תווים."
  },
  "menu.csv.alreadyInMenu": {
    en: "Already in your menu.",
    es: "Ya está en tu menú.",
    he: "כבר קיים בתפריט שלכם."
  },
  "menu.csv.repeatedInFile": {
    en: "Repeated earlier in this file.",
    es: "Repetido antes en este archivo.",
    he: "חוזר קודם לכן בקובץ הזה."
  },

  "menu.packageUpdateFailed": {
    en: "The package could not be updated. Please try again.",
    es: "No se pudo actualizar el paquete. Inténtalo de nuevo.",
    he: "לא ניתן היה לעדכן את החבילה. נסה שוב."
  },
  "menu.rowDuplicate": {
    en: "Duplicate",
    es: "Duplicado",
    he: "כפול"
  },
  "menu.rowProblem": {
    en: "Problem",
    es: "Problema",
    he: "תקלה"
  },
  // The review table's column headings.
  "menu.colLine": { en: "Line", es: "Línea", he: "שורה" },
  "menu.colCategory": { en: "Category", es: "Categoría", he: "קטגוריה" },
  "menu.colKashrut": { en: "Kashrut", es: "Kashrut", he: "כשרות" },
  "menu.importItemCount": {
    en: "Import {count} item",
    es: "Importar {count} plato",
    he: "ייבוא {count} פריט"
  },
  "menu.importItemCountPlural": {
    en: "Import {count} items",
    es: "Importar {count} platos",
    he: "ייבוא {count} פריטים"
  },
  "menu.fileTooLarge": {
    en: "That file is larger than 1 MB. A menu sheet should be well under it.",
    es: "Ese archivo supera 1 MB. Una hoja de menú debería estar muy por debajo.",
    he: "הקובץ גדול מ-1 מגה-בייט. גיליון תפריט אמור להיות קטן בהרבה."
  },
  "menu.fileUnreadable": {
    en: "That file could not be read. Save it again as CSV and retry.",
    es: "No se pudo leer ese archivo. Guárdalo de nuevo como CSV e inténtalo otra vez.",
    he: "לא ניתן היה לקרוא את הקובץ. שמור אותו שוב כ-CSV ונסה שנית."
  },
  "menu.importFailed": {
    en: "The items could not be imported. Please try again.",
    es: "No se pudieron importar los platos. Inténtalo de nuevo.",
    he: "לא ניתן היה לייבא את הפריטים. נסה שוב."
  },
  "menu.importing": {
    en: "Importing…",
    es: "Importando…",
    he: "מייבא…"
  },

  "menu.enterPrice": {
    en: "Enter a price.",
    es: "Introduce un precio.",
    he: "הזן מחיר."
  },
  "menu.addOnSaveFailed": {
    en: "Unable to save add-on.",
    es: "No se pudo guardar el extra.",
    he: "לא ניתן לשמור את התוספת."
  },
  "menu.buffetHint": {
    en: "Served from a tray. Counted per guests.",
    es: "Se sirve de bandeja. Se cuenta por invitados.",
    he: "מוגש ממגש. נספר לפי אורחים."
  },
  "menu.platedHint": {
    en: "Plated per guest and brought to the table.",
    es: "Emplatado por invitado y llevado a la mesa.",
    he: "מוגש בצלחת לכל אורח ומובא לשולחן."
  },
  "menu.drinkHint": {
    en: "Bottles on the table, or a self-serve station.",
    es: "Botellas en la mesa, o una estación de autoservicio.",
    he: "בקבוקים על השולחן, או עמדת שירות עצמי."
  },
  "menu.libraryOnly": {
    en: "Library only",
    es: "Solo biblioteca",
    he: "ספרייה בלבד"
  },
  "menu.libraryOnlyHint": {
    en: "Catalogue it now, decide how it is served later.",
    es: "Catalógalo ahora y decide después cómo se sirve.",
    he: "קטלג אותו עכשיו, והחלט על ההגשה מאוחר יותר."
  },
  "menu.itemSaveFailed": {
    en: "The item could not be saved. Please try again.",
    es: "No se pudo guardar el plato. Inténtalo de nuevo.",
    he: "לא ניתן היה לשמור את הפריט. נסה שוב."
  },
  "menu.buffetItem": {
    en: "Buffet item",
    es: "Plato de bufé",
    he: "פריט מזנון"
  },
  "menu.foodOrDrink": {
    en: "Food or drink",
    es: "Comida o bebida",
    he: "מזון או משקה"
  },
  "menu.servedAs": {
    en: "Served as",
    es: "Se sirve como",
    he: "מוגש כ"
  },
  "menu.noFileChosen": {
    en: "No file chosen",
    es: "Ningún archivo elegido",
    he: "לא נבחר קובץ"
  },
  "menu.enterBasePrice": {
    en: "Enter a base price.",
    es: "Introduce un precio base.",
    he: "הזן מחיר בסיס."
  },
  "menu.enterPerCouplePrice": {
    en: "Enter a per couple price.",
    es: "Introduce un precio por pareja.",
    he: "הזן מחיר לזוג."
  },
  "menu.packageSaveFailed": {
    en: "The package could not be saved. Please try again.",
    es: "No se pudo guardar el paquete. Inténtalo de nuevo.",
    he: "לא ניתן היה לשמור את החבילה. נסה שוב."
  },
  "menu.savePackage": {
    en: "Save package",
    es: "Guardar paquete",
    he: "שמירת החבילה"
  },
  "menu.addItem": { en: "Add item", es: "Agregar plato", he: "הוספת פריט" },
  "menu.packages": { en: "Packages", es: "Paquetes", he: "חבילות" },
  "menu.noPackages": {
    en: "No packages yet",
    es: "Aún no hay paquetes",
    he: "אין עדיין חבילות"
  },
  "menu.editPackage": {
    en: "Edit package",
    es: "Editar paquete",
    he: "עריכת חבילה"
  },
  "menu.addOns": { en: "Add-ons", es: "Extras", he: "תוספות" },
  "menu.newAddOn": {
    en: "New add-on",
    es: "Nuevo extra",
    he: "תוספת חדשה"
  },
  "menu.closeAddOn": {
    en: "Close add-on dialog",
    es: "Cerrar el diálogo de extras",
    he: "סגירת חלון התוספת"
  },
  "menu.dismiss": { en: "Dismiss", es: "Descartar", he: "סגירה" },
  "menu.removeFromLibrary": {
    en: "Remove from library",
    es: "Quitar de la biblioteca",
    he: "הסרה מהספרייה"
  },
  "menu.removeMenuItem": {
    en: "Remove menu item",
    es: "Quitar plato del menú",
    he: "הסרת פריט מהתפריט"
  },
  "menu.removeItem": {
    en: "Remove item",
    es: "Quitar plato",
    he: "הסרת פריט"
  },
  "menu.pickLibraryItem": {
    en: "Select a Menu Library item, then add the rule and price.",
    es: "Selecciona un plato de la biblioteca y luego agrega la regla y el precio.",
    he: "בחר פריט מספריית התפריט, ואז הוסף את הכלל והמחיר."
  },
  "menu.filterDrinks": {
    en: "Filter drinks by how they are served",
    es: "Filtrar bebidas por cómo se sirven",
    he: "סינון משקאות לפי אופן ההגשה"
  },
  "menu.noItemsInPackage": {
    en: "No items in this package yet. Pick them from the library below.",
    es: "Aún no hay platos en este paquete. Elígelos en la biblioteca de abajo.",
    he: "אין עדיין פריטים בחבילה הזו. בחר אותם מהספרייה שלמטה."
  },
  "menu.addFromLibrary": {
    en: "Add items from the Menu Library",
    es: "Agregar platos desde la biblioteca del menú",
    he: "הוספת פריטים מספריית התפריט"
  },
  "menu.searchItems": {
    en: "Search items",
    es: "Buscar platos",
    he: "חיפוש פריטים"
  },
  "menu.searchLibraryToAdd": {
    en: "Search library items to add",
    es: "Buscar platos de la biblioteca para agregar",
    he: "חיפוש פריטי ספרייה להוספה"
  },
  "menu.noLibraryMatches": {
    en: "No library items match that search.",
    es: "Ningún plato de la biblioteca coincide con esa búsqueda.",
    he: "אין פריטי ספרייה שתואמים לחיפוש הזה."
  },
  "menu.picture": { en: "Picture", es: "Imagen", he: "תמונה" },
  "menu.change": { en: "Change", es: "Cambiar", he: "החלפה" },
  "menu.dropImage": {
    en: "Drop an image here or click to browse",
    es: "Suelta una imagen aquí o haz clic para buscar",
    he: "גרור תמונה לכאן או לחץ לבחירה"
  },
  "menu.replacesPicture": {
    en: "Saving replaces the picture this item has now.",
    es: "Al guardar se reemplaza la imagen actual de este plato.",
    he: "השמירה מחליפה את התמונה הנוכחית של הפריט."
  },
  "menu.pictureFormats": {
    en: "Optional. JPEG, PNG or WebP, up to 5 MB.",
    es: "Opcional. JPEG, PNG o WebP, hasta 5 MB.",
    he: "אופציונלי. JPEG, PNG או WebP, עד 5 מגה-בייט."
  },
  "menu.undo": { en: "Undo", es: "Deshacer", he: "ביטול פעולה" },
  "menu.minOpt": { en: "min (opt)", es: "mín (opc)", he: "מינ׳ (אופ׳)" },

  "menu.bulkUpload": {
    en: "Bulk upload",
    es: "Carga masiva",
    he: "העלאה מרוכזת"
  },
  "menu.bulkUploadItems": {
    en: "Bulk upload menu items",
    es: "Carga masiva de platos",
    he: "העלאה מרוכזת של פריטי תפריט"
  },
  "menu.bulkUploadSteps": {
    en: "Bulk upload steps",
    es: "Pasos de la carga masiva",
    he: "שלבי ההעלאה המרוכזת"
  },
  "menu.closeBulkUpload": {
    en: "Close bulk upload",
    es: "Cerrar la carga masiva",
    he: "סגירת ההעלאה המרוכזת"
  },
  "menu.downloadTemplateCsv": {
    en: "Download template CSV",
    es: "Descargar plantilla CSV",
    he: "הורדת תבנית CSV"
  },
  "menu.downloadTemplateXlsx": {
    en: "Download template xlsx",
    es: "Descargar plantilla xlsx",
    he: "הורדת תבנית xlsx"
  },
  "menu.csvFile": { en: "CSV file", es: "Archivo CSV", he: "קובץ CSV" },
  "menu.sheetReady": {
    en: "My sheet is ready",
    es: "Mi hoja está lista",
    he: "הגיליון שלי מוכן"
  },
  "menu.headingsInRow1": {
    en: "Put the headings above in row 1, one per column.",
    es: "Coloca los encabezados de arriba en la fila 1, uno por columna.",
    he: "מקם את הכותרות שלמעלה בשורה 1, אחת לכל עמודה."
  },
  "menu.oneDishPerRow": {
    en: "Add one dish per row underneath.",
    es: "Agrega un plato por fila debajo.",
    he: "הוסף מנה אחת בכל שורה מתחת."
  },
  "menu.savingFromExcel": {
    en: "Saving from Excel or Google Sheets",
    es: "Guardar desde Excel o Google Sheets",
    he: "שמירה מ-Excel או Google Sheets"
  },

  "menu.ruleAppliesToAll": {
    en: "Applies to every row in the file. Adjust individual dishes afterwards from their card.",
    es: "Se aplica a todas las filas del archivo. Ajusta cada plato después desde su tarjeta.",
    he: "חל על כל השורות בקובץ. התאם מנות בודדות לאחר מכן מהכרטיס שלהן."
  },
  "menu.picturesPerItem": {
    en: "Pictures are added per item — open a card and use Edit to upload one.",
    es: "Las imágenes se agregan por plato: abre una tarjeta y usa Editar para subir una.",
    he: "תמונות מתווספות לכל פריט בנפרד — פתח כרטיס והשתמש בעריכה כדי להעלות."
  },
  "menu.columnsByPosition": {
    en: "Each line becomes one menu item. The columns are read by position, so build your sheet in exactly this order:",
    es: "Cada línea se convierte en un plato. Las columnas se leen por posición, así que crea tu hoja exactamente en este orden:",
    he: "כל שורה הופכת לפריט תפריט אחד. העמודות נקראות לפי מיקום, אז בנה את הגיליון בדיוק בסדר הזה:"
  },
  "menu.picturesNotInFile": {
    en: "Pictures are not part of the file — add them per item after importing. Up to {max} rows per upload.",
    es: "Las imágenes no forman parte del archivo: agrégalas por plato tras importar. Hasta {max} filas por carga.",
    he: "תמונות אינן חלק מהקובץ — הוסף אותן לכל פריט לאחר הייבוא. עד {max} שורות בכל העלאה."
  },
  "menu.xlsxHint": {
    en: "The xlsx has the columns ready with dropdowns for Category, Kashrut Type and Food or Drink — fill it in, then save it as CSV to upload.",
    es: "El xlsx trae las columnas listas con listas desplegables para Categoría, Tipo de kashrut y Comida o bebida: complétalo y guárdalo como CSV para subirlo.",
    he: "קובץ ה-xlsx מגיע עם העמודות מוכנות ורשימות נפתחות לקטגוריה, סוג כשרות ומזון או משקה — מלא אותו ושמור כ-CSV להעלאה."
  },
  "menu.chooseSavedCsv": {
    en: "Choose the CSV you just saved. Nothing is created until you review it on the next step.",
    es: "Elige el CSV que acabas de guardar. No se crea nada hasta que lo revises en el siguiente paso.",
    he: "בחר את קובץ ה-CSV ששמרת. דבר לא נוצר עד שתבדוק אותו בשלב הבא."
  },
  "menu.addedToLibrary": {
    en: "These items are added to the library. Set a dish on the Buffet or Plated tab by editing it and ticking that style.",
    es: "Estos platos se agregan a la biblioteca. Coloca un plato en la pestaña de bufé o emplatado editándolo y marcando ese estilo.",
    he: "הפריטים האלה מתווספים לספרייה. שייך מנה ללשונית המזנון או המוגש על ידי עריכה וסימון הסגנון."
  },
  "menu.saveAsCsvStep": {
    en: "File → Save As (or Download) → CSV. Keep one sheet only.",
    es: "Archivo → Guardar como (o Descargar) → CSV. Conserva una sola hoja.",
    he: "קובץ ← שמירה בשם (או הורדה) ← CSV. השאר גיליון אחד בלבד."
  },
  "menu.back": { en: "Back", es: "Atrás", he: "חזרה" },
  "menu.whichMenu": {
    en: "Which menu?",
    es: "¿Qué menú?",
    he: "איזה תפריט?"
  },
  "menu.closeMenuPicker": {
    en: "Close menu picker",
    es: "Cerrar el selector de menú",
    he: "סגירת בורר התפריט"
  },
  "menu.pickWhereServed": {
    en: "Pick where this item is served. The form opens ready for it.",
    es: "Elige dónde se sirve este plato. El formulario se abre listo para ello.",
    he: "בחר היכן הפריט מוגש. הטופס ייפתח בהתאם."
  },

  "menu.itemName": {
    en: "Item name",
    es: "Nombre del plato",
    he: "שם הפריט"
  },
  "menu.closeLibraryItem": {
    en: "Close library item",
    es: "Cerrar el plato de la biblioteca",
    he: "סגירת פריט הספרייה"
  },
  "menu.shortDescription": {
    en: "Short description for reference",
    es: "Descripción breve de referencia",
    he: "תיאור קצר לעיון"
  },
  "menu.addCountingRule": {
    en: "Add a counting rule (optional)",
    es: "Agregar una regla de conteo (opcional)",
    he: "הוספת כלל ספירה (אופציונלי)"
  },
  "menu.more": { en: "More", es: "Más", he: "עוד" },
  "menu.allergies": { en: "Allergies", es: "Alergias", he: "אלרגיות" },
  "menu.allergiesHint": {
    en: "Nuts, gluten, dairy, sesame",
    es: "Frutos secos, gluten, lácteos, sésamo",
    he: "אגוזים, גלוטן, חלב, שומשום"
  },
  "menu.kashrutType": {
    en: "Kashrut type",
    es: "Tipo de kashrut",
    he: "סוג כשרות"
  },
  "menu.fleishig": { en: "Fleishig", es: "Fleishig", he: "בשרי" },
  "menu.milchig": { en: "Milchig", es: "Milchig", he: "חלבי" },
  "menu.parve": { en: "Parve", es: "Parve", he: "פרווה" },
  "menu.containsAlcohol": {
    en: "Contains alcohol",
    es: "Contiene alcohol",
    he: "מכיל אלכוהול"
  },
  "menu.categoryAppetizer": {
    en: "Appetizer",
    es: "Entrante",
    he: "מנה ראשונה"
  },
  "menu.categorySoup": { en: "Soup", es: "Sopa", he: "מרק" },
  "menu.categoryMain": { en: "Main", es: "Principal", he: "עיקרית" },
  "menu.categorySide": {
    en: "Side",
    es: "Guarnición",
    he: "תוספת"
  },
  "menu.categoryDessert": { en: "Dessert", es: "Postre", he: "קינוח" },
  "menu.categoryDrink": { en: "Drink", es: "Bebida", he: "משקה" },

  "menu.packageName": {
    en: "Package name",
    es: "Nombre del paquete",
    he: "שם החבילה"
  },
  "menu.packageType": {
    en: "Package type",
    es: "Tipo de paquete",
    he: "סוג החבילה"
  },
  "menu.closePackage": {
    en: "Close package",
    es: "Cerrar el paquete",
    he: "סגירת החבילה"
  },
  "menu.basePrice": {
    en: "Base price",
    es: "Precio base",
    he: "מחיר בסיס"
  },
  "menu.perCouple": {
    en: "Per couple",
    es: "Por pareja",
    he: "לזוג"
  },
  "menu.price": { en: "Price", es: "Precio", he: "מחיר" },
  "menu.typeBrunch": { en: "Brunch", es: "Brunch", he: "בראנץ׳" },
  "menu.typeLunch": { en: "Lunch", es: "Almuerzo", he: "צהריים" },
  "menu.typeDinner": { en: "Dinner", es: "Cena", he: "ערב" },
  "menu.typeDairy": { en: "Dairy", es: "Lácteo", he: "חלבי" },
  "menu.typeShabbos": { en: "Shabbos", es: "Shabbos", he: "שבת" },
  "menu.noPackagesBody": {
    en: "Create a package to bundle menu items for weddings, buffets, and other events.",
    es: "Crea un paquete para agrupar platos para bodas, bufés y otros eventos.",
    he: "צור חבילה כדי לקבץ פריטי תפריט לחתונות, מזנונים ואירועים אחרים."
  },
  "menu.addOnsBlurb": {
    en: "Separate add-on items. Add-ons are not pulled from Buffet Menu or Plated Menu.",
    es: "Extras independientes. Los extras no se toman del menú de bufé ni del emplatado.",
    he: "פריטי תוספת נפרדים. תוספות אינן נלקחות מתפריט המזנון או המוגש."
  },
  "menu.removingEllipsis": {
    en: "Removing…",
    es: "Quitando…",
    he: "מסיר…"
  },
  "menu.alcohol": { en: "Alcohol", es: "Alcohol", he: "אלכוהול" },
  "menu.servedScoped": {
    en: "Served {style}, and listed on that menu. Price stays on the package.",
    es: "Se sirve {style} y aparece en ese menú. El precio se mantiene en el paquete.",
    he: "מוגש {style}, ומופיע באותו תפריט. המחיר נשאר על החבילה."
  },
  "menu.drinkServiceHint": {
    en: "Drinks stay on the Drink Menu either way. This sets how much to put out - by table, or by guests for a self-serve station - and which group of that tab it sits under.",
    es: "Las bebidas se quedan en el menú de bebidas en cualquier caso. Esto define cuánto sacar - por mesa, o por invitados en una estación de autoservicio - y en qué grupo de esa pestaña aparece.",
    he: "משקאות נשארים בתפריט המשקאות בכל מקרה. זה קובע כמה להוציא - לפי שולחן, או לפי אורחים בעמדת שירות עצמי - ובאיזו קבוצה בלשונית הם יופיעו."
  },
  "menu.dishServiceHint": {
    en: "Decides which service tabs list it, and how much to cook for each. Price stays on the package.",
    es: "Determina en qué pestañas de servicio aparece y cuánto cocinar para cada una. El precio se mantiene en el paquete.",
    he: "קובע באילו לשוניות הגשה הפריט מופיע, וכמה לבשל לכל אחת. המחיר נשאר על החבילה."
  },
  "menu.saveAddOn": {
    en: "Save add-on",
    es: "Guardar extra",
    he: "שמירת התוספת"
  },
  "menu.savingEllipsis": {
    en: "Saving...",
    es: "Guardando...",
    he: "שומר..."
  },
  "menu.per": { en: "per", es: "por", he: "לכל" },
  "menu.clear": { en: "Clear", es: "Limpiar", he: "ניקוי" }
});
