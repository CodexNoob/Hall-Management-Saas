import { defineMessages } from "@/lib/i18n/types";

/** The file explorer, its folder dialogs and the add-file form. */
export const filesMessages = defineMessages({
  "files.title": { en: "Files", es: "Archivos", he: "קבצים" },
  "files.blurb": {
    en: "Master file explorer with practical folders only.",
    es: "Explorador principal con solo carpetas prácticas.",
    he: "סייר הקבצים הראשי, עם תיקיות שימושיות בלבד."
  },
  "files.folders": { en: "Folders", es: "Carpetas", he: "תיקיות" },
  "files.fileFolders": {
    en: "File folders",
    es: "Carpetas de archivos",
    he: "תיקיות קבצים"
  },
  "files.folderNavigation": {
    en: "Folder navigation",
    es: "Navegación de carpetas",
    he: "ניווט בתיקיות"
  },
  "files.closeFolderNavigation": {
    en: "Close folder navigation",
    es: "Cerrar la navegación de carpetas",
    he: "סגירת הניווט בתיקיות"
  },
  "files.searchThisFolder": {
    en: "Search this folder",
    es: "Buscar en esta carpeta",
    he: "חיפוש בתיקייה הזו"
  },
  "files.emptyFolder": {
    en: "Nothing in this folder",
    es: "No hay nada en esta carpeta",
    he: "אין דבר בתיקייה הזו"
  },
  "files.filterByType": {
    en: "Filter by file type",
    es: "Filtrar por tipo de archivo",
    he: "סינון לפי סוג קובץ"
  },
  "files.allTypes": {
    en: "All types",
    es: "Todos los tipos",
    he: "כל הסוגים"
  },
  "files.typeDocument": {
    en: "Document",
    es: "Documento",
    he: "מסמך"
  },
  "files.typeSpreadsheet": {
    en: "Spreadsheet",
    es: "Hoja de cálculo",
    he: "גיליון אלקטרוני"
  },
  "files.typeImage": { en: "Image", es: "Imagen", he: "תמונה" },
  "files.typeVideo": { en: "Video", es: "Video", he: "וידאו" },
  "files.typeAudio": { en: "Audio", es: "Audio", he: "אודיו" },
  "files.typePdf": { en: "PDF", es: "PDF", he: "PDF" },
  "files.typeOther": { en: "Other", es: "Otro", he: "אחר" },
  "files.open": { en: "Open", es: "Abrir", he: "פתיחה" },
  "files.addFile": {
    en: "Add file",
    es: "Agregar archivo",
    he: "הוספת קובץ"
  },
  "files.closeAddFile": {
    en: "Close add file",
    es: "Cerrar agregar archivo",
    he: "סגירת הוספת הקובץ"
  },
  "files.uploadFiles": {
    en: "Upload files",
    es: "Subir archivos",
    he: "העלאת קבצים"
  },
  "files.fileName": {
    en: "File name",
    es: "Nombre del archivo",
    he: "שם הקובץ"
  },
  "files.optionalNotes": {
    en: "Optional Notes",
    es: "Notas opcionales",
    he: "הערות אופציונליות"
  },
  "files.folder": { en: "Folder", es: "Carpeta", he: "תיקייה" },
  "files.folderName": {
    en: "Folder name",
    es: "Nombre de la carpeta",
    he: "שם התיקייה"
  },
  "files.folderNameExample": {
    en: "e.g. Insurance",
    es: "p. ej. Seguros",
    he: "למשל ביטוח"
  },
  "files.noEventGeneral": {
    en: "No event - general filing",
    es: "Sin evento: archivo general",
    he: "ללא אירוע - תיוק כללי"
  },
  "files.newFolder": {
    en: "New folder",
    es: "Nueva carpeta",
    he: "תיקייה חדשה"
  },
  "files.closeNewFolder": {
    en: "Close new folder",
    es: "Cerrar la nueva carpeta",
    he: "סגירת התיקייה החדשה"
  },
  "files.createFolder": {
    en: "Create folder",
    es: "Crear carpeta",
    he: "יצירת תיקייה"
  },
  "files.newEventFolder": {
    en: "New event folder",
    es: "Nueva carpeta de evento",
    he: "תיקיית אירוע חדשה"
  },
  "files.closeNewEventFolder": {
    en: "Close new event folder",
    es: "Cerrar la nueva carpeta de evento",
    he: "סגירת תיקיית האירוע החדשה"
  },
  "files.createEventFolder": {
    en: "Create event folder",
    es: "Crear carpeta de evento",
    he: "יצירת תיקיית אירוע"
  },
  "files.emptyFolderBody": {
    en: "Add a file, or try changing the search or file-type filter.",
    es: "Agrega un archivo o prueba a cambiar la búsqueda o el filtro de tipo.",
    he: "הוסף קובץ, או נסה לשנות את החיפוש או את מסנן סוג הקובץ."
  },
  "files.eventFolderBlurb": {
    en: "Creates only the folders that normally need files: Invoicing, Hall Layout, Footage, Pictures, Videos and Documents.",
    es: "Crea solo las carpetas que normalmente necesitan archivos: Facturación, Distribución del salón, Grabaciones, Fotos, Vídeos y Documentos.",
    he: "יוצר רק את התיקיות שבדרך כלל נדרשות: חיוב, פריסת אולם, צילומים, תמונות, סרטונים ומסמכים."
  },
  "files.storageUnavailable": {
    en: "Storage is unavailable. Reload the page and try again.",
    es: "El almacenamiento no está disponible. Recarga la página e inténtalo de nuevo.",
    he: "האחסון אינו זמין. רענן את העמוד ונסה שוב."
  },
  "files.uploadFailed": {
    en: "That file could not be uploaded.",
    es: "No se pudo subir ese archivo.",
    he: "לא ניתן היה להעלות את הקובץ."
  },
  "files.openFailed": {
    en: "That file could not be opened.",
    es: "No se pudo abrir ese archivo.",
    he: "לא ניתן היה לפתוח את הקובץ."
  },
  "files.folderNameFor": {
    en: "Folder name for {name}",
    es: "Nombre de carpeta para {name}",
    he: "שם תיקייה עבור {name}"
  },
  "files.moreActionsFor": {
    en: "More actions for {name}",
    es: "Más acciones para {name}",
    he: "פעולות נוספות עבור {name}"
  },
  "files.chooseFileToUpload": {
    en: "Choose a file to upload.",
    es: "Elige un archivo para subir.",
    he: "בחר קובץ להעלאה."
  },
  "files.nameTheFolder": {
    en: "Name the folder this file belongs in.",
    es: "Nombra la carpeta a la que pertenece este archivo.",
    he: "תן שם לתיקייה שאליה שייך הקובץ."
  },
  "files.dropFilesHere": {
    en: "Drop files here or click to browse",
    es: "Suelta archivos aquí o haz clic para buscar",
    he: "גרור קבצים לכאן או לחץ לבחירה"
  },
  "files.uploading": {
    en: "Uploading...",
    es: "Subiendo...",
    he: "מעלה..."
  },
  "files.saveFile": {
    en: "Save file",
    es: "Guardar archivo",
    he: "שמירת הקובץ"
  },
  "files.driveSynced": {
    en: "Google Drive synced",
    es: "Google Drive sincronizado",
    he: "Google Drive מסונכרן"
  },
  "files.driveNotConnected": {
    en: "Drive sync not connected",
    es: "Sincronización con Drive no conectada",
    he: "סנכרון Drive אינו מחובר"
  },

  // The upload helpers. They are plain functions a dialog calls, so they read
  // the locale through lib/i18n/ambient.ts rather than a hook.
  "files.unsupportedType": {
    en: "{name} is not a supported file type. Allowed: {allowed}.",
    es: "{name} no es un tipo de archivo admitido. Se permiten: {allowed}.",
    he: "{name} אינו סוג קובץ נתמך. מותרים: {allowed}."
  },
  "files.overSizeLimit": {
    en: "{name} is {size}. The limit is 50 MB.",
    es: "{name} pesa {size}. El límite es 50 MB.",
    he: "{name} במשקל {size}. המגבלה היא 50 מגה-בייט."
  },
  "files.sessionExpired": {
    en: "Your session has expired. Please sign in again.",
    es: "Tu sesión ha expirado. Inicia sesión de nuevo.",
    he: "פג תוקף ההתחברות. היכנס שוב."
  },
  "files.couldNotOpen": {
    en: "That file could not be opened.",
    es: "No se pudo abrir ese archivo.",
    he: "לא ניתן היה לפתוח את הקובץ."
  },
  "files.floorPlanType": {
    en: "Floor plans must be a JPEG, PNG or WebP image.",
    es: "Los planos deben ser una imagen JPEG, PNG o WebP.",
    he: "תוכניות הקומה חייבות להיות תמונת JPEG, PNG או WebP."
  },
  "files.floorPlanSize": {
    en: "Floor plans must be 10 MB or smaller.",
    es: "Los planos deben pesar 10 MB o menos.",
    he: "תוכניות הקומה חייבות להיות בגודל 10 מגה-בייט או פחות."
  },
  "files.pictureType": {
    en: "Pictures must be a JPEG, PNG or WebP image.",
    es: "Las imágenes deben ser JPEG, PNG o WebP.",
    he: "התמונות חייבות להיות בפורמט JPEG, PNG או WebP."
  },
  "files.pictureSize": {
    en: "Pictures must be 5 MB or smaller.",
    es: "Las imágenes deben pesar 5 MB o menos.",
    he: "התמונות חייבות להיות בגודל 5 מגה-בייט או פחות."
  },
  // Two branding pickers sit on the same screen, so each refusal names which
  // one it came from.
  "files.brandingType": {
    en: "The {subject} must be a JPEG, PNG or WebP image.",
    es: "El {subject} debe ser una imagen JPEG, PNG o WebP.",
    he: "{subject} חייב להיות תמונת JPEG, PNG או WebP."
  },
  "files.brandingSize": {
    en: "The {subject} must be {mb} MB or smaller.",
    es: "El {subject} debe pesar {mb} MB o menos.",
    he: "{subject} חייב להיות בגודל {mb} מגה-בייט או פחות."
  }
});
