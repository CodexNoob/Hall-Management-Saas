import { defineMessages } from "@/lib/i18n/types";

/**
 * The kitchen board and everything it opens: the day/week/four-week views, the
 * event details dialog, the notifications drawer, the replace-dish picker, the
 * add-event form and the worker roster.
 */
export const kitchenMessages = defineMessages({
  "kitchen.today": { en: "Today", es: "Hoy", he: "היום" },
  "kitchen.thisWeek": { en: "This Week", es: "Esta semana", he: "השבוע" },
  "kitchen.fourWeeks": { en: "4 Weeks", es: "4 semanas", he: "4 שבועות" },
  "kitchen.openSidebar": {
    en: "Open sidebar",
    es: "Abrir navegación",
    he: "פתיחת ניווט"
  },
  "kitchen.closeSidebar": {
    en: "Close sidebar",
    es: "Cerrar navegación",
    he: "סגירת ניווט"
  },
  "kitchen.notifications": {
    en: "Open kitchen notifications",
    es: "Abrir notificaciones de cocina",
    he: "פתיחת התראות מטבח"
  },
  "kitchen.previousDates": {
    en: "Show previous dates",
    es: "Mostrar fechas anteriores",
    he: "הצגת תאריכים קודמים"
  },
  "kitchen.nextDates": {
    en: "Show next dates",
    es: "Mostrar fechas siguientes",
    he: "הצגת תאריכים הבאים"
  },
  "kitchen.currentTime": {
    en: "Current time",
    es: "Hora actual",
    he: "שעה נוכחית"
  },
  "kitchen.range": {
    en: "Kitchen board range",
    es: "Rango del tablero de cocina",
    he: "טווח לוח המטבח"
  },
  "kitchen.addEvent": {
    en: "Add kitchen event",
    es: "Agregar evento de cocina",
    he: "הוספת אירוע מטבח"
  },
  "kitchen.manageWorkers": {
    en: "Manage workers",
    es: "Gestionar trabajadores",
    he: "ניהול עובדים"
  },
  "kitchen.onlyAssigned": {
    en: "Show only my assigned items",
    es: "Mostrar solo mis elementos asignados",
    he: "הצג רק פריטים שהוקצו לי"
  },
  "kitchen.refresh": {
    en: "Refresh the kitchen board",
    es: "Actualizar el tablero de cocina",
    he: "רענון לוח המטבח"
  },
  "kitchen.noItems": {
    en: "No kitchen items scheduled for this day.",
    es: "No hay elementos de cocina programados para este día.",
    he: "אין פריטי מטבח מתוכננים ליום זה."
  },
  "kitchen.noneAssigned": {
    en: "Nothing assigned to you for this day.",
    es: "No tienes nada asignado para este día.",
    he: "לא הוקצה לך דבר ליום זה."
  },
  "kitchen.noEvents": {
    en: "No events",
    es: "No hay eventos",
    he: "אין אירועים"
  },
  "kitchen.updated": {
    en: "Updated {time}",
    es: "Actualizado {time}",
    he: "עודכן {time}"
  },
  "kitchen.noTime": { en: "No time", es: "Sin hora", he: "ללא שעה" },
  "kitchen.portionsCount": {
    en: "{count} portions",
    es: "{count} porciones",
    he: "{count} מנות"
  },
  "kitchen.complete": { en: "Complete", es: "Completado", he: "הושלם" },
  "kitchen.pending": { en: "Pending", es: "Pendiente", he: "בהמתנה" },
  "kitchen.notStarted": {
    en: "Not started",
    es: "Sin iniciar",
    he: "טרם התחיל"
  },
  "kitchen.servesAt": { en: "Serves at", es: "Se sirve a las", he: "מוגש ב" },
  "kitchen.serves": { en: "Serves", es: "Sirve", he: "מגיש" },
  "kitchen.portions": { en: "Portions", es: "Porciones", he: "מנות" },
  "kitchen.prepared": { en: "Prepared", es: "Preparado", he: "הוכן" },
  "kitchen.addOns": { en: "Add-ons", es: "Extras", he: "תוספות" },
  "kitchen.notCookedToRule": {
    en: "Not cooked to a rule",
    es: "No se cocina por regla",
    he: "לא מבושל לפי כלל"
  },
  "kitchen.retiredFromLibrary": {
    en: "Retired from the library",
    es: "Retirado de la biblioteca",
    he: "הוצא מהספרייה"
  },

  "kitchen.closeDetails": {
    en: "Close kitchen event details",
    es: "Cerrar los detalles del evento de cocina",
    he: "סגירת פרטי אירוע המטבח"
  },
  "kitchen.dishWorkflow": {
    en: "Dish workflow",
    es: "Flujo del plato",
    he: "תהליך המנה"
  },
  "kitchen.tapDishHint": {
    en: "Tap a dish card to move it forward",
    es: "Toca una tarjeta de plato para avanzarla",
    he: "הקש על כרטיס מנה כדי לקדם אותו"
  },
  "kitchen.dishNotStarted": {
    en: "Dish not started yet",
    es: "El plato aún no ha comenzado",
    he: "המנה טרם התחילה"
  },
  "kitchen.pendingInPrep": {
    en: "Pending / In prep",
    es: "Pendiente / En preparación",
    he: "בהמתנה / בהכנה"
  },
  "kitchen.completeReady": {
    en: "Complete / Ready",
    es: "Completado / Listo",
    he: "הושלם / מוכן"
  },
  "kitchen.noDishesInFilter": {
    en: "No dishes in this filter",
    es: "No hay platos en este filtro",
    he: "אין מנות במסנן הזה"
  },
  "kitchen.needsAttention": {
    en: "Needs attention",
    es: "Requiere atención",
    he: "דרושה תשומת לב"
  },
  "kitchen.pastEvent": {
    en: "Past event",
    es: "Evento pasado",
    he: "אירוע שעבר"
  },
  "kitchen.deleteEvent": {
    en: "Delete Event",
    es: "Eliminar evento",
    he: "מחיקת האירוע"
  },
  "kitchen.resetDishStatus": {
    en: "Reset dish status",
    es: "Restablecer el estado del plato",
    he: "איפוס סטטוס המנה"
  },
  "kitchen.resetDishStatusQuestion": {
    en: "Reset dish status?",
    es: "¿Restablecer el estado del plato?",
    he: "לאפס את סטטוס המנה?"
  },
  "kitchen.replace": { en: "Replace", es: "Reemplazar", he: "החלפה" },
  "kitchen.timeline": {
    en: "Timeline",
    es: "Cronología",
    he: "ציר זמן"
  },
  "kitchen.workerOwnership": {
    en: "Worker ownership",
    es: "Asignación de trabajadores",
    he: "אחריות עובדים"
  },
  "kitchen.unassigned": {
    en: "Unassigned",
    es: "Sin asignar",
    he: "לא הוקצה"
  },

  "kitchen.notificationsTitle": {
    en: "Kitchen Notifications",
    es: "Notificaciones de cocina",
    he: "התראות מטבח"
  },
  "kitchen.closeNotifications": {
    en: "Close kitchen notifications",
    es: "Cerrar las notificaciones de cocina",
    he: "סגירת התראות המטבח"
  },
  "kitchen.notificationFilter": {
    en: "Notification filter",
    es: "Filtro de notificaciones",
    he: "מסנן התראות"
  },
  "kitchen.filterAll": { en: "All", es: "Todas", he: "הכול" },
  "kitchen.filterNeedsAction": {
    en: "Needs action",
    es: "Requiere acción",
    he: "דורש פעולה"
  },
  "kitchen.filterAcknowledged": {
    en: "Acknowledged",
    es: "Confirmadas",
    he: "אושרו"
  },
  "kitchen.clearingEllipsis": {
    en: "Clearing…",
    es: "Borrando…",
    he: "מנקה…"
  },
  "kitchen.unacknowledged": {
    en: "Unacknowledged",
    es: "Sin confirmar",
    he: "ללא אישור"
  },
  "kitchen.acknowledgedBy": {
    en: "Acknowledged by:",
    es: "Confirmado por:",
    he: "אושר על ידי:"
  },
  "kitchen.nothingNeedsYou": {
    en: "Nothing here needs you.",
    es: "Aquí no hay nada que requiera tu atención.",
    he: "אין כאן דבר שדורש אותך."
  },
  "kitchen.changesWillAppear": {
    en: "Changes to events you're cooking will appear here.",
    es: "Los cambios en los eventos que cocinas aparecerán aquí.",
    he: "שינויים באירועים שאתה מבשל יופיעו כאן."
  },
  "kitchen.clearAllNotifications": {
    en: "Clear all notifications",
    es: "Borrar todas las notificaciones",
    he: "ניקוי כל ההתראות"
  },
  "kitchen.clearEveryNotification": {
    en: "Clear every notification?",
    es: "¿Borrar todas las notificaciones?",
    he: "לנקות את כל ההתראות?"
  },
  "kitchen.changeByEventManager": {
    en: "Change made by Event Manager",
    es: "Cambio realizado por el gestor de eventos",
    he: "שינוי שבוצע על ידי מנהל האירועים"
  },
  "kitchen.changedAt": {
    en: "Changed at",
    es: "Modificado a las",
    he: "שונה בשעה"
  },
  "kitchen.changedBy": {
    en: "Changed by",
    es: "Modificado por",
    he: "שונה על ידי"
  },
  "kitchen.changedItem": {
    en: "Changed item",
    es: "Elemento modificado",
    he: "פריט ששונה"
  },
  "kitchen.before": { en: "Before", es: "Antes", he: "לפני" },
  "kitchen.after": { en: "After", es: "Después", he: "אחרי" },
  "kitchen.response": {
    en: "Kitchen response",
    es: "Respuesta de la cocina",
    he: "תגובת המטבח"
  },
  "kitchen.meal": { en: "Meal", es: "Comida", he: "ארוחה" },
  "kitchen.hall": { en: "Hall", es: "Salón", he: "אולם" },

  "kitchen.closeReplacement": {
    en: "Close replacement picker",
    es: "Cerrar el selector de reemplazo",
    he: "סגירת בורר ההחלפה"
  },
  "kitchen.comingOff": {
    en: "Coming off",
    es: "Se retira",
    he: "יורד מהתפריט"
  },
  "kitchen.pickAnotherItem": {
    en: "Pick another item from the same menu section.",
    es: "Elige otro plato de la misma sección del menú.",
    he: "בחר פריט אחר מאותו מדור בתפריט."
  },
  "kitchen.whyReplaced": {
    en: "Why is this being replaced?",
    es: "¿Por qué se reemplaza?",
    he: "מדוע הפריט מוחלף?"
  },
  "kitchen.deliveryShort": {
    en: "Delivery was short",
    es: "La entrega fue incompleta",
    he: "המשלוח היה חסר"
  },
  "kitchen.searchDishes": {
    en: "Search dishes",
    es: "Buscar platos",
    he: "חיפוש מנות"
  },
  "kitchen.searchMenuLibrary": {
    en: "Search the menu library",
    es: "Buscar en la biblioteca del menú",
    he: "חיפוש בספריית התפריט"
  },

  "kitchen.addEventTitle": {
    en: "Add Kitchen Event",
    es: "Agregar evento de cocina",
    he: "הוספת אירוע מטבח"
  },
  "kitchen.closeAddEvent": {
    en: "Close add kitchen event",
    es: "Cerrar agregar evento de cocina",
    he: "סגירת הוספת אירוע המטבח"
  },
  "kitchen.eventNameRequired": {
    en: "Event name *",
    es: "Nombre del evento *",
    he: "שם האירוע *"
  },
  "kitchen.eventNamePlaceholder": {
    en: "e.g. School Lunch, Staff Meal...",
    es: "p. ej. Almuerzo escolar, Comida del personal...",
    he: "למשל ארוחת צהריים בבית ספר, ארוחת צוות..."
  },
  "kitchen.noteOptional": {
    en: "Note (optional)",
    es: "Nota (opcional)",
    he: "הערה (אופציונלי)"
  },
  "kitchen.notePlaceholder": {
    en: "Any kitchen notes...",
    es: "Notas de cocina...",
    he: "הערות מטבח..."
  },
  "kitchen.packages": { en: "Packages", es: "Paquetes", he: "חבילות" },
  "kitchen.noSavedPackages": {
    en: "No saved packages yet.",
    es: "Aún no hay paquetes guardados.",
    he: "אין עדיין חבילות שמורות."
  },
  "kitchen.buffetMenu": {
    en: "Buffet Menu",
    es: "Menú de bufé",
    he: "תפריט מזנון"
  },
  "kitchen.platedMenu": {
    en: "Plated Menu",
    es: "Menú emplatado",
    he: "תפריט מוגש"
  },
  "kitchen.drinkMenu": {
    en: "Drink Menu",
    es: "Menú de bebidas",
    he: "תפריט משקאות"
  },

  "kitchen.workers": {
    en: "Kitchen workers",
    es: "Trabajadores de cocina",
    he: "עובדי המטבח"
  },
  "kitchen.closeWorkers": {
    en: "Close kitchen workers",
    es: "Cerrar los trabajadores de cocina",
    he: "סגירת עובדי המטבח"
  },
  "kitchen.workersBlurb": {
    en: "The people a dish can be assigned to on the board.",
    es: "Las personas a las que se puede asignar un plato en el tablero.",
    he: "האנשים שניתן להקצות להם מנה בלוח."
  },
  "kitchen.addStaffMember": {
    en: "Add Kitchen Staff member",
    es: "Agregar miembro del personal de cocina",
    he: "הוספת חבר צוות מטבח"
  },
  "kitchen.selectStaffMember": {
    en: "Select a staff member",
    es: "Selecciona un miembro del personal",
    he: "בחר חבר צוות"
  },
  "kitchen.rosterUpToDate": {
    en: "Kitchen worker roster is up to date",
    es: "La lista de trabajadores de cocina está al día",
    he: "רשימת עובדי המטבח מעודכנת"
  },
  "kitchen.colour": { en: "Colour", es: "Color", he: "צבע" },
  "kitchen.rename": { en: "Rename", es: "Renombrar", he: "שינוי שם" },
  "kitchen.retire": { en: "Retire", es: "Retirar", he: "הוצאה משימוש" },
  "kitchen.retired": { en: "Retired", es: "Retirado", he: "הוצא משימוש" },
  "kitchen.restore": { en: "Restore", es: "Restaurar", he: "שחזור" },
  "kitchen.add": { en: "Add", es: "Agregar", he: "הוספה" },

  "kitchen.ackFailed": {
    en: "Could not acknowledge notification.",
    es: "No se pudo confirmar la notificación.",
    he: "לא ניתן היה לאשר את ההתראה."
  },
  "kitchen.ackAllFailed": {
    en: "Could not acknowledge all notifications.",
    es: "No se pudieron confirmar todas las notificaciones.",
    he: "לא ניתן היה לאשר את כל ההתראות."
  },
  "kitchen.clearAllFailed": {
    en: "Could not clear notifications.",
    es: "No se pudieron borrar las notificaciones.",
    he: "לא ניתן היה לנקות את ההתראות."
  },
  "kitchen.updateNotificationsFailed": {
    en: "Could not update notifications.",
    es: "No se pudieron actualizar las notificaciones.",
    he: "לא ניתן היה לעדכן את ההתראות."
  },
  "kitchen.deleteEventFailed": {
    en: "Could not delete this kitchen event.",
    es: "No se pudo eliminar este evento de cocina.",
    he: "לא ניתן היה למחוק את אירוע המטבח."
  },
  "kitchen.cancelEventFailed": {
    en: "Could not cancel this event.",
    es: "No se pudo cancelar este evento.",
    he: "לא ניתן היה לבטל את האירוע."
  },

  "kitchen.serveSeparately": {
    en: "serve separately",
    es: "servir por separado",
    he: "להגיש בנפרד"
  },
  "kitchen.wideScreen": {
    en: "wide screen",
    es: "pantalla ancha",
    he: "מסך רחב"
  },
  "kitchen.waitersNotCounted": {
    en: "{count} waiters not counted",
    es: "{count} camareros no contados",
    he: "{count} מלצרים לא נספרים"
  },
  "kitchen.pendingNotStarted": {
    en: "{pending} pending · {notStarted} not started",
    es: "{pending} pendientes · {notStarted} sin iniciar",
    he: "{pending} בהמתנה · {notStarted} טרם התחילו"
  },
  "kitchen.deleteEventConfirm": {
    en: "Delete “{name}”? A kitchen event belongs to no booking, so this removes it outright, along with any progress recorded against its dishes. It cannot be undone.",
    es: "¿Eliminar “{name}”? Un evento de cocina no pertenece a ninguna reserva, así que se borra por completo junto con el progreso registrado en sus platos. No se puede deshacer.",
    he: "למחוק את “{name}”? אירוע מטבח אינו שייך להזמנה, ולכן הוא יימחק לגמרי יחד עם כל ההתקדמות שנרשמה למנותיו. לא ניתן לבטל."
  },
  "kitchen.cancelEventConfirm": {
    en: "Cancel “{name}”? It leaves the kitchen board and the calendar, and everything it holds stays in the system - menu, guest counts, invoices and history. Cancelling cannot be undone from here.",
    es: "¿Cancelar “{name}”? Sale del tablero de cocina y del calendario, y todo lo que contiene permanece en el sistema: menú, número de invitados, facturas e historial. La cancelación no se puede deshacer desde aquí.",
    he: "לבטל את “{name}”? האירוע יורד מלוח המטבח ומלוח השנה, וכל מה שהוא מחזיק נשאר במערכת - תפריט, מספרי אורחים, חשבוניות והיסטוריה. לא ניתן לבטל את הפעולה מכאן."
  },
  "kitchen.cancelling": {
    en: "Cancelling…",
    es: "Cancelando…",
    he: "מבטל…"
  },
  "kitchen.openEvent": {
    en: "Open {name} kitchen event",
    es: "Abrir el evento de cocina {name}",
    he: "פתיחת אירוע המטבח {name}"
  },
  "kitchen.addEventOn": {
    en: "Add kitchen event on {date}",
    es: "Agregar evento de cocina el {date}",
    he: "הוספת אירוע מטבח בתאריך {date}"
  },
  "kitchen.clearAllConfirm": {
    en: "Clear all {count} kitchen notifications? This deletes them for everyone in the organization, along with the record of who acknowledged what. It cannot be undone.",
    es: "¿Borrar las {count} notificaciones de cocina? Se eliminan para todos en la organización, junto con el registro de quién confirmó qué. No se puede deshacer.",
    he: "לנקות את כל {count} התראות המטבח? הן יימחקו עבור כל מי שבארגון, יחד עם הרישום של מי אישר מה. לא ניתן לבטל."
  },
  "kitchen.otherDishOne": {
    en: "None of this event's {count} dish is assigned to you.",
    es: "Ninguno de los {count} plato de este evento está asignado a ti.",
    he: "אף אחת מ-{count} המנות של האירוע לא הוקצתה לך."
  },
  "kitchen.otherDishMany": {
    en: "None of this event's {count} dishes are assigned to you.",
    es: "Ninguno de los {count} platos de este evento está asignado a ti.",
    he: "אף אחת מ-{count} המנות של האירוע לא הוקצתה לך."
  },

  "kitchen.needsBases": {
    en: "Needs {bases}",
    es: "Faltan {bases}",
    he: "חסרים {bases}"
  },
  "kitchen.needsDiningPlan": {
    en: "Needs the dining plan",
    es: "Requiere el plan del comedor",
    he: "דרושה תוכנית חדר האוכל"
  },
  "kitchen.needsServiceStyle": {
    en: "Needs a service style",
    es: "Requiere un estilo de servicio",
    he: "דרוש סגנון הגשה"
  },
  "kitchen.noCountingRuleSet": {
    en: "No counting rule set",
    es: "Sin regla de conteo",
    he: "לא הוגדר כלל ספירה"
  },
  "kitchen.beforeRounding": {
    en: "{value} before rounding",
    es: "{value} antes de redondear",
    he: "{value} לפני עיגול"
  },
  "kitchen.refreshing": {
    en: "Refreshing…",
    es: "Actualizando…",
    he: "מרענן…"
  },
  // The supporting line under the heading when the board is on a single day
  // within a day of now.
  "kitchen.yesterday": {
    en: "Yesterday",
    es: "Ayer",
    he: "אתמול"
  },
  "kitchen.tomorrow": {
    en: "Tomorrow",
    es: "Mañana",
    he: "מחר"
  },
  "kitchen.thisWeekHeading": {
    en: "This Week",
    es: "Esta semana",
    he: "השבוע"
  },
  "kitchen.fourWeeksHeading": {
    en: "4 Weeks",
    es: "4 semanas",
    he: "4 שבועות"
  },

  "kitchen.alreadyOnMenu": {
    en: "Already on this menu",
    es: "Ya está en este menú",
    he: "כבר בתפריט הזה"
  },
  "kitchen.addOnLabel": {
    en: "Add-on",
    es: "Extra",
    he: "תוספת"
  },
  "kitchen.willBeServed": {
    en: "Will be served {style}",
    es: "Se servirá {style}",
    he: "יוגש {style}"
  },
  "kitchen.servedBothWays": {
    en: "Served both ways - needs a style set on the Menu tab",
    es: "Se sirve de ambas formas: requiere un estilo en la pestaña Menú",
    he: "מוגש בשתי הדרכים - דרוש סגנון בלשונית התפריט"
  },
  "kitchen.noRuleNoQuantity": {
    en: "No counting rule, so there is no quantity to cook to",
    es: "Sin regla de conteo, así que no hay cantidad que cocinar",
    he: "אין כלל ספירה, ולכן אין כמות לבשל"
  },
  "kitchen.sayWhyReplaced": {
    en: "Say why it is being replaced",
    es: "Indica por qué se reemplaza",
    he: "ציין מדוע הפריט מוחלף"
  },
  "kitchen.replaceFailed": {
    en: "Could not replace the dish.",
    es: "No se pudo reemplazar el plato.",
    he: "לא ניתן היה להחליף את המנה."
  },
  "kitchen.anAddOn": {
    en: "an add-on",
    es: "un extra",
    he: "תוספת"
  },
  "kitchen.nothingMatchesSearch": {
    en: "Nothing in the menu library matches “{query}”.",
    es: "Nada en la biblioteca del menú coincide con “{query}”.",
    he: "אין בספריית התפריט פריט שתואם ל“{query}”."
  },
  "kitchen.noOtherItem": {
    en: "There is no other item in this section to swap this one for.",
    es: "No hay otro plato en esta sección por el que cambiarlo.",
    he: "אין פריט אחר במדור הזה להחליף בו."
  },
  "kitchen.replacing": {
    en: "Replacing…",
    es: "Reemplazando…",
    he: "מחליף…"
  },

  "kitchen.enterEventName": {
    en: "Enter an event name.",
    es: "Introduce un nombre de evento.",
    he: "הזן שם אירוע."
  },
  "kitchen.chooseItems": {
    en: "Choose food items, drinks, add-ons, or a menu template.",
    es: "Elige platos, bebidas, extras o una plantilla de menú.",
    he: "בחר מנות, משקאות, תוספות או תבנית תפריט."
  },
  "kitchen.enterPortionCount": {
    en: "Enter a portion count.",
    es: "Introduce un número de porciones.",
    he: "הזן מספר מנות."
  },
  "kitchen.saveEventFailed": {
    en: "Unable to save this kitchen event.",
    es: "No se pudo guardar este evento de cocina.",
    he: "לא ניתן לשמור את אירוע המטבח."
  },
  "kitchen.saveEvent": {
    en: "Save Event",
    es: "Guardar evento",
    he: "שמירת האירוע"
  },
  "kitchen.saveChangesFailed": {
    en: "Unable to save changes.",
    es: "No se pudieron guardar los cambios.",
    he: "לא ניתן לשמור את השינויים."
  },

  "kitchen.dishAria": {
    en: "{dish} — {status}. Click to move on, double-click to request a reset.",
    es: "{dish} — {status}. Haz clic para avanzarlo, doble clic para pedir un restablecimiento.",
    he: "{dish} — {status}. לחץ כדי לקדם, לחיצה כפולה לבקשת איפוס."
  },
  "kitchen.resetDescription": {
    en: "Reset “{dish}” from {status} to Not started? This removes its recorded progress.",
    es: "¿Restablecer “{dish}” de {status} a Sin iniciar? Se borrará el progreso registrado.",
    he: "לאפס את “{dish}” מ-{status} ל״טרם התחיל״? הפעולה מוחקת את ההתקדמות שנרשמה."
  },
  "kitchen.changeHistory": {
    en: "Change history & acknowledgments",
    es: "Historial de cambios y confirmaciones",
    he: "היסטוריית שינויים ואישורים"
  },
  "kitchen.yourEventChanges": {
    en: "Changes to the events you're cooking",
    es: "Cambios en los eventos que cocinas",
    he: "שינויים באירועים שאתה מבשל"
  },
  "kitchen.acknowledgeAll": {
    en: "Acknowledge all",
    es: "Confirmar todo",
    he: "אישור הכול"
  },
  "kitchen.acknowledging": {
    en: "Acknowledging...",
    es: "Confirmando...",
    he: "מאשר..."
  },
  "kitchen.acknowledgeNow": {
    en: "Acknowledge now",
    es: "Confirmar ahora",
    he: "אישור עכשיו"
  },
  "kitchen.savingAcknowledgment": {
    en: "Saving acknowledgment...",
    es: "Guardando la confirmación...",
    he: "שומר את האישור..."
  },
  "kitchen.clearNotifications": {
    en: "Clear notifications",
    es: "Borrar notificaciones",
    he: "ניקוי התראות"
  },
  "kitchen.clearing": {
    en: "Clearing...",
    es: "Borrando...",
    he: "מנקה..."
  },
  "kitchen.clearFailed": {
    en: "The notifications could not be cleared. Please try again.",
    es: "No se pudieron borrar las notificaciones. Inténtalo de nuevo.",
    he: "לא ניתן היה לנקות את ההתראות. נסה שוב."
  },
  "kitchen.noNotifications": {
    en: "No kitchen notifications.",
    es: "No hay notificaciones de cocina.",
    he: "אין התראות מטבח."
  },
  "kitchen.nothingAcknowledged": {
    en: "Nothing has been acknowledged yet.",
    es: "Aún no se ha confirmado nada.",
    he: "עדיין לא אושר דבר."
  },
  "kitchen.nothingWaiting": {
    en: "Nothing is waiting to be acknowledged.",
    es: "No hay nada pendiente de confirmar.",
    he: "אין דבר שממתין לאישור."
  },
  "kitchen.viewChanges": {
    en: "View changes",
    es: "Ver cambios",
    he: "הצגת השינויים"
  },
  "kitchen.hideChanges": {
    en: "Hide changes",
    es: "Ocultar cambios",
    he: "הסתרת השינויים"
  },
  "kitchen.waitingForAck": {
    en: "Waiting for kitchen acknowledgment",
    es: "Esperando la confirmación de la cocina",
    he: "ממתין לאישור המטבח"
  },
  "kitchen.menuChanged": {
    en: "Menu Changed",
    es: "Menú modificado",
    he: "התפריט שונה"
  },
  "kitchen.suddenEvent": {
    en: "Sudden Event",
    es: "Evento imprevisto",
    he: "אירוע פתאומי"
  },
  "kitchen.menuStatus": {
    en: "Menu status",
    es: "Estado del menú",
    he: "סטטוס התפריט"
  },
  "kitchen.eventSchedule": {
    en: "Event schedule",
    es: "Programa del evento",
    he: "לוח הזמנים של האירוע"
  },
  "kitchen.menuItemsOnEvent": {
    en: "Menu items now on this event",
    es: "Platos que ahora tiene este evento",
    he: "פריטי התפריט שכעת באירוע הזה"
  },
  "kitchen.yourDishesOnEvent": {
    en: "Your dishes on this event",
    es: "Tus platos en este evento",
    he: "המנות שלך באירוע הזה"
  },
  "kitchen.emailLabel": { en: "Email:", es: "Correo:", he: "דוא״ל:" },

  "kitchen.allDishes": {
    en: "All dishes",
    es: "Todos los platos",
    he: "כל המנות"
  },
  "kitchen.assignedDishes": {
    en: "Assigned dishes",
    es: "Platos asignados",
    he: "מנות שהוקצו"
  },
  "kitchen.myAssigned": {
    en: "My assigned",
    es: "Asignados a mí",
    he: "הוקצו לי"
  },
  "kitchen.buffetItems": {
    en: "Buffet items",
    es: "Platos de bufé",
    he: "פריטי מזנון"
  },
  "kitchen.platedItems": {
    en: "Plated items",
    es: "Platos emplatados",
    he: "פריטים מוגשים"
  },
  "kitchen.otherItems": {
    en: "Other items",
    es: "Otros platos",
    he: "פריטים אחרים"
  },
  "kitchen.noDishesOnMenu": {
    en: "No dishes on this menu yet",
    es: "Aún no hay platos en este menú",
    he: "אין עדיין מנות בתפריט הזה"
  },
  "kitchen.noAssignedDishes": {
    en: "No assigned dishes on this menu yet",
    es: "Aún no hay platos asignados en este menú",
    he: "אין עדיין מנות שהוקצו בתפריט הזה"
  },
  "kitchen.addDishesHint": {
    en: "Add dishes on the event's Menu tab and this sheet fills in with what to cook.",
    es: "Agrega platos en la pestaña Menú del evento y esta hoja se llenará con lo que hay que cocinar.",
    he: "הוסף מנות בלשונית התפריט של האירוע והגיליון הזה יתמלא במה שיש לבשל."
  },
  "kitchen.assignWorkerHint": {
    en: "Assign a worker to a dish to make it appear in this filtered view.",
    es: "Asigna un trabajador a un plato para que aparezca en esta vista filtrada.",
    he: "הקצה עובד למנה כדי שתופיע בתצוגה המסוננת הזו."
  },
  "kitchen.noMenuBehindEvent": {
    en: "No menu behind this event",
    es: "Este evento no tiene menú detrás",
    he: "אין תפריט מאחורי האירוע הזה"
  },
  "kitchen.eventStartTime": {
    en: "Event start time",
    es: "Hora de inicio del evento",
    he: "שעת תחילת האירוע"
  },
  "kitchen.noStartTime": {
    en: "No start time set",
    es: "Sin hora de inicio",
    he: "לא נקבעה שעת התחלה"
  },
  "kitchen.guestsExcludingWaiters": {
    en: "Guests, waiters excluded",
    es: "Invitados, sin contar camareros",
    he: "אורחים, ללא מלצרים"
  },
  "kitchen.everyDishHasQuantity": {
    en: "Every dish has a quantity",
    es: "Todos los platos tienen cantidad",
    he: "לכל מנה יש כמות"
  },
  "kitchen.dishesWithoutQuantity": {
    en: "Dishes with no quantity to cook to",
    es: "Platos sin cantidad que cocinar",
    he: "מנות ללא כמות לבישול"
  },
  "kitchen.nothingToCount": {
    en: "Nothing to count",
    es: "Nada que contar",
    he: "אין מה לספור"
  },
  "kitchen.onHoldNotConfirmed": {
    en: "On hold - not confirmed",
    es: "En espera: no confirmado",
    he: "בהמתנה - לא אושר"
  },
  "kitchen.cancelThisEvent": {
    en: "Cancel this event",
    es: "Cancelar este evento",
    he: "ביטול האירוע"
  },
  "kitchen.cancelThisEventQuestion": {
    en: "Cancel this event?",
    es: "¿Cancelar este evento?",
    he: "לבטל את האירוע?"
  },
  "kitchen.deleteThisEvent": {
    en: "Delete this kitchen event",
    es: "Eliminar este evento de cocina",
    he: "מחיקת אירוע המטבח"
  },
  "kitchen.deleteThisEventQuestion": {
    en: "Delete this kitchen event?",
    es: "¿Eliminar este evento de cocina?",
    he: "למחוק את אירוע המטבח?"
  },
  "kitchen.changeNotSaved": {
    en: "That change was not saved.",
    es: "Ese cambio no se guardó.",
    he: "השינוי לא נשמר."
  },
  "kitchen.resetFailed": {
    en: "The dish status could not be reset. Please try again.",
    es: "No se pudo restablecer el estado del plato. Inténtalo de nuevo.",
    he: "לא ניתן היה לאפס את סטטוס המנה. נסה שוב."
  },
  "kitchen.cancelFailed": {
    en: "The event could not be cancelled. Please try again.",
    es: "No se pudo cancelar el evento. Inténtalo de nuevo.",
    he: "לא ניתן היה לבטל את האירוע. נסה שוב."
  },
  "kitchen.deleteFailed": {
    en: "The kitchen event could not be deleted. Please try again.",
    es: "No se pudo eliminar el evento de cocina. Inténtalo de nuevo.",
    he: "לא ניתן היה למחוק את אירוע המטבח. נסה שוב."
  },
  "kitchen.workerRemoved": {
    en: "Worker assignment removed.",
    es: "Asignación de trabajador eliminada.",
    he: "הקצאת העובד הוסרה."
  },
  "kitchen.resettingEllipsis": {
    en: "Resetting…",
    es: "Restableciendo…",
    he: "מאפס…"
  },
  "kitchen.noProductionSheet": {
    en: "No production sheet",
    es: "Sin hoja de producción",
    he: "אין גיליון ייצור"
  },
  "kitchen.noProductionSheetBody": {
    en: "This kitchen event does not have any dishes to track yet.",
    es: "Este evento de cocina aún no tiene platos que seguir.",
    he: "לאירוע המטבח הזה אין עדיין מנות למעקב."
  },
  "kitchen.summaryLoaded": {
    en: "Production summary loaded",
    es: "Resumen de producción cargado",
    he: "סיכום הייצור נטען"
  },
  "kitchen.summaryLoadedBody": {
    en: "Open this event to load its full production sheet.",
    es: "Abre este evento para cargar su hoja de producción completa.",
    he: "פתח את האירוע כדי לטעון את גיליון הייצור המלא."
  },
  "kitchen.chooseAnotherFilter": {
    en: "Choose another ownership filter or assign workers to the dish cards below.",
    es: "Elige otro filtro de asignación o asigna trabajadores a las tarjetas de abajo.",
    he: "בחר מסנן אחר או הקצה עובדים לכרטיסי המנות שלמטה."
  },
  "kitchen.clickDishHint": {
    en: "Click a dish to move it on — not started, then pending, then complete. Double-click to put it back to not started.",
    es: "Haz clic en un plato para avanzarlo: sin iniciar, pendiente y completado. Doble clic para volver a sin iniciar.",
    he: "לחץ על מנה כדי לקדם אותה — טרם התחיל, בהמתנה, הושלם. לחיצה כפולה מחזירה ל״טרם התחיל״."
  },
  "kitchen.quantitiesFromMenu": {
    en: "Quantities come from the counting rules on the event's Menu tab.",
    es: "Las cantidades provienen de las reglas de conteo de la pestaña Menú del evento.",
    he: "הכמויות מגיעות מכללי הספירה בלשונית התפריט של האירוע."
  },
  "kitchen.replaceHint": {
    en: " Replace swaps one dish for another on that same menu, so the change reaches everyone reading it. Adding and removing dishes is still done there.",
    es: " Reemplazar cambia un plato por otro en ese mismo menú, así el cambio llega a todos. Agregar y quitar platos se sigue haciendo allí.",
    he: " החלפה מחליפה מנה באחרת באותו תפריט, כך שהשינוי מגיע לכל מי שקורא אותו. הוספה והסרה של מנות עדיין נעשות שם."
  },
  "kitchen.menuTabHint": {
    en: " That tab is also where dishes are added and removed.",
    es: " En esa pestaña también se agregan y quitan platos.",
    he: " בלשונית הזו גם מוסיפים ומסירים מנות."
  },

  // Meal names. "Shabbos Day" and "Seudah Shlishis" are transliterated Hebrew
  // that the English and Spanish boards keep as-is; the Hebrew board spells
  // them properly.
  "kitchen.mealMain": { en: "Main", es: "Principal", he: "עיקרית" },
  "kitchen.mealFridayNight": {
    en: "Friday Night",
    es: "Viernes por la noche",
    he: "ליל שבת"
  },
  "kitchen.mealShabbosDay": {
    en: "Shabbos Day",
    es: "Shabbos de día",
    he: "שבת ביום"
  },
  "kitchen.mealSeudahShlishis": {
    en: "Seudah Shlishis",
    es: "Seudah Shlishis",
    he: "סעודה שלישית"
  },
  "kitchen.mealSuffix": {
    en: "{meal} meal",
    es: "Comida: {meal}",
    he: "ארוחת {meal}"
  },
  "kitchen.noDishes": {
    en: "No dishes",
    es: "Sin platos",
    he: "אין מנות"
  },
  "kitchen.progressDone": {
    en: "{complete}/{dishes} done",
    es: "{complete}/{dishes} listos",
    he: "{complete}/{dishes} הושלמו"
  },
  "kitchen.mealNotShownOne": {
    en: "+1 meal not shown",
    es: "+1 comida no mostrada",
    he: "+ארוחה אחת לא מוצגת"
  },
  "kitchen.mealsNotShownMany": {
    en: "+{count} meals not shown",
    es: "+{count} comidas no mostradas",
    he: "+{count} ארוחות לא מוצגות"
  },
  "kitchen.listAnd": {
    en: "{list} and {last}",
    es: "{list} y {last}",
    he: "{list} ו{last}"
  },
  "kitchen.needsQuantityOne": {
    en: "1 needs a quantity",
    es: "1 necesita cantidad",
    he: "אחד זקוק לכמות"
  },
  "kitchen.needsQuantityMany": {
    en: "{count} need a quantity",
    es: "{count} necesitan cantidad",
    he: "{count} זקוקים לכמות"
  },
  "kitchen.eventCountNone": {
    en: "No events",
    es: "No hay eventos",
    he: "אין אירועים"
  },
  "kitchen.eventCountOne": {
    en: "1 event",
    es: "1 evento",
    he: "אירוע אחד"
  },
  "kitchen.eventCountMany": {
    en: "{count} events",
    es: "{count} eventos",
    he: "{count} אירועים"
  },
  "kitchen.confirmedMenuWarning": {
    en: "This menu is confirmed, so the client has already been shown it. Replacing a dish changes what they were promised - tell whoever is running the event.",
    es: "Este menú está confirmado, así que el cliente ya lo ha visto. Reemplazar un plato cambia lo que se le prometió: avisa a quien dirige el evento.",
    he: "התפריט הזה אושר, ולכן הלקוח כבר ראה אותו. החלפת מנה משנה את מה שהובטח לו - עדכן את מי שמנהל את האירוע."
  },
  "kitchen.noPermissionAddEvent": {
    en: "You do not have permission to add kitchen events. Contact an administrator if you need access.",
    es: "No tienes permiso para agregar eventos de cocina. Contacta a un administrador si necesitas acceso.",
    he: "אין לך הרשאה להוסיף אירועי מטבח. פנה למנהל אם נדרשת לך גישה."
  },
  "kitchen.noPermissionWorkers": {
    en: "You do not have permission to manage kitchen workers. Contact an administrator if you need access.",
    es: "No tienes permiso para gestionar los trabajadores de cocina. Contacta a un administrador si necesitas acceso.",
    he: "אין לך הרשאה לנהל את עובדי המטבח. פנה למנהל אם נדרשת לך גישה."
  },
  "kitchen.rosterCompleteBody": {
    en: "Everyone currently designated as a kitchen worker is already on this board. Change production access from the Staff page.",
    es: "Todos los designados como trabajadores de cocina ya están en este tablero. Cambia el acceso de producción desde la página de Personal.",
    he: "כל מי שמוגדר כעובד מטבח כבר נמצא בלוח הזה. שנה את גישת הייצור מעמוד הצוות."
  },
  "kitchen.noWorkersYet": {
    en: "No kitchen workers yet",
    es: "Aún no hay trabajadores de cocina",
    he: "אין עדיין עובדי מטבח"
  },
  "kitchen.noWorkersBody": {
    en: "Add the people who cook, and they become assignable on every dish.",
    es: "Agrega a quienes cocinan y podrás asignarlos a cada plato.",
    he: "הוסף את מי שמבשל, וניתן יהיה להקצות אותם לכל מנה."
  }
});
