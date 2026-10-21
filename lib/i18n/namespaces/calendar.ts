import { defineMessages } from "@/lib/i18n/types";

/** Calendar page: month/week/agenda views, availability, and calendar settings. */
export const calendarMessages = defineMessages({
  "calendar.title": { en: "Calendar", es: "Calendario", he: "לוח שנה" },
  "calendar.blurb": {
    en: "Review hall availability, bookings, holds, and fully booked dates.",
    es: "Revisa la disponibilidad de salones, reservas, retenciones y fechas completas.",
    he: "בדיקת זמינות אולמות, הזמנות, שמירות ותאריכים מלאים."
  },
  "calendar.views": {
    en: "Calendar views",
    es: "Vistas del calendario",
    he: "תצוגות לוח השנה"
  },
  "calendar.hallAvailability": {
    en: "Hall availability",
    es: "Disponibilidad de salones",
    he: "זמינות האולמות"
  },
  "calendar.availability": {
    en: "Availability",
    es: "Disponibilidad",
    he: "זמינות"
  },
  "calendar.availabilityRange": {
    en: "Availability Range",
    es: "Rango de disponibilidad",
    he: "טווח זמינות"
  },
  "calendar.settings": {
    en: "Settings",
    es: "Configuración",
    he: "הגדרות"
  },
  "calendar.today": { en: "Today", es: "Hoy", he: "היום" },
  "calendar.blocked": { en: "Blocked", es: "Bloqueado", he: "חסום" },
  "calendar.fullyBooked": {
    en: "Fully booked",
    es: "Completo",
    he: "תפוס לגמרי"
  },
  "calendar.openSlots": {
    en: "Open slots",
    es: "Espacios libres",
    he: "מקומות פנויים"
  },
  "calendar.available": {
    en: "Available",
    es: "Disponible",
    he: "זמין"
  },
  "calendar.full": { en: "Full", es: "Lleno", he: "מלא" },
  "calendar.hold": { en: "Hold", es: "Retención", he: "שמירה" },
  "calendar.confirmed": {
    en: "Confirmed",
    es: "Confirmado",
    he: "מאושר"
  },
  "calendar.school": { en: "School", es: "Escuela", he: "בית ספר" },
  "calendar.allHalls": {
    en: "All halls",
    es: "Todos los salones",
    he: "כל האולמות"
  },
  "calendar.allStatuses": {
    en: "All statuses",
    es: "Todos los estados",
    he: "כל הסטטוסים"
  },
  "calendar.allTypes": {
    en: "All types",
    es: "Todos los tipos",
    he: "כל הסוגים"
  },
  "calendar.bookDate": {
    en: "Book date",
    es: "Reservar fecha",
    he: "הזמנת תאריך"
  },
  "calendar.blockDate": {
    en: "Block date",
    es: "Bloquear fecha",
    he: "חסימת תאריך"
  },
  "calendar.hall": { en: "Hall", es: "Salón", he: "אולם" },
  "calendar.selectHall": {
    en: "Select a hall",
    es: "Selecciona un salón",
    he: "בחר אולם"
  },
  "calendar.selectRange": {
    en: "Select range",
    es: "Selecciona un rango",
    he: "בחר טווח"
  },
  "calendar.selectDateRange": {
    en: "Select date range",
    es: "Selecciona un rango de fechas",
    he: "בחר טווח תאריכים"
  },
  "calendar.startDate": {
    en: "Start date",
    es: "Fecha de inicio",
    he: "תאריך התחלה"
  },
  "calendar.endDate": {
    en: "End date",
    es: "Fecha de fin",
    he: "תאריך סיום"
  },
  "calendar.usesDefault": {
    en: "Uses Calendar default",
    es: "Usa el valor predeterminado del calendario",
    he: "משתמש בברירת המחדל של לוח השנה"
  },
  "calendar.settingsTitle": {
    en: "Calendar Settings",
    es: "Configuración del calendario",
    he: "הגדרות לוח השנה"
  },
  "calendar.blockedRanges": {
    en: "Blocked ranges",
    es: "Rangos bloqueados",
    he: "טווחים חסומים"
  },
  "calendar.addBlockedRange": {
    en: "Add blocked range",
    es: "Agregar rango bloqueado",
    he: "הוספת טווח חסום"
  },
  "calendar.manageBlockedRanges": {
    en: "Manage blocked date ranges.",
    es: "Gestiona los rangos de fechas bloqueados.",
    he: "ניהול טווחי תאריכים חסומים."
  },
  "calendar.blockedRangesBlurb": {
    en: "Blocked ranges will not show in Availability and cannot be booked.",
    es: "Los rangos bloqueados no aparecen en Disponibilidad y no se pueden reservar.",
    he: "טווחים חסומים לא יופיעו בזמינות ולא ניתן להזמין אותם."
  },
  "calendar.noBlockedRanges": {
    en: "No blocked date ranges.",
    es: "No hay rangos de fechas bloqueados.",
    he: "אין טווחי תאריכים חסומים."
  },
  "calendar.dailyEventLimit": {
    en: "Daily event limit",
    es: "Límite diario de eventos",
    he: "מגבלת אירועים יומית"
  },
  "calendar.dailyLimitBlurb": {
    en: "Choose how many active events can be booked on the same date.",
    es: "Elige cuántos eventos activos se pueden reservar en la misma fecha.",
    he: "בחר כמה אירועים פעילים ניתן להזמין באותו תאריך."
  },
  "calendar.eventsPerDay": {
    en: "Events allowed per day",
    es: "Eventos permitidos por día",
    he: "אירועים מותרים ליום"
  },
  "calendar.hallDailyLimits": {
    en: "Hall daily limits",
    es: "Límites diarios por salón",
    he: "מגבלות יומיות לאולם"
  },
  "calendar.hallDailyLimitsBlurb": {
    en: "Each saved hall uses this daily booking limit.",
    es: "Cada salón guardado usa este límite diario de reservas.",
    he: "כל אולם שנשמר משתמש במגבלת ההזמנות היומית הזו."
  },
  "calendar.noBookableHalls": {
    en: "No bookable halls are saved yet. Add halls in Settings.",
    es: "Aún no hay salones reservables guardados. Agrega salones en Configuración.",
    he: "עדיין לא נשמרו אולמות להזמנה. הוסף אולמות בהגדרות."
  },
  "calendar.closeBooking": {
    en: "Close calendar booking",
    es: "Cerrar la reserva del calendario",
    he: "סגירת ההזמנה בלוח השנה"
  },
  "calendar.otherEventType": {
    en: "Other event type",
    es: "Otro tipo de evento",
    he: "סוג אירוע אחר"
  },
  "calendar.typeNewEventType": {
    en: "Type new event type",
    es: "Escribe un nuevo tipo de evento",
    he: "הקלד סוג אירוע חדש"
  },
  "calendar.noBookableHallsYet": {
    en: "No bookable halls yet",
    es: "Aún no hay salones reservables",
    he: "אין עדיין אולמות להזמנה"
  },
  "calendar.chooseHallToSee": {
    en: "Choose a hall to see its availability",
    es: "Elige un salón para ver su disponibilidad",
    he: "בחר אולם כדי לראות את זמינותו"
  },
  "calendar.addHallInSettings": {
    en: "Add a bookable hall in Settings, then come back to read its open dates.",
    es: "Agrega un salón reservable en Configuración y vuelve para ver sus fechas libres.",
    he: "הוסף אולם להזמנה בהגדרות, וחזור לכאן כדי לראות את התאריכים הפנויים."
  },
  "calendar.everyCountBelongsToHall": {
    en: "Every count on this tab - open slots, holds, blocked days - belongs to one hall, so there is nothing to show until you pick one.",
    es: "Cada recuento de esta pestaña - espacios libres, retenciones, días bloqueados - pertenece a un salón, así que no hay nada que mostrar hasta que elijas uno.",
    he: "כל ספירה בלשונית הזו - מקומות פנויים, שמירות, ימים חסומים - שייכת לאולם אחד, ולכן אין מה להציג עד שתבחר אחד."
  },
  "calendar.slotsAvailable": {
    en: "{count} event slots available",
    es: "{count} espacios disponibles",
    he: "{count} מקומות פנויים"
  },
  "calendar.allHallsOption": {
    en: "All halls",
    es: "Todos los salones",
    he: "כל האולמות"
  },
  "calendar.saveLimit": {
    en: "Save limit",
    es: "Guardar límite",
    he: "שמירת המגבלה"
  },
  "calendar.chooseHallToClose": {
    en: "Choose the hall this range closes.",
    es: "Elige el salón que cierra este rango.",
    he: "בחר את האולם שהטווח הזה סוגר."
  },
  "calendar.weekCalendar": {
    en: "Week Calendar",
    es: "Calendario semanal",
    he: "לוח שבועי"
  },
  "calendar.monthCalendar": {
    en: "Month Calendar",
    es: "Calendario mensual",
    he: "לוח חודשי"
  },
  "calendar.blockedRange": {
    en: "Blocked {from} to {to}",
    es: "Bloqueado del {from} al {to}",
    he: "חסום מ-{from} עד {to}"
  },
  "calendar.everyBookedDay": {
    en: "Every booked day this month, in date order.",
    es: "Todos los días reservados de este mes, por orden de fecha.",
    he: "כל הימים התפוסים החודש, לפי סדר התאריכים."
  },
  "calendar.clickBookableDay": {
    en: "Click any bookable day to start a booking on that date.",
    es: "Haz clic en cualquier día reservable para iniciar una reserva en esa fecha.",
    he: "לחץ על יום פנוי כדי להתחיל הזמנה באותו תאריך."
  },
  "calendar.clickDayToReview": {
    en: "Click a day to review the schedule, or + to book it.",
    es: "Haz clic en un día para revisar el programa, o en + para reservarlo.",
    he: "לחץ על יום כדי לבדוק את הלוח, או על + כדי להזמין."
  },
  "calendar.showPreviousWeek": {
    en: "Show previous week",
    es: "Mostrar la semana anterior",
    he: "הצגת השבוע הקודם"
  },
  "calendar.showPreviousMonth": {
    en: "Show previous month",
    es: "Mostrar el mes anterior",
    he: "הצגת החודש הקודם"
  },
  "calendar.showNextWeek": {
    en: "Show next week",
    es: "Mostrar la semana siguiente",
    he: "הצגת השבוע הבא"
  },
  "calendar.showNextMonth": {
    en: "Show next month",
    es: "Mostrar el mes siguiente",
    he: "הצגת החודש הבא"
  },
  "calendar.nothingBookedIn": {
    en: "Nothing is booked in {period}.",
    es: "No hay nada reservado en {period}.",
    he: "אין הזמנות ב{period}."
  },
  "calendar.nothingBookedMatching": {
    en: "Nothing is booked in {period} that matches the current filters.",
    es: "No hay nada reservado en {period} que coincida con los filtros actuales.",
    he: "אין הזמנות ב{period} שתואמות את המסננים הנוכחיים."
  },
  "calendar.countingBookings": {
    en: "Counting bookings on this date…",
    es: "Contando reservas en esta fecha…",
    he: "סופר הזמנות בתאריך הזה…"
  },
  "calendar.oneBookingOnDate": {
    en: "1 booking on this date",
    es: "1 reserva en esta fecha",
    he: "הזמנה אחת בתאריך הזה"
  },
  "calendar.bookingsOnDate": {
    en: "{count} bookings on this date",
    es: "{count} reservas en esta fecha",
    he: "{count} הזמנות בתאריך הזה"
  },
  "calendar.oneHoldSlotsAvailable": {
    en: "1 hold · {count} event slots still available",
    es: "1 retención · {count} espacios aún disponibles",
    he: "שמירה אחת · {count} מקומות עדיין פנויים"
  },
  "calendar.bookingSaved": {
    en: "Booking saved and added to the calendar.",
    es: "Reserva guardada y añadida al calendario.",
    he: "ההזמנה נשמרה ונוספה ללוח השנה."
  },
  "calendar.enterNewEventTypeName": {
    en: "Enter the new event type name.",
    es: "Introduce el nombre del nuevo tipo de evento.",
    he: "הזן את שם סוג האירוע החדש."
  },
  "calendar.saveBooking": {
    en: "Save booking",
    es: "Guardar reserva",
    he: "שמירת ההזמנה"
  },
  "calendar.selectStartDate": {
    en: "Select the start date.",
    es: "Selecciona la fecha de inicio.",
    he: "בחר את תאריך ההתחלה."
  },
  "calendar.selectEndDate": {
    en: "Select the end date.",
    es: "Selecciona la fecha de fin.",
    he: "בחר את תאריך הסיום."
  },
  "calendar.blockHallHint": {
    en: "Choose a hall to close. A range blocks the hall it names, not the whole venue.",
    es: "Elige un salón para cerrar. Un rango bloquea el salón que nombra, no todo el local.",
    he: "בחר אולם לסגירה. טווח חוסם את האולם שהוא מציין, לא את כל המקום."
  },
  "calendar.availabilityHint": {
    en: "Choose a hall, then open the range picker, select the start date and select the end date from the same open calendar.",
    es: "Elige un salón, abre el selector de rango y elige la fecha de inicio y la de fin en el mismo calendario abierto.",
    he: "בחר אולם, פתח את בורר הטווח ובחר את תאריך ההתחלה ותאריך הסיום מאותו לוח פתוח."
  },
  "calendar.newTypeSavedHint": {
    en: "This type will be saved to Event Type Settings when the booking is saved.",
    es: "Este tipo se guardará en la configuración de tipos de evento al guardar la reserva.",
    he: "הסוג הזה יישמר בהגדרות סוגי האירועים בעת שמירת ההזמנה."
  },
  "calendar.loadingAvailability": {
    en: "Loading availability for this range…",
    es: "Cargando la disponibilidad de este rango…",
    he: "טוען את הזמינות לטווח הזה…"
  },
  "calendar.loadingDateBookings": {
    en: "Loading this date's bookings…",
    es: "Cargando las reservas de esta fecha…",
    he: "טוען את ההזמנות לתאריך הזה…"
  },
  "calendar.loadingPeriodBookings": {
    en: "Loading this period's bookings…",
    es: "Cargando las reservas de este período…",
    he: "טוען את ההזמנות לתקופה הזו…"
  }
});
