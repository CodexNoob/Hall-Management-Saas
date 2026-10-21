import { defineMessages } from "@/lib/i18n/types";

/**
 * Words the whole dashboard shares. Anything that appears on more than one
 * screen belongs here rather than in a feature namespace — "Cancel" is the
 * same button in billing and in settings, and translating it twice is how the
 * two drift apart.
 */
export const commonMessages = defineMessages({
  "common.search": { en: "Search", es: "Buscar", he: "חיפוש" },
  "common.close": { en: "Close", es: "Cerrar", he: "סגירה" },
  "common.cancel": { en: "Cancel", es: "Cancelar", he: "ביטול" },
  "common.save": { en: "Save", es: "Guardar", he: "שמירה" },
  "common.saveChanges": {
    en: "Save changes",
    es: "Guardar cambios",
    he: "שמירת שינויים"
  },
  "common.delete": { en: "Delete", es: "Eliminar", he: "מחיקה" },
  "common.remove": { en: "Remove", es: "Quitar", he: "הסרה" },
  "common.edit": { en: "Edit", es: "Editar", he: "עריכה" },
  "common.add": { en: "Add", es: "Agregar", he: "הוספה" },
  "common.create": { en: "Create", es: "Crear", he: "יצירה" },
  "common.update": { en: "Update", es: "Actualizar", he: "עדכון" },
  "common.done": { en: "Done", es: "Listo", he: "סיום" },
  "common.confirm": { en: "Confirm", es: "Confirmar", he: "אישור" },
  "common.back": { en: "Back", es: "Atrás", he: "חזרה" },
  "common.next": { en: "Next", es: "Siguiente", he: "הבא" },
  "common.previous": { en: "Previous", es: "Anterior", he: "הקודם" },
  "common.apply": { en: "Apply", es: "Aplicar", he: "החלה" },
  "common.reset": { en: "Reset", es: "Restablecer", he: "איפוס" },
  "common.refresh": { en: "Refresh", es: "Actualizar", he: "רענון" },
  "common.print": { en: "Print", es: "Imprimir", he: "הדפסה" },
  "common.export": { en: "Export", es: "Exportar", he: "ייצוא" },
  "common.exportCsv": {
    en: "Export CSV",
    es: "Exportar CSV",
    he: "ייצוא CSV"
  },
  "common.import": { en: "Import", es: "Importar", he: "ייבוא" },
  "common.upload": { en: "Upload", es: "Subir", he: "העלאה" },
  "common.download": { en: "Download", es: "Descargar", he: "הורדה" },
  "common.copyLink": {
    en: "Copy link",
    es: "Copiar enlace",
    he: "העתקת קישור"
  },
  "common.loading": { en: "Loading...", es: "Cargando...", he: "טוען..." },
  "common.loadingData": {
    en: "Loading data…",
    es: "Cargando datos…",
    he: "טוען נתונים…"
  },
  "common.saving": { en: "Saving...", es: "Guardando...", he: "שומר..." },
  "common.tryAgain": {
    en: "Try again",
    es: "Intentar de nuevo",
    he: "נסה שוב"
  },
  "common.retry": { en: "Retry", es: "Reintentar", he: "ניסיון חוזר" },
  "common.unableToLoad": {
    en: "Unable to load this section",
    es: "No se pudo cargar esta sección",
    he: "לא ניתן לטעון קטע זה"
  },
  "common.noRecords": {
    en: "No records yet",
    es: "Aún no hay registros",
    he: "אין עדיין רשומות"
  },
  "common.createFirstRecord": {
    en: "Create the first record to get started.",
    es: "Crea el primer registro para comenzar.",
    he: "צור את הרשומה הראשונה כדי להתחיל."
  },
  "common.noMatches": {
    en: "No matches found.",
    es: "No se encontraron resultados.",
    he: "לא נמצאו תוצאות."
  },
  "common.none": { en: "None", es: "Ninguno", he: "ללא" },
  "common.all": { en: "All", es: "Todos", he: "הכול" },
  "common.optional": { en: "Optional", es: "Opcional", he: "אופציונלי" },
  "common.required": { en: "Required", es: "Obligatorio", he: "חובה" },
  "common.fieldRequired": {
    en: "{field} is required.",
    es: "{field} es obligatorio.",
    he: "{field} הוא שדה חובה."
  },
  "common.name": { en: "Name", es: "Nombre", he: "שם" },
  "common.description": { en: "Description", es: "Descripción", he: "תיאור" },
  "common.email": { en: "Email", es: "Correo electrónico", he: "דוא״ל" },
  "common.phone": { en: "Phone", es: "Teléfono", he: "טלפון" },
  "common.department": {
    en: "Department",
    es: "Departamento",
    he: "מחלקה"
  },
  "common.phoneNumber": {
    en: "Phone number",
    es: "Número de teléfono",
    he: "מספר טלפון"
  },
  "common.country": { en: "Country", es: "País", he: "מדינה" },
  "common.notes": { en: "Notes", es: "Notas", he: "הערות" },
  "common.note": { en: "Note", es: "Nota", he: "הערה" },
  "common.date": { en: "Date", es: "Fecha", he: "תאריך" },
  "common.time": { en: "Time", es: "Hora", he: "שעה" },
  "common.status": { en: "Status", es: "Estado", he: "סטטוס" },
  "common.type": { en: "Type", es: "Tipo", he: "סוג" },
  "common.category": { en: "Category", es: "Categoría", he: "קטגוריה" },
  "common.amount": { en: "Amount", es: "Monto", he: "סכום" },
  "common.total": { en: "Total", es: "Total", he: "סה״כ" },
  "common.client": { en: "Client", es: "Cliente", he: "לקוח" },
  "common.event": { en: "Event", es: "Evento", he: "אירוע" },
  "common.actions": { en: "Actions", es: "Acciones", he: "פעולות" },
  "common.filter": { en: "Filter", es: "Filtrar", he: "סינון" },
  "common.sort": { en: "Sort", es: "Ordenar", he: "מיון" },
  "common.active": { en: "Active", es: "Activo", he: "פעיל" },
  "common.inactive": { en: "Inactive", es: "Inactivo", he: "לא פעיל" },
  "common.yes": { en: "Yes", es: "Sí", he: "כן" },
  "common.no": { en: "No", es: "No", he: "לא" },
  // Repeated across many screens: a pending button, a blank field, a refused
  // page. Kept here so one wording change reaches all of them.
  "common.savingEllipsis": {
    en: "Saving...",
    es: "Guardando...",
    he: "שומר..."
  },
  // The same word, with the typographic ellipsis the menu screens use. Kept
  // separate rather than unified so no button silently changes shape.
  "common.savingChar": {
    en: "Saving…",
    es: "Guardando…",
    he: "שומר…"
  },
  "common.deletingEllipsis": {
    en: "Deleting…",
    es: "Eliminando…",
    he: "מוחק…"
  },
  "common.removingEllipsis": {
    en: "Removing…",
    es: "Quitando…",
    he: "מסיר…"
  },
  "common.uploadingEllipsis": {
    en: "Uploading…",
    es: "Subiendo…",
    he: "מעלה…"
  },
  "common.notSet": { en: "Not set", es: "Sin definir", he: "לא הוגדר" },
  "common.notProvided": {
    en: "Not provided",
    es: "No proporcionado",
    he: "לא סופק"
  },
  "common.accessRestricted": {
    en: "Access restricted",
    es: "Acceso restringido",
    he: "הגישה מוגבלת"
  },
  "common.needsReview": {
    en: "Needs review",
    es: "Requiere revisión",
    he: "דורש בדיקה"
  },
  "common.deletePermanently": {
    en: "Delete “{name}” permanently?",
    es: "¿Eliminar “{name}” de forma permanente?",
    he: "למחוק את “{name}” לצמיתות?"
  },
  "common.todayNotes": {
    en: "Today notes",
    es: "Notas de hoy",
    he: "הערות להיום"
  },
  "common.newBooking": {
    en: "New booking",
    es: "Nueva reserva",
    he: "הזמנה חדשה"
  },
  // The button's visible label is the noun; its accessible name is the verb,
  // because a screen reader announces it with no column heading to lean on.
  "common.createNewBooking": {
    en: "Create new booking",
    es: "Crear una nueva reserva",
    he: "יצירת הזמנה חדשה"
  },
  "common.openTodayNotes": {
    en: "Open today notes",
    es: "Abrir las notas de hoy",
    he: "פתיחת הערות היום"
  },

  // What the shared query and mutation hooks fall back to when the API sends
  // no message of its own.
  "common.unableToSaveChanges": {
    en: "Unable to save changes.",
    es: "No se pudieron guardar los cambios.",
    he: "לא ניתן לשמור את השינויים."
  },
  "common.unableToLoadData": {
    en: "Unable to load data.",
    es: "No se pudieron cargar los datos.",
    he: "לא ניתן לטעון את הנתונים."
  },
  "common.requestFailedWithStatus": {
    en: "Request failed with status {status}.",
    es: "La solicitud falló con el estado {status}.",
    he: "הבקשה נכשלה עם סטטוס {status}."
  },
  "common.never": { en: "Never", es: "Nunca", he: "מעולם לא" }
});
