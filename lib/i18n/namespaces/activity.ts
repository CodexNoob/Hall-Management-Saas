import { defineMessages } from "@/lib/i18n/types";

/**
 * How each recorded action reads in the activity feed.
 *
 * One entry per key in `lib/audit/activity-actions.ts`, named `activity.` plus
 * the action key itself so the two cannot drift apart without a lookup miss
 * that is obvious on screen. The catalog keeps its English `label` as well: it
 * is the fallback for the CSV export and for any caller with no translator,
 * and `activity_logs.action_type` still stores the key, never the wording.
 */
export const activityMessages = defineMessages({
  // The eight modules the feed can file a row under.
  "activity.module.Events": { en: "Events", es: "Eventos", he: "אירועים" },
  "activity.module.Menu": { en: "Menu", es: "Menú", he: "תפריט" },
  "activity.module.Kitchen": { en: "Kitchen", es: "Cocina", he: "מטבח" },
  "activity.module.Calendar": {
    en: "Calendar",
    es: "Calendario",
    he: "יומן"
  },
  "activity.module.Staff": { en: "Staff", es: "Personal", he: "צוות" },
  "activity.module.Settings": {
    en: "Settings",
    es: "Ajustes",
    he: "הגדרות"
  },
  "activity.module.Access": { en: "Access", es: "Acceso", he: "הרשאות" },
  "activity.module.Other": { en: "Other", es: "Otros", he: "אחר" },

  "activity.event.created": {
    en: "Event created",
    es: "Evento creado",
    he: "האירוע נוצר"
  },
  "activity.event.updated": {
    en: "Event edited",
    es: "Evento editado",
    he: "האירוע נערך"
  },
  "activity.event.guest_counts.updated": {
    en: "Guest counts changed",
    es: "Número de invitados modificado",
    he: "מספרי האורחים שונו"
  },
  "activity.event.status.updated": {
    en: "Event status changed",
    es: "Estado del evento modificado",
    he: "סטטוס האירוע שונה"
  },
  "activity.event.menu.updated": {
    en: "Event menu edited",
    es: "Menú del evento editado",
    he: "תפריט האירוע נערך"
  },
  "activity.event.menu.confirmed": {
    en: "Event menu confirmed",
    es: "Menú del evento confirmado",
    he: "תפריט האירוע אושר"
  },
  "activity.event.package.applied": {
    en: "Package applied to event",
    es: "Paquete aplicado al evento",
    he: "החבילה הוחלה על האירוע"
  },
  "activity.event.package.removed": {
    en: "Package removed from event",
    es: "Paquete retirado del evento",
    he: "החבילה הוסרה מהאירוע"
  },
  "activity.event.timeline.updated": {
    en: "Event timeline changed",
    es: "Cronología del evento modificada",
    he: "ציר הזמן של האירוע שונה"
  },
  "activity.event.payment.recorded": {
    en: "Payment recorded",
    es: "Pago registrado",
    he: "התשלום נרשם"
  },
  "activity.event.calendar.exported": {
    en: "Event sent to calendar",
    es: "Evento enviado al calendario",
    he: "האירוע נשלח ליומן"
  },

  "activity.menu.item.created": {
    en: "Menu item added",
    es: "Plato añadido al menú",
    he: "פריט תפריט נוסף"
  },
  "activity.menu.item.updated": {
    en: "Menu item edited",
    es: "Plato del menú editado",
    he: "פריט תפריט נערך"
  },
  "activity.menu.item.deleted": {
    en: "Menu item deleted",
    es: "Plato del menú eliminado",
    he: "פריט תפריט נמחק"
  },
  "activity.menu.package.created": {
    en: "Package created",
    es: "Paquete creado",
    he: "החבילה נוצרה"
  },
  "activity.menu.package.updated": {
    en: "Package edited",
    es: "Paquete editado",
    he: "החבילה נערכה"
  },
  "activity.menu.addon.created": {
    en: "Add-on created",
    es: "Extra creado",
    he: "התוספת נוצרה"
  },
  "activity.menu.imported": {
    en: "Menu imported",
    es: "Menú importado",
    he: "התפריט יובא"
  },

  "activity.kitchen.event.created": {
    en: "Kitchen event created",
    es: "Evento de cocina creado",
    he: "אירוע מטבח נוצר"
  },
  "activity.kitchen.event.deleted": {
    en: "Kitchen event deleted",
    es: "Evento de cocina eliminado",
    he: "אירוע מטבח נמחק"
  },
  "activity.kitchen.status.updated": {
    en: "Production status changed",
    es: "Estado de producción modificado",
    he: "סטטוס ההכנה שונה"
  },
  "activity.kitchen.dish.replaced": {
    en: "Dish replaced on the board",
    es: "Plato sustituido en el tablero",
    he: "המנה הוחלפה בלוח"
  },
  "activity.kitchen.addon.replaced": {
    en: "Add-on replaced on the board",
    es: "Extra sustituido en el tablero",
    he: "התוספת הוחלפה בלוח"
  },
  "activity.kitchen.worker.added": {
    en: "Worker added",
    es: "Trabajador añadido",
    he: "עובד נוסף"
  },
  "activity.kitchen.worker.updated": {
    en: "Worker edited",
    es: "Trabajador editado",
    he: "פרטי עובד נערכו"
  },
  "activity.kitchen.worker.removed": {
    en: "Worker removed",
    es: "Trabajador retirado",
    he: "עובד הוסר"
  },
  "activity.kitchen.worker.assigned": {
    en: "Worker assigned",
    es: "Trabajador asignado",
    he: "עובד שובץ"
  },

  "activity.calendar.blocked_date.created": {
    en: "Date blocked",
    es: "Fecha bloqueada",
    he: "התאריך נחסם"
  },
  "activity.calendar.blocked_date.removed": {
    en: "Date unblocked",
    es: "Fecha desbloqueada",
    he: "החסימה על התאריך הוסרה"
  },

  "activity.staff.profile.updated": {
    en: "Staff profile edited",
    es: "Perfil de personal editado",
    he: "פרופיל איש צוות נערך"
  },

  "activity.settings.updated": {
    en: "Settings changed",
    es: "Ajustes modificados",
    he: "ההגדרות שונו"
  },
  "activity.settings.hall.created": {
    en: "Hall added",
    es: "Salón añadido",
    he: "אולם נוסף"
  },
  "activity.settings.hall.updated": {
    en: "Hall edited",
    es: "Salón editado",
    he: "אולם נערך"
  },
  "activity.settings.hall.deleted": {
    en: "Hall removed",
    es: "Salón eliminado",
    he: "אולם הוסר"
  },
  "activity.settings.event_type.created": {
    en: "Event type added",
    es: "Tipo de evento añadido",
    he: "סוג אירוע נוסף"
  },
  "activity.settings.event_type.updated": {
    en: "Event type edited",
    es: "Tipo de evento editado",
    he: "סוג אירוע נערך"
  },
  "activity.settings.event_type.deleted": {
    en: "Event type removed",
    es: "Tipo de evento eliminado",
    he: "סוג אירוע הוסר"
  },

  "activity.organization.reset.performed": {
    en: "Organization data reset",
    es: "Datos de la organización restablecidos",
    he: "נתוני הארגון אופסו"
  },
  "activity.auth.login.success": {
    en: "Signed in",
    es: "Sesión iniciada",
    he: "התחברות"
  },
  "activity.auth.sessions.revoked": {
    en: "Signed out other sessions",
    es: "Se cerraron las demás sesiones",
    he: "שאר ההתחברויות נותקו"
  },
  "activity.auth.mfa.enabled": {
    en: "Two-factor authentication enabled",
    es: "Autenticación de dos factores activada",
    he: "אימות דו-שלבי הופעל"
  },
  "activity.auth.mfa.disabled": {
    en: "Two-factor authentication disabled",
    es: "Autenticación de dos factores desactivada",
    he: "אימות דו-שלבי בוטל"
  },
  "activity.auth.mfa.untrusted_removed": {
    en: "Unverified authenticator removed",
    es: "Autenticador no verificado eliminado",
    he: "מאמת לא מאומת הוסר"
  },
  "activity.auth.password.set": {
    en: "Password set",
    es: "Contraseña establecida",
    he: "הסיסמה הוגדרה"
  },
  "activity.organization.onboarding.completed": {
    en: "Onboarding completed",
    es: "Configuración inicial completada",
    he: "ההקמה הושלמה"
  },
  "activity.plaid.connection.created": {
    en: "Bank connected",
    es: "Banco conectado",
    he: "הבנק חובר"
  },
  "activity.plaid.sync.completed": {
    en: "Bank sync completed",
    es: "Sincronización bancaria completada",
    he: "סנכרון הבנק הושלם"
  },
  "activity.support.ticket.created": {
    en: "Support ticket opened",
    es: "Ticket de soporte abierto",
    he: "נפתחה פנייה לתמיכה"
  }
});
