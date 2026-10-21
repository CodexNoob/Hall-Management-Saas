import { defineMessages } from "@/lib/i18n/types";

/** Dining Manager: event list, seating workspace and the dining details panel. */
export const diningMessages = defineMessages({
  "dining.title": {
    en: "Dining Manager",
    es: "Gestión del comedor",
    he: "ניהול חדר האוכל"
  },
  "dining.blurb": {
    en: "Select an event, adjust the hall layout, and prepare the dining sheet.",
    es: "Selecciona un evento, ajusta la distribución del salón y prepara la hoja del comedor.",
    he: "בחר אירוע, התאם את פריסת האולם והכן את גיליון חדר האוכל."
  },
  "dining.details": {
    en: "Dining details",
    es: "Detalles del comedor",
    he: "פרטי חדר האוכל"
  },
  "dining.detailsBlurb": {
    en: "Event-specific setup saved to Supabase.",
    es: "Configuración específica del evento guardada en Supabase.",
    he: "הגדרות ייעודיות לאירוע שנשמרות ב-Supabase."
  },
  "dining.planActions": {
    en: "Plan actions",
    es: "Acciones del plan",
    he: "פעולות התוכנית"
  },
  "dining.autoLayout": {
    en: "Auto layout",
    es: "Distribución automática",
    he: "פריסה אוטומטית"
  },
  "dining.addRequiredTables": {
    en: "Add required tables",
    es: "Agregar las mesas necesarias",
    he: "הוספת השולחנות הנדרשים"
  },
  "dining.checkSeating": {
    en: "Check seating",
    es: "Comprobar el sentado",
    he: "בדיקת הושבה"
  },
  "dining.seatingCheck": {
    en: "Seating check",
    es: "Comprobación del sentado",
    he: "בדיקת ההושבה"
  },
  "dining.seatsPerTable": {
    en: "Seats per table",
    es: "Asientos por mesa",
    he: "מושבים לשולחן"
  },
  "dining.seatsProvided": {
    en: "Seats provided",
    es: "Asientos disponibles",
    he: "מושבים שסופקו"
  },
  "dining.selectedTableUse": {
    en: "Selected table use",
    es: "Uso de la mesa seleccionada",
    he: "שימוש בשולחן הנבחר"
  },
  "dining.countType": {
    en: "Count type",
    es: "Tipo de conteo",
    he: "סוג הספירה"
  },
  "dining.adults": { en: "Adults", es: "Adultos", he: "מבוגרים" },
  "dining.children": { en: "Children", es: "Niños", he: "ילדים" },
  "dining.menWaiters": {
    en: "Men waiters",
    es: "Camareros",
    he: "מלצרים"
  },
  "dining.womenWaiters": {
    en: "Women waiters",
    es: "Camareras",
    he: "מלצריות"
  },
  "dining.selectedTable": {
    en: "Selected table",
    es: "Mesa seleccionada",
    he: "השולחן הנבחר"
  },
  "dining.headTable": {
    en: "Head table",
    es: "Mesa principal",
    he: "שולחן ראשי"
  },
  "dining.seatingSufficient": {
    en: "Seating is sufficient for all guests.",
    es: "El sentado es suficiente para todos los invitados.",
    he: "ההושבה מספיקה לכל האורחים."
  },
  "dining.moreSeatingRequired": {
    en: "More seating is required.",
    es: "Se requiere más sentado.",
    he: "נדרשת הושבה נוספת."
  },
  "dining.collapseEvents": {
    en: "Collapse events",
    es: "Contraer eventos",
    he: "כיווץ אירועים"
  },
  "dining.expandEvents": {
    en: "Expand events",
    es: "Expandir eventos",
    he: "הרחבת אירועים"
  },
  "dining.collapseWorkspace": {
    en: "Collapse dining workspace",
    es: "Contraer el espacio del comedor",
    he: "כיווץ סביבת חדר האוכל"
  },
  "dining.expandWorkspace": {
    en: "Expand dining workspace",
    es: "Expandir el espacio del comedor",
    he: "הרחבת סביבת חדר האוכל"
  },
  "dining.selectPreset": {
    en: "Select a preset",
    es: "Selecciona un preajuste",
    he: "בחר הגדרה"
  },
  "dining.noPresetsFor": {
    en: "No presets assigned to {hall}",
    es: "No hay preajustes asignados a {hall}",
    he: "אין הגדרות משויכות ל{hall}"
  },
  "dining.tablesResized": {
    en: "Tables resized to {seats} seats. Re-run Auto layout to match the table count to the guests.",
    es: "Mesas redimensionadas a {seats} asientos. Vuelve a ejecutar la distribución automática para ajustar el número de mesas.",
    he: "גודל השולחנות שונה ל-{seats} מושבים. הפעל שוב פריסה אוטומטית כדי להתאים את מספר השולחנות לאורחים."
  },
  "dining.seatingAlreadySufficient": {
    en: "Seating is already sufficient for this event.",
    es: "El sentado ya es suficiente para este evento.",
    he: "ההושבה כבר מספיקה לאירוע הזה."
  },
  "dining.requiredTablesAdded": {
    en: "Required tables were added to the dining layout.",
    es: "Se agregaron las mesas necesarias a la distribución del comedor.",
    he: "השולחנות הנדרשים נוספו לפריסת חדר האוכל."
  },
  "dining.autoLayoutGenerated": {
    en: "Auto layout generated {men} men, {women} women, and {kids} kids tables.",
    es: "La distribución automática generó {men} mesas de hombres, {women} de mujeres y {kids} de niños.",
    he: "הפריסה האוטומטית יצרה {men} שולחנות גברים, {women} נשים ו-{kids} ילדים."
  },
  "dining.resetToPresetToast": {
    en: "Reset to {name}. Save the dining plan to keep it.",
    es: "Restablecido a {name}. Guarda el plan del comedor para conservarlo.",
    he: "אופס ל{name}. שמור את תוכנית חדר האוכל כדי לשמר זאת."
  },
  "dining.planSavedToast": {
    en: "Dining plan saved.",
    es: "Plan del comedor guardado.",
    he: "תוכנית חדר האוכל נשמרה."
  },
  "dining.savingPlanAria": {
    en: "Saving dining plan",
    es: "Guardando el plan del comedor",
    he: "שומר את תוכנית חדר האוכל"
  },
  "dining.savePlan": {
    en: "Save dining plan",
    es: "Guardar el plan del comedor",
    he: "שמירת תוכנית חדר האוכל"
  },
  "dining.timeNotSet": {
    en: "Time not set",
    es: "Hora sin definir",
    he: "לא נקבעה שעה"
  },
  "dining.men": { en: "Men", es: "Hombres", he: "גברים" },
  "dining.women": { en: "Women", es: "Mujeres", he: "נשים" },
  "dining.kids": { en: "Kids", es: "Niños", he: "ילדים" },
  "dining.tablecloth": {
    en: "Tablecloth",
    es: "Mantelería",
    he: "מפת שולחן"
  },
  "dining.washingStartTime": {
    en: "Washing start time",
    es: "Hora de inicio del lavado",
    he: "שעת תחילת הנטילה"
  },
  "dining.specialNotes": {
    en: "Special notes",
    es: "Notas especiales",
    he: "הערות מיוחדות"
  },
  "dining.savingPlan": {
    en: "Saving dining plan...",
    es: "Guardando el plan del comedor...",
    he: "שומר את תוכנית חדר האוכל..."
  },
  "dining.planSaved": {
    en: "Plan saved",
    es: "Plan guardado",
    he: "התוכנית נשמרה"
  },
  "dining.presetHint": {
    en: "Loaded from Hall Room Map preset with saved position and size.",
    es: "Cargado desde el preajuste del mapa del salón con posición y tamaño guardados.",
    he: "נטען מהגדרת מפת האולם עם המיקום והגודל השמורים."
  },
  "dining.noEventsYet": {
    en: "No dining events yet",
    es: "Aún no hay eventos de comedor",
    he: "אין עדיין אירועי חדר אוכל"
  },
  "dining.noEventsYetBody": {
    en: "Create an event before preparing a dining plan.",
    es: "Crea un evento antes de preparar un plan de comedor.",
    he: "צור אירוע לפני הכנת תוכנית חדר האוכל."
  },
  "dining.seatsPerTableHint": {
    en: "Used by Auto layout and the seating check. Read from your saved tables.",
    es: "Lo usan la distribución automática y la comprobación del sentado. Se lee de tus mesas guardadas.",
    he: "משמש את הפריסה האוטומטית ואת בדיקת ההושבה. נקרא מהשולחנות השמורים שלך."
  },
  "dining.planActionsHint": {
    en: "Use the top Save dining plan button to save seating, layout, service details, and notes.",
    es: "Usa el botón Guardar plan del comedor de arriba para guardar el sentado, la distribución, los detalles del servicio y las notas.",
    he: "השתמש בכפתור ״שמירת תוכנית חדר האוכל״ למעלה כדי לשמור הושבה, פריסה, פרטי שירות והערות."
  },
  "dining.events": { en: "Events", es: "Eventos", he: "אירועים" },
  "dining.eventPages": {
    en: "Dining event pages",
    es: "Páginas de eventos del comedor",
    he: "עמודי אירועי חדר האוכל"
  },
  "dining.nextEventPage": {
    en: "Next event page",
    es: "Página siguiente de eventos",
    he: "עמוד האירועים הבא"
  },
  "dining.previousEventPage": {
    en: "Previous event page",
    es: "Página anterior de eventos",
    he: "עמוד האירועים הקודם"
  },
  "dining.noEventsMatch": {
    en: "No events match the search.",
    es: "Ningún evento coincide con la búsqueda.",
    he: "אין אירועים שתואמים לחיפוש."
  },
  "dining.selectOrgEvent": {
    en: "Select an organization event.",
    es: "Selecciona un evento de la organización.",
    he: "בחר אירוע של הארגון."
  },
  "dining.mapGrid": {
    en: "Dining map grid",
    es: "Cuadrícula del mapa del comedor",
    he: "רשת מפת חדר האוכל"
  },
  "dining.hallMapPreset": {
    en: "Hall map preset",
    es: "Preajuste del mapa del salón",
    he: "הגדרת מפת האולם"
  },
  "dining.resetToPreset": {
    en: "Reset to preset",
    es: "Restablecer al preajuste",
    he: "איפוס להגדרה"
  },
  "dining.modifiedThisEvent": {
    en: "Modified - this event only",
    es: "Modificado: solo este evento",
    he: "שונה - לאירוע הזה בלבד"
  },
  "dining.mechitza": {
    en: "Mechitza",
    es: "Mechitzá",
    he: "מחיצה"
  },
  "dining.removeTable": {
    en: "Remove table",
    es: "Quitar mesa",
    he: "הסרת שולחן"
  },
  "dining.removeSelected": {
    en: "Remove selected",
    es: "Quitar lo seleccionado",
    he: "הסרת הנבחרים"
  },
  "dining.fit": { en: "Fit", es: "Ajustar", he: "התאמה" },
  "dining.zoomIn": {
    en: "Zoom dining map in",
    es: "Acercar el mapa del comedor",
    he: "הגדלת מפת חדר האוכל"
  },
  "dining.zoomOut": {
    en: "Zoom dining map out",
    es: "Alejar el mapa del comedor",
    he: "הקטנת מפת חדר האוכל"
  },
  "dining.resetZoom": {
    en: "Reset dining map zoom",
    es: "Restablecer el zoom del mapa",
    he: "איפוס הזום של המפה"
  }
});
