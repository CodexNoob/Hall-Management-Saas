import { defineMessages } from "@/lib/i18n/types";

/**
 * Event Manager: the list, the workspace tabs, and every panel inside one —
 * details, menu, kitchen sheet, timeline, files, billing, portal, hall map,
 * vendors and the print packet.
 */
export const eventsMessages = defineMessages({
  "events.managerTitle": {
    en: "Event Manager",
    es: "Gestor de eventos",
    he: "מנהל האירועים"
  },
  "events.managerBlurb": {
    en: "Select an event, then manage every connected section from one workspace.",
    es: "Selecciona un evento y gestiona cada sección conectada desde un solo espacio.",
    he: "בחר אירוע ונהל כל קטע מקושר ממקום אחד."
  },
  // The workspace tabs. Their `label` stays English because the workspace
  // switches on it; these are what the tab strip draws.
  "events.tab.details": {
    en: "Event details",
    es: "Detalles del evento",
    he: "פרטי האירוע"
  },
  "events.tab.menu": { en: "Menu", es: "Menú", he: "תפריט" },
  "events.tab.portal": {
    en: "Client portal",
    es: "Portal del cliente",
    he: "פורטל הלקוח"
  },
  "events.tab.billing": {
    en: "Billing",
    es: "Facturación",
    he: "חיוב"
  },
  "events.tab.hallMap": {
    en: "Hall map",
    es: "Mapa del salón",
    he: "מפת האולם"
  },
  "events.tab.kitchen": { en: "Kitchen", es: "Cocina", he: "מטבח" },
  "events.tab.vendors": {
    en: "Vendors",
    es: "Proveedores",
    he: "ספקים"
  },
  "events.tab.files": { en: "Files", es: "Archivos", he: "קבצים" },

  "events.portal.dateTime": {
    en: "Event date and time",
    es: "Fecha y hora del evento",
    he: "תאריך ושעת האירוע"
  },
  "events.portal.guestCount": {
    en: "Guest count editor",
    es: "Editor del número de invitados",
    he: "עורך מספר האורחים"
  },
  "events.portal.menuSelector": {
    en: "Client menu selector",
    es: "Selector de menú del cliente",
    he: "בורר התפריט של הלקוח"
  },
  "events.portal.liveTotal": {
    en: "Live total summary",
    es: "Resumen del total en vivo",
    he: "סיכום הסכום המתעדכן"
  },
  "events.portal.hallLayout": {
    en: "Hall layout view",
    es: "Vista de la distribución del salón",
    he: "תצוגת פריסת האולם"
  },
  "events.portal.paymentLink": {
    en: "Payment link",
    es: "Enlace de pago",
    he: "קישור לתשלום"
  },
  "events.portal.tablecloths": {
    en: "Tablecloth options with pictures",
    es: "Opciones de mantelería con imágenes",
    he: "אפשרויות מפות שולחן עם תמונות"
  },
  "events.portal.addOns": {
    en: "Add-ons with pictures",
    es: "Extras con imágenes",
    he: "תוספות עם תמונות"
  },
  "events.portal.balanceDue": {
    en: "Balance due",
    es: "Saldo pendiente",
    he: "יתרה לתשלום"
  },
  "events.portal.internalNotes": {
    en: "Internal notes",
    es: "Notas internas",
    he: "הערות פנימיות"
  },

  "events.venueLogo": {
    en: "Venue logo",
    es: "Logotipo del local",
    he: "לוגו המקום"
  },
  "events.copied": { en: "Copied!", es: "¡Copiado!", he: "הועתק!" },
  "events.copyFailed": {
    en: "Copy failed",
    es: "No se pudo copiar",
    he: "ההעתקה נכשלה"
  },
  "events.linkCopied": {
    en: "Link copied.",
    es: "Enlace copiado.",
    he: "הקישור הועתק."
  },
  "events.linkCopyFailed": {
    en: "Unable to copy the link.",
    es: "No se pudo copiar el enlace.",
    he: "לא ניתן להעתיק את הקישור."
  },
  "events.portalSubject": {
    en: "Event portal: {name}",
    es: "Portal del evento: {name}",
    he: "פורטל האירוע: {name}"
  },

  "events.eventDeposit": {
    en: "Event Deposit",
    es: "Depósito del evento",
    he: "מקדמה לאירוע"
  },
  "events.linenRental": {
    en: "Linen Rental",
    es: "Alquiler de mantelería",
    he: "השכרת מצעים"
  },
  "events.refundAdjustment": {
    en: "Refund adjustment",
    es: "Ajuste de reembolso",
    he: "התאמת החזר"
  },
  "events.openOutstanding": {
    en: "Click to open outstanding balance",
    es: "Haz clic para abrir el saldo pendiente",
    he: "לחץ לפתיחת היתרה הפתוחה"
  },
  "events.recordedOnEvent": {
    en: "Recorded on event",
    es: "Registrado en el evento",
    he: "נרשם באירוע"
  },
  "events.assignedRecords": {
    en: "Assigned records",
    es: "Registros asignados",
    he: "רשומות משויכות"
  },
  "events.clientStatement": {
    en: "Client statement",
    es: "Estado de cuenta del cliente",
    he: "דוח ללקוח"
  },

  "events.ofSelected": {
    en: "{selected} of {total} selected",
    es: "{selected} de {total} seleccionados",
    he: "{selected} מתוך {total} נבחרו"
  },
  "events.oneOption": { en: "1 option", es: "1 opción", he: "אפשרות אחת" },
  "events.optionCount": {
    en: "{count} options",
    es: "{count} opciones",
    he: "{count} אפשרויות"
  },
  "events.whatDidWePick": {
    en: "what did we pick?",
    es: "¿qué elegimos?",
    he: "מה בחרנו?"
  },
  "events.searchIn": {
    en: "Search {section}...",
    es: "Buscar en {section}...",
    he: "חיפוש ב{section}..."
  },
  "events.selectionsSaved": {
    en: "Your selections were saved.",
    es: "Tus selecciones se guardaron.",
    he: "הבחירות שלך נשמרו."
  },
  "events.selectionsSaveFailed": {
    en: "Could not save your selections.",
    es: "No se pudieron guardar tus selecciones.",
    he: "לא ניתן היה לשמור את הבחירות שלך."
  },
  "events.clientSelectable": {
    en: "client selectable",
    es: "seleccionable por el cliente",
    he: "ניתן לבחירה על ידי הלקוח"
  },
  "events.saveMySelections": {
    en: "Save my selections",
    es: "Guardar mis selecciones",
    he: "שמירת הבחירות שלי"
  },

  "events.valueNotValid": {
    en: "That value is not valid.",
    es: "Ese valor no es válido.",
    he: "הערך הזה אינו תקין."
  },
  "events.couldNotSave": {
    en: "Could not save.",
    es: "No se pudo guardar.",
    he: "לא ניתן היה לשמור."
  },
  "events.phoneNotProvided": {
    en: "Phone not provided",
    es: "Teléfono no proporcionado",
    he: "לא סופק טלפון"
  },
  "events.editPhone": {
    en: "Edit phone",
    es: "Editar teléfono",
    he: "עריכת הטלפון"
  },
  "events.emailNotProvided": {
    en: "Email not provided",
    es: "Correo no proporcionado",
    he: "לא סופק דוא״ל"
  },
  "events.editEmail": {
    en: "Edit email",
    es: "Editar correo",
    he: "עריכת הדוא״ל"
  },
  "events.thisHall": { en: "this hall", es: "este salón", he: "האולם הזה" },
  "events.chooseADate": {
    en: "Choose a date",
    es: "Elige una fecha",
    he: "בחר תאריך"
  },
  "events.fixHighlighted": {
    en: "Fix the highlighted fields before saving.",
    es: "Corrige los campos resaltados antes de guardar.",
    he: "תקן את השדות המסומנים לפני השמירה."
  },
  "events.confirmedAndSaved": {
    en: "Event confirmed. The details were saved first.",
    es: "Evento confirmado. Los detalles se guardaron primero.",
    he: "האירוע אושר. הפרטים נשמרו קודם."
  },
  "events.detailsSaved": {
    en: "Event details saved successfully.",
    es: "Los detalles del evento se guardaron correctamente.",
    he: "פרטי האירוע נשמרו בהצלחה."
  },
  "events.saveEventFailed": {
    en: "Could not save this event.",
    es: "No se pudo guardar este evento.",
    he: "לא ניתן היה לשמור את האירוע."
  },
  "events.saveEventDetails": {
    en: "Save event details",
    es: "Guardar los detalles del evento",
    he: "שמירת פרטי האירוע"
  },
  "events.saveAndConfirm": {
    en: "Save these details and confirm the booking",
    es: "Guardar estos detalles y confirmar la reserva",
    he: "שמירת הפרטים ואישור ההזמנה"
  },
  "events.alreadyConfirmed": {
    en: "This event is no longer waiting to be confirmed.",
    es: "Este evento ya no está pendiente de confirmación.",
    he: "האירוע הזה כבר אינו ממתין לאישור."
  },
  "events.confirming": {
    en: "Confirming...",
    es: "Confirmando...",
    he: "מאשר..."
  },
  "events.confirmEvent": {
    en: "Confirm event",
    es: "Confirmar evento",
    he: "אישור האירוע"
  },

  "events.allFiles": {
    en: "All files",
    es: "Todos los archivos",
    he: "כל הקבצים"
  },
  "events.storageUnavailable": {
    en: "Storage is unavailable. Reload the page and try again.",
    es: "El almacenamiento no está disponible. Recarga la página e inténtalo de nuevo.",
    he: "האחסון אינו זמין. רענן את העמוד ונסה שוב."
  },
  "events.fileUploadFailed": {
    en: "That file could not be uploaded.",
    es: "No se pudo subir ese archivo.",
    he: "לא ניתן היה להעלות את הקובץ."
  },
  "events.fileOpenFailed": {
    en: "That file could not be opened.",
    es: "No se pudo abrir ese archivo.",
    he: "לא ניתן היה לפתוח את הקובץ."
  },
  "events.savedDiningLayout": {
    en: "Saved dining layout",
    es: "Distribución del comedor guardada",
    he: "פריסת חדר האוכל נשמרה"
  },
  "events.needsDiningLayout": {
    en: "Needs dining layout",
    es: "Falta la distribución del comedor",
    he: "חסרה פריסת חדר אוכל"
  },

  "events.pendingNotStarted": {
    en: "{pending} pending · {notStarted} not started",
    es: "{pending} pendientes · {notStarted} sin iniciar",
    he: "{pending} בהמתנה · {notStarted} טרם התחילו"
  },
  "events.everyDishHasQuantity": {
    en: "Every dish has a quantity",
    es: "Todos los platos tienen cantidad",
    he: "לכל מנה יש כמות"
  },
  "events.dishesWithoutQuantity": {
    en: "Dishes with no quantity to cook to",
    es: "Platos sin cantidad que cocinar",
    he: "מנות ללא כמות לבישול"
  },
  "events.noStyle": { en: "No style", es: "Sin estilo", he: "ללא סגנון" },
  "events.showingMostRecent": {
    en: "Showing the {count} most recent",
    es: "Mostrando los {count} más recientes",
    he: "מוצגים {count} האחרונים"
  },
  "events.sentCount": {
    en: "{count} sent",
    es: "{count} enviadas",
    he: "{count} נשלחו"
  },
  "events.notAcknowledgedYet": {
    en: "Not acknowledged yet",
    es: "Aún sin confirmar",
    he: "טרם אושר"
  },
  "events.menuConfirmed": {
    en: "Menu confirmed",
    es: "Menú confirmado",
    he: "התפריט אושר"
  },
  "events.menuDraft": {
    en: "Menu draft",
    es: "Borrador del menú",
    he: "טיוטת תפריט"
  },
  "events.noMenuYet": {
    en: "no menu yet",
    es: "aún sin menú",
    he: "אין עדיין תפריט"
  },
  "events.addDishesHint": {
    en: "Add dishes on the Menu tab and this sheet fills in with what to cook.",
    es: "Agrega platos en la pestaña Menú y esta hoja se llenará con lo que hay que cocinar.",
    he: "הוסף מנות בלשונית התפריט והגיליון הזה יתמלא במה שיש לבשל."
  },
  "events.nothingOnMeal": {
    en: "Nothing on the {meal} meal",
    es: "Nada en la comida {meal}",
    he: "אין דבר בארוחת {meal}"
  },
  "events.noMenuForEvent": {
    en: "No menu for this event yet",
    es: "Este evento aún no tiene menú",
    he: "אין עדיין תפריט לאירוע הזה"
  },

  "events.timeNotSet": {
    en: "Time not set",
    es: "Hora sin definir",
    he: "לא נקבעה שעה"
  },
  "events.notAssigned": {
    en: "Not assigned",
    es: "Sin asignar",
    he: "לא שויך"
  },
  "events.paidInFull": {
    en: "Paid in Full",
    es: "Pagado por completo",
    he: "שולם במלואו"
  },
  "events.seeBilling": {
    en: "See billing",
    es: "Ver facturación",
    he: "הצגת החיוב"
  },
  "events.noInvoice": {
    en: "No invoice",
    es: "Sin factura",
    he: "אין חשבונית"
  },
  "events.collapseList": {
    en: "Collapse event list",
    es: "Contraer la lista de eventos",
    he: "כיווץ רשימת האירועים"
  },
  "events.expandList": {
    en: "Expand event list",
    es: "Expandir la lista de eventos",
    he: "הרחבת רשימת האירועים"
  },
  "events.collapseSections": {
    en: "Collapse event sections",
    es: "Contraer las secciones del evento",
    he: "כיווץ מדורי האירוע"
  },
  "events.expandSections": {
    en: "Expand event sections",
    es: "Expandir las secciones del evento",
    he: "הרחבת מדורי האירוע"
  },

  "events.decreaseQuantity": {
    en: "Decrease {name} quantity",
    es: "Disminuir la cantidad de {name}",
    he: "הפחתת הכמות של {name}"
  },
  "events.increaseQuantity": {
    en: "Increase {name} quantity",
    es: "Aumentar la cantidad de {name}",
    he: "הגדלת הכמות של {name}"
  },
  "events.removeNamed": {
    en: "Remove {name}",
    es: "Quitar {name}",
    he: "הסרת {name}"
  },
  "events.menuSaveFailed": {
    en: "Could not save the menu.",
    es: "No se pudo guardar el menú.",
    he: "לא ניתן היה לשמור את התפריט."
  },
  "events.packageAddFailed": {
    en: "Could not add the package.",
    es: "No se pudo agregar el paquete.",
    he: "לא ניתן היה להוסיף את החבילה."
  },
  "events.packageAddedOne": {
    en: "{name} added - 1 dish on this menu.",
    es: "{name} agregado: 1 plato en este menú.",
    he: "{name} נוסף - מנה אחת בתפריט."
  },
  "events.packageAddedMany": {
    en: "{name} added - {count} dishes on this menu.",
    es: "{name} agregado: {count} platos en este menú.",
    he: "{name} נוסף - {count} מנות בתפריט."
  },
  "events.packageRemoveFailed": {
    en: "Could not remove the package.",
    es: "No se pudo quitar el paquete.",
    he: "לא ניתן היה להסיר את החבילה."
  },
  "events.packageRemoved": {
    en: "Package removed.",
    es: "Paquete eliminado.",
    he: "החבילה הוסרה."
  },
  "events.menuStillLoading": {
    en: "Menu is still loading. Try again in a moment.",
    es: "El menú aún se está cargando. Inténtalo en un momento.",
    he: "התפריט עדיין נטען. נסה שוב בעוד רגע."
  },
  "events.itemAddedOne": {
    en: "1 item added.",
    es: "1 plato agregado.",
    he: "פריט אחד נוסף."
  },
  "events.itemsAdded": {
    en: "{count} items added.",
    es: "{count} platos agregados.",
    he: "{count} פריטים נוספו."
  },
  "events.changeUndone": {
    en: "Change undone.",
    es: "Cambio deshecho.",
    he: "השינוי בוטל."
  },
  "events.confirmMenuFailed": {
    en: "Could not confirm menu.",
    es: "No se pudo confirmar el menú.",
    he: "לא ניתן היה לאשר את התפריט."
  },
  "events.reopenMenuFailed": {
    en: "Could not reopen menu.",
    es: "No se pudo reabrir el menú.",
    he: "לא ניתן היה לפתוח מחדש את התפריט."
  },
  "events.menuConfirmedToast": {
    en: "Menu confirmed.",
    es: "Menú confirmado.",
    he: "התפריט אושר."
  },
  "events.menuReopened": {
    en: "Menu reopened.",
    es: "Menú reabierto.",
    he: "התפריט נפתח מחדש."
  },
  "events.reopening": {
    en: "Reopening...",
    es: "Reabriendo...",
    he: "פותח מחדש..."
  },
  "events.reopenMenu": {
    en: "Reopen menu",
    es: "Reabrir menú",
    he: "פתיחת התפריט מחדש"
  },
  "events.addItemBeforeConfirm": {
    en: "Add at least one menu item before confirming.",
    es: "Agrega al menos un plato antes de confirmar.",
    he: "הוסף לפחות פריט אחד לפני האישור."
  },
  "events.addOnBadge": { en: "ADD-ON", es: "EXTRA", he: "תוספת" },
  "events.confirmAndLock": {
    en: "Confirm & lock menu",
    es: "Confirmar y bloquear el menú",
    he: "אישור ונעילת התפריט"
  },

  "events.packageDishOne": {
    en: "1 dish on this menu came from the package.",
    es: "1 plato de este menú vino del paquete.",
    he: "מנה אחת בתפריט הגיעה מהחבילה."
  },
  "events.packageDishMany": {
    en: "{count} dishes on this menu came from the package.",
    es: "{count} platos de este menú vinieron del paquete.",
    he: "{count} מנות בתפריט הגיעו מהחבילה."
  },
  "events.packageDishesGone": {
    en: "Its dishes are no longer on this menu.",
    es: "Sus platos ya no están en este menú.",
    he: "המנות שלה כבר אינן בתפריט."
  },
  "events.addPackageHint": {
    en: "Add one to drop its whole dish list onto this menu at once.",
    es: "Agrega uno para volcar toda su lista de platos en este menú de una vez.",
    he: "הוסף חבילה כדי להעביר את כל רשימת המנות שלה לתפריט בבת אחת."
  },
  "events.buildPackageHint": {
    en: "Build one on the Packages tab of the menu library to use it here.",
    es: "Crea uno en la pestaña Paquetes de la biblioteca del menú para usarlo aquí.",
    he: "בנה חבילה בלשונית החבילות בספריית התפריט כדי להשתמש בה כאן."
  },
  "events.addNamed": {
    en: "Add {name}",
    es: "Agregar {name}",
    he: "הוספת {name}"
  },
  "events.addPackageButton": {
    en: "Add package",
    es: "Agregar paquete",
    he: "הוספת חבילה"
  },
  "events.changePackage": {
    en: "Change package",
    es: "Cambiar paquete",
    he: "החלפת החבילה"
  },
  "events.addItsDishes": {
    en: "Add its dishes",
    es: "Agregar sus platos",
    he: "הוספת המנות שלה"
  },
  "events.removePackageOne": {
    en: "The 1 dish it added comes off this menu. Anything you added by hand stays.",
    es: "El plato que agregó se quita de este menú. Lo que agregaste a mano se queda.",
    he: "המנה שהיא הוסיפה תרד מהתפריט. מה שהוספת ידנית יישאר."
  },
  "events.removePackageMany": {
    en: "The {count} dishes it added come off this menu. Anything you added by hand stays.",
    es: "Los {count} platos que agregó se quitan de este menú. Lo que agregaste a mano se queda.",
    he: "{count} המנות שהיא הוסיפה ירדו מהתפריט. מה שהוספת ידנית יישאר."
  },
  "events.packageStopsNaming": {
    en: "The event stops naming this package. The menu itself does not change.",
    es: "El evento deja de nombrar este paquete. El menú en sí no cambia.",
    he: "האירוע יפסיק לציין את החבילה. התפריט עצמו לא משתנה."
  },

  "events.unreadableRule": {
    en: "{name} has a counting rule this page cannot read. Open it in the menu library before setting another.",
    es: "{name} tiene una regla de conteo que esta página no puede leer. Ábrelo en la biblioteca del menú antes de definir otra.",
    he: "ל{name} יש כלל ספירה שהעמוד הזה אינו יכול לקרוא. פתח אותו בספריית התפריט לפני הגדרת כלל אחר."
  },
  "events.ruleSaveFailed": {
    en: "The counting rule could not be saved. Please try again.",
    es: "No se pudo guardar la regla de conteo. Inténtalo de nuevo.",
    he: "לא ניתן היה לשמור את כלל הספירה. נסה שוב."
  },
  "events.noRuleEditable": {
    en: "These dishes have no rule for the way they are served here, so the kitchen has no quantity to cook to. The answer is saved to the menu library and used by every event.",
    es: "Estos platos no tienen regla para cómo se sirven aquí, así que la cocina no tiene cantidad que cocinar. La respuesta se guarda en la biblioteca del menú y la usan todos los eventos.",
    he: "למנות האלה אין כלל לאופן ההגשה כאן, ולכן למטבח אין כמות לבשל. התשובה נשמרת בספריית התפריט ומשמשת כל אירוע."
  },
  "events.noRuleReadOnly": {
    en: "These dishes have no rule for the way they are served here, so the kitchen has no quantity to cook to. Setting one is a menu library change, which your access does not cover.",
    es: "Estos platos no tienen regla para cómo se sirven aquí, así que la cocina no tiene cantidad que cocinar. Definirla es un cambio en la biblioteca del menú, que tu acceso no cubre.",
    he: "למנות האלה אין כלל לאופן ההגשה כאן, ולכן למטבח אין כמות לבשל. הגדרת כלל היא שינוי בספריית התפריט, שאינו בהרשאות שלך."
  },
  "events.saveRule": {
    en: "Save rule",
    es: "Guardar regla",
    he: "שמירת הכלל"
  },

  "events.timelineSaveFailed": {
    en: "Could not save timeline.",
    es: "No se pudo guardar la cronología.",
    he: "לא ניתן היה לשמור את ציר הזמן."
  },
  "events.timelineConfirmed": {
    en: "Timeline confirmed. Staff can now follow this event schedule.",
    es: "Cronología confirmada. El personal ya puede seguir este programa.",
    he: "ציר הזמן אושר. הצוות יכול כעת לעקוב אחר לוח הזמנים."
  },
  "events.timelineSaved": {
    en: "Timeline saved. Your draft changes were saved successfully.",
    es: "Cronología guardada. Tus cambios en borrador se guardaron correctamente.",
    he: "ציר הזמן נשמר. שינויי הטיוטה נשמרו בהצלחה."
  },
  "events.packageDefaultFailed": {
    en: "Could not save the package default.",
    es: "No se pudo guardar el valor predeterminado del paquete.",
    he: "לא ניתן היה לשמור את ברירת המחדל של החבילה."
  },
  "events.packageDefaultSaved": {
    en: "Saved. {name} now starts from this schedule when it is added to an event that has none.",
    es: "Guardado. {name} ahora parte de este programa cuando se agrega a un evento sin cronología.",
    he: "נשמר. {name} יתחיל מעתה מלוח הזמנים הזה כשיתווסף לאירוע ללא לוח."
  },
  "events.newTimelineInstruction": {
    en: "New timeline instruction",
    es: "Nueva instrucción de cronología",
    he: "הוראת ציר זמן חדשה"
  },
  "events.giveClockTime": {
    en: "Give {name} a clock time instead of a cue",
    es: "Dar a {name} una hora en vez de una señal",
    he: "תן ל{name} שעה במקום סימן"
  },
  "events.giveCue": {
    en: "Give {name} a cue instead of a clock time",
    es: "Dar a {name} una señal en vez de una hora",
    he: "תן ל{name} סימן במקום שעה"
  },
  "events.waitsOnSomething": {
    en: "Waits on something else. Switch to a clock time.",
    es: "Espera a otra cosa. Cambia a una hora.",
    he: "ממתין למשהו אחר. החלף לשעה."
  },
  "events.runsAtClockTime": {
    en: "Runs at a clock time. Switch to a cue.",
    es: "Se ejecuta a una hora fija. Cambia a una señal.",
    he: "מתרחש בשעה קבועה. החלף לסימן."
  },
  "events.timelineCueFor": {
    en: "Timeline cue for {name}",
    es: "Señal de cronología para {name}",
    he: "סימן בציר הזמן עבור {name}"
  },
  "events.timelineTimeFor": {
    en: "Timeline time for {name}",
    es: "Hora de cronología para {name}",
    he: "שעה בציר הזמן עבור {name}"
  },
  "events.timelineTypeFor": {
    en: "{name} timeline type",
    es: "Tipo de cronología de {name}",
    he: "סוג ציר הזמן של {name}"
  },
  "events.makeDefaultSchedule": {
    en: "Make this the schedule {package} starts from",
    es: "Haz que esta sea la programación con la que empieza {package}",
    he: "הפוך את זה ללוח הזמנים ש{package} מתחיל ממנו"
  },
  "events.saveTimeline": {
    en: "Save timeline",
    es: "Guardar cronología",
    he: "שמירת ציר הזמן"
  },
  "events.timelineAlreadyConfirmed": {
    en: "This timeline is already confirmed.",
    es: "Esta cronología ya está confirmada.",
    he: "ציר הזמן הזה כבר אושר."
  },
  "events.addInstructionBeforeConfirm": {
    en: "Add at least one timeline instruction before confirming it.",
    es: "Agrega al menos una instrucción antes de confirmarla.",
    he: "הוסף לפחות הוראה אחת לפני האישור."
  },
  "events.saveAndConfirmForStaff": {
    en: "Save this schedule and confirm it for staff",
    es: "Guardar este programa y confirmarlo para el personal",
    he: "שמירת לוח הזמנים ואישורו לצוות"
  },
  "events.addInstructionFirst": {
    en: "Add at least one timeline instruction first.",
    es: "Primero agrega al menos una instrucción.",
    he: "תחילה הוסף לפחות הוראה אחת."
  },
  "events.makeDefaultFor": {
    en: "Make this the schedule {name} starts from",
    es: "Hacer que {name} parta de este programa",
    he: "הפוך את זה ללוח הזמנים ש{name} מתחיל ממנו"
  },

  "events.tableclothOrder": {
    en: "Tablecloth order",
    es: "Pedido de mantelería",
    he: "הזמנת מפות שולחן"
  },
  "events.needIvoryCount": {
    en: "Need ivory count",
    es: "Falta el número de marfil",
    he: "דרוש מספר בגוון שנהב"
  },
  "events.dessertCups": {
    en: "Dessert cups",
    es: "Copas de postre",
    he: "כוסות קינוח"
  },
  "events.deliveryTime": {
    en: "Delivery 4:30 PM",
    es: "Entrega a las 4:30 p. m.",
    he: "משלוח ב-16:30"
  },

  "events.addSelected": {
    en: "Add selected",
    es: "Agregar lo seleccionado",
    he: "הוספת הנבחרים"
  },
  "events.addCountItems": {
    en: "Add {count} items",
    es: "Agregar {count} platos",
    he: "הוספת {count} פריטים"
  },
  "events.needsAStyle": {
    en: "Needs a style",
    es: "Requiere un estilo",
    he: "דרוש סגנון"
  },
  "events.noServiceRule": {
    en: "No service rule",
    es: "Sin regla de servicio",
    he: "אין כלל הגשה"
  },
  "events.noPackagesSetUp": {
    en: "No packages have been set up yet. Build one on the Packages tab of the menu library.",
    es: "Aún no se han configurado paquetes. Crea uno en la pestaña Paquetes de la biblioteca del menú.",
    he: "עדיין לא הוגדרו חבילות. בנה אחת בלשונית החבילות בספריית התפריט."
  },
  "events.noPackageMatches": {
    en: "No package matches that search.",
    es: "Ningún paquete coincide con esa búsqueda.",
    he: "אין חבילה שתואמת לחיפוש הזה."
  },
  "events.adding": { en: "Adding...", es: "Agregando...", he: "מוסיף..." },

  "events.needsServiceStyleShort": {
    en: "Needs service style",
    es: "Requiere estilo de servicio",
    he: "דרוש סגנון הגשה"
  },
  "events.noCountingRuleSet": {
    en: "No counting rule set",
    es: "Sin regla de conteo",
    he: "לא הוגדר כלל ספירה"
  },
  "events.needsCountDetails": {
    en: "Needs count details",
    es: "Faltan detalles de conteo",
    he: "חסרים פרטי ספירה"
  },
  "events.noQuantity": {
    en: "No quantity",
    es: "Sin cantidad",
    he: "ללא כמות"
  },
  "events.notCookedToRule": {
    en: "Not cooked to a rule",
    es: "No se cocina por regla",
    he: "לא מבושל לפי כלל"
  },
  "events.needsBases": {
    en: "Needs {bases}",
    es: "Faltan {bases}",
    he: "חסרים {bases}"
  },
  "events.notStartedStatus": {
    en: "Not started",
    es: "Sin iniciar",
    he: "טרם התחיל"
  },
  "events.eventNotes": {
    en: "Event notes",
    es: "Notas del evento",
    he: "הערות האירוע"
  },
  "events.diningManagerNotes": {
    en: "Dining manager notes",
    es: "Notas del gestor del comedor",
    he: "הערות ניהול חדר האוכל"
  },
  "events.daveningNote": {
    en: "Davening note",
    es: "Nota de davening",
    he: "הערת תפילה"
  },
  "events.memberShul": {
    en: "Member shul",
    es: "Sinagoga del socio",
    he: "בית הכנסת של החבר"
  },
  "events.sideBoxes": {
    en: "Side boxes",
    es: "Cajas laterales",
    he: "קופסאות צד"
  },
  "events.shabbosSetup": {
    en: "Shabbos setup",
    es: "Montaje de Shabbos",
    he: "הכנות לשבת"
  },
  "events.notAttached": {
    en: "Not attached",
    es: "No adjunto",
    he: "לא מצורף"
  },
  "events.noTime": { en: "No time", es: "Sin hora", he: "ללא שעה" },

  "events.notBookable": {
    en: "Not bookable",
    es: "No reservable",
    he: "לא ניתן להזמנה"
  },
  // The selector drawer's commit button, once something is ticked.
  "events.addItemCount": {
    en: "Add {count} item",
    es: "Agregar {count} elemento",
    he: "הוספת {count} פריט"
  },
  "events.addItemCountPlural": {
    en: "Add {count} items",
    es: "Agregar {count} elementos",
    he: "הוספת {count} פריטים"
  },
  // What a "clear this section" action confirms. The section is named in the
  // sentence rather than prefixed to it, because the word order differs.
  "events.sectionCleared": {
    en: "{section} cleared.",
    es: "Se vació {section}.",
    he: "{section} נוקה."
  },
  "events.sectionDishes": {
    en: "{section} dishes",
    es: "Platos de {section}",
    he: "מנות {section}"
  },
  "events.slotsAvailable": {
    en: "{count} event slots available",
    es: "{count} espacios disponibles",
    he: "{count} מקומות פנויים"
  },
  "events.newClient": {
    en: "New client",
    es: "Nuevo cliente",
    he: "לקוח חדש"
  },
  "events.bookingCreatedFrom": {
    en: "Booking created from Event Manager.",
    es: "Reserva creada desde el gestor de eventos.",
    he: "ההזמנה נוצרה ממנהל האירועים."
  },
  "events.enterGuestCount": {
    en: "Enter a guest count.",
    es: "Introduce el número de invitados.",
    he: "הזן מספר אורחים."
  },
  "events.enterCouplesCount": {
    en: "Enter a couples count.",
    es: "Introduce el número de parejas.",
    he: "הזן מספר זוגות."
  },
  "events.enterChildrenCount": {
    en: "Enter a children count.",
    es: "Introduce el número de niños.",
    he: "הזן מספר ילדים."
  },

  "events.workspace": {
    en: "Event workspace",
    es: "Espacio del evento",
    he: "סביבת האירוע"
  },
  "events.noneSelected": {
    en: "No event selected",
    es: "Ningún evento seleccionado",
    he: "לא נבחר אירוע"
  },
  "events.noMatches": {
    en: "No events match this search.",
    es: "Ningún evento coincide con esta búsqueda.",
    he: "אין אירועים שתואמים לחיפוש הזה."
  },
  "events.searchPlaceholder": {
    en: "Search client, hall, type",
    es: "Buscar cliente, salón, tipo",
    he: "חיפוש לקוח, אולם, סוג"
  },
  "events.allEvents": {
    en: "All events",
    es: "Todos los eventos",
    he: "כל האירועים"
  },
  "events.allRooms": {
    en: "All rooms",
    es: "Todas las salas",
    he: "כל החדרים"
  },
  "events.eventFilter": {
    en: "Event filter",
    es: "Filtro de eventos",
    he: "מסנן אירועים"
  },
  "events.roomFilter": {
    en: "Room filter",
    es: "Filtro de salas",
    he: "מסנן חדרים"
  },
  "events.lifecycleFilter": {
    en: "Lifecycle filter",
    es: "Filtro de ciclo de vida",
    he: "מסנן מחזור חיים"
  },
  "events.clear": { en: "Clear", es: "Limpiar", he: "ניקוי" },
  "events.statusHold": { en: "Hold", es: "Retención", he: "שמירה" },
  "events.statusConfirmed": {
    en: "Confirmed",
    es: "Confirmado",
    he: "מאושר"
  },
  "events.statusCompleted": {
    en: "Completed",
    es: "Completado",
    he: "הושלם"
  },
  "events.statusCancelled": {
    en: "Cancelled",
    es: "Cancelado",
    he: "בוטל"
  },
  "events.dayOfSchedule": {
    en: "Day-of schedule",
    es: "Programa del día",
    he: "לוח הזמנים ליום האירוע"
  },
  "events.printPacket": {
    en: "Print packet",
    es: "Imprimir dosier",
    he: "הדפסת התיק"
  },
  "events.previewPortal": {
    en: "Preview portal",
    es: "Vista previa del portal",
    he: "תצוגה מקדימה של הפורטל"
  },
  "events.needsReview": {
    en: "Needs review",
    es: "Requiere revisión",
    he: "דורש בדיקה"
  },
  "events.todayNotesUnread": {
    en: "Today notes unread",
    es: "Notas de hoy sin leer",
    he: "הערות היום לא נקראו"
  },
  "events.noneSelectedBody": {
    en: "Choose an event from the list to open its details, menu and kitchen sheet in one workspace.",
    es: "Elige un evento de la lista para abrir sus detalles, menú y hoja de cocina en un solo espacio.",
    he: "בחר אירוע מהרשימה כדי לפתוח את הפרטים, התפריט וגיליון המטבח שלו במקום אחד."
  },
  "events.noEventsYet": {
    en: "No events yet",
    es: "Aún no hay eventos",
    he: "אין עדיין אירועים"
  },
  "events.createToStart": {
    en: "Create an event to start using the event workspace.",
    es: "Crea un evento para empezar a usar el espacio de eventos.",
    he: "צור אירוע כדי להתחיל להשתמש בסביבת האירועים."
  },
  "events.couldNotOpen": {
    en: "That event could not be opened",
    es: "No se pudo abrir ese evento",
    he: "לא ניתן היה לפתוח את האירוע"
  },
  "events.couldNotOpenBody": {
    en: "It may have been deleted, or it belongs to a hall you do not have access to.",
    es: "Puede que se haya eliminado, o pertenece a un salón al que no tienes acceso.",
    he: "ייתכן שהוא נמחק, או שהוא שייך לאולם שאין לך גישה אליו."
  },
  "events.filesBlurb": {
    en: "Contracts, layouts and approvals uploaded here stay attached to this event and appear in the Files page.",
    es: "Los contratos, planos y aprobaciones que subas aquí quedan asociados a este evento y aparecen en la página de Archivos.",
    he: "חוזים, פריסות ואישורים שמועלים כאן נשארים מקושרים לאירוע ומופיעים בעמוד הקבצים."
  },
  "events.tabPlaceholder": {
    en: "This event section is ready for the next workspace panel.",
    es: "Esta sección del evento está lista para el siguiente panel del espacio.",
    he: "קטע האירוע הזה מוכן ללוח העבודה הבא."
  },

  "events.information": {
    en: "Event information",
    es: "Información del evento",
    he: "פרטי האירוע"
  },
  "events.clientContact": {
    en: "Client contact",
    es: "Contacto del cliente",
    he: "איש קשר של הלקוח"
  },
  "events.readiness": {
    en: "Readiness",
    es: "Preparación",
    he: "מוכנות"
  },

  // The readiness checklist. Each row has a label and two helper lines - one
  // for when it is satisfied, one for what is still missing.
  "events.ready.detailsLabel": {
    en: "Event details completed",
    es: "Detalles del evento completados",
    he: "פרטי האירוע הושלמו"
  },
  "events.ready.detailsDone": {
    en: "Client, date, time, and room are filled.",
    es: "El cliente, la fecha, la hora y la sala están completos.",
    he: "הלקוח, התאריך, השעה והחדר מולאו."
  },
  "events.ready.detailsTodo": {
    en: "Fill client, date, time, and room.",
    es: "Completa el cliente, la fecha, la hora y la sala.",
    he: "מלא לקוח, תאריך, שעה וחדר."
  },
  "events.ready.confirmedLabel": {
    en: "Event confirmed",
    es: "Evento confirmado",
    he: "האירוע אושר"
  },
  "events.ready.confirmedDone": {
    en: "The booking is confirmed.",
    es: "La reserva está confirmada.",
    he: "ההזמנה אושרה."
  },
  "events.ready.confirmedTodo": {
    en: "Confirm the event before final operations.",
    es: "Confirma el evento antes de las operaciones finales.",
    he: "אשר את האירוע לפני הפעולות הסופיות."
  },
  "events.ready.guestsLabel": {
    en: "Guest count filled",
    es: "Número de invitados completado",
    he: "מספר האורחים הוזן"
  },
  "events.ready.guestsDone": {
    en: "{count} guests are recorded.",
    es: "Hay {count} invitados registrados.",
    he: "נרשמו {count} אורחים."
  },
  "events.ready.guestsTodo": {
    en: "Add the expected guest count.",
    es: "Agrega el número de invitados previsto.",
    he: "הוסף את מספר האורחים הצפוי."
  },
  "events.ready.menuLabel": {
    en: "Menu ready",
    es: "Menú listo",
    he: "התפריט מוכן"
  },
  "events.ready.menuDone": {
    en: "Menu has been reviewed and confirmed.",
    es: "El menú ha sido revisado y confirmado.",
    he: "התפריט נבדק ואושר."
  },
  "events.ready.menuTodo": {
    en: "Review and confirm the event menu.",
    es: "Revisa y confirma el menú del evento.",
    he: "בדוק ואשר את תפריט האירוע."
  },
  "events.ready.hallMapLabel": {
    en: "Hall map selected",
    es: "Mapa del salón seleccionado",
    he: "נבחרה מפת אולם"
  },
  "events.ready.hallMapDone": {
    en: "{name} is attached.",
    es: "{name} está adjunto.",
    he: "{name} מצורף."
  },
  "events.ready.hallMapTodo": {
    en: "Attach a hall map or dining preset.",
    es: "Adjunta un mapa del salón o un preajuste del comedor.",
    he: "צרף מפת אולם או הגדרת חדר אוכל."
  },
  "events.ready.timelineLabel": {
    en: "Timeline ready",
    es: "Cronología lista",
    he: "ציר הזמן מוכן"
  },
  "events.ready.timelineDone": {
    en: "Timeline has been confirmed.",
    es: "La cronología ha sido confirmada.",
    he: "ציר הזמן אושר."
  },
  "events.ready.timelineTodo": {
    en: "Confirm the timeline instructions.",
    es: "Confirma las instrucciones de la cronología.",
    he: "אשר את הוראות ציר הזמן."
  },
  "events.ready.diningLabel": {
    en: "Dining plan notes ready",
    es: "Notas del plan de comedor listas",
    he: "הערות תוכנית חדר האוכל מוכנות"
  },
  "events.ready.diningDone": {
    en: "Dining Manager notes are available.",
    es: "Las notas del gestor del comedor están disponibles.",
    he: "הערות ניהול חדר האוכל זמינות."
  },
  "events.ready.diningTodo": {
    en: "Save Dining Manager notes for this event.",
    es: "Guarda las notas del gestor del comedor para este evento.",
    he: "שמור הערות ניהול חדר אוכל לאירוע הזה."
  },
  "events.ready.billingLabel": {
    en: "Billing reviewed",
    es: "Facturación revisada",
    he: "החיוב נבדק"
  },
  "events.ready.billingDone": {
    en: "Payment status: {status}.",
    es: "Estado del pago: {status}.",
    he: "סטטוס התשלום: {status}."
  },
  "events.ready.billingTodo": {
    en: "Review invoice/payment status.",
    es: "Revisa el estado de la factura o del pago.",
    he: "בדוק את סטטוס החשבונית/התשלום."
  },
  "events.recentActivity": {
    en: "Recent activity",
    es: "Actividad reciente",
    he: "פעילות אחרונה"
  },
  "events.noActivity": {
    en: "No activity recorded yet. Changes to this event will appear here.",
    es: "Aún no hay actividad registrada. Los cambios de este evento aparecerán aquí.",
    he: "לא נרשמה עדיין פעילות. שינויים באירוע הזה יופיעו כאן."
  },

  "events.menuTitle": {
    en: "Menu for this event",
    es: "Menú de este evento",
    he: "התפריט לאירוע הזה"
  },
  "events.reviewConfirm": {
    en: "Review & confirm",
    es: "Revisar y confirmar",
    he: "בדיקה ואישור"
  },
  "events.confirmMenuQuestion": {
    en: "Confirm event menu?",
    es: "¿Confirmar el menú del evento?",
    he: "לאשר את תפריט האירוע?"
  },
  "events.serviceStyleHint": {
    en: "These dishes are served both ways. Pick the one this event uses so the kitchen gets the right quantity.",
    es: "Estos platos se sirven de ambas formas. Elige la que usa este evento para que la cocina reciba la cantidad correcta.",
    he: "המנות האלה מוגשות בשתי הדרכים. בחר את זו שהאירוע משתמש בה כדי שהמטבח יקבל את הכמות הנכונה."
  },
  "events.confirmReviewOne": {
    en: "Review 1 selected item. The menu will be locked until it is reopened.",
    es: "Revisa 1 plato seleccionado. El menú quedará bloqueado hasta que se reabra.",
    he: "בדוק פריט אחד שנבחר. התפריט יינעל עד שייפתח מחדש."
  },
  "events.confirmReviewMany": {
    en: "Review {count} selected items. The menu will be locked until it is reopened.",
    es: "Revisa {count} platos seleccionados. El menú quedará bloqueado hasta que se reabra.",
    he: "בדוק {count} פריטים שנבחרו. התפריט יינעל עד שייפתח מחדש."
  },
  "events.unassignedOne": {
    en: "1 dish still needs a service style. Confirming without one leaves the kitchen no quantity rule to run.",
    es: "1 plato aún necesita un estilo de servicio. Confirmar sin él deja a la cocina sin regla de cantidad.",
    he: "מנה אחת עדיין זקוקה לסגנון הגשה. אישור בלעדיו משאיר את המטבח ללא כלל כמות."
  },
  "events.unassignedMany": {
    en: "{count} dishes still need a service style. Confirming without one leaves the kitchen no quantity rule to run.",
    es: "{count} platos aún necesitan un estilo de servicio. Confirmar sin él deja a la cocina sin regla de cantidad.",
    he: "{count} מנות עדיין זקוקות לסגנון הגשה. אישור בלעדיו משאיר את המטבח ללא כלל כמות."
  },
  "events.goBack": { en: "Go back", es: "Volver", he: "חזרה" },
  "events.undo": { en: "Undo", es: "Deshacer", he: "ביטול פעולה" },
  "events.saving": { en: "Saving...", es: "Guardando...", he: "שומר..." },
  "events.needsServiceStyle": {
    en: "Needs a service style",
    es: "Requiere un estilo de servicio",
    he: "דרוש סגנון הגשה"
  },
  "events.needsCountingRule": {
    en: "Needs a counting rule",
    es: "Requiere una regla de conteo",
    he: "דרוש כלל ספירה"
  },
  "events.noPackageOnEvent": {
    en: "No package on this event",
    es: "Este evento no tiene paquete",
    he: "אין חבילה באירוע הזה"
  },
  "events.removePackage": {
    en: "Remove package",
    es: "Quitar paquete",
    he: "הסרת החבילה"
  },
  "events.keepIt": { en: "Keep it", es: "Conservarlo", he: "להשאיר" },
  "events.addPackage": {
    en: "Add a package",
    es: "Agregar un paquete",
    he: "הוספת חבילה"
  },
  "events.closePackageSelector": {
    en: "Close package selector",
    es: "Cerrar el selector de paquetes",
    he: "סגירת בורר החבילות"
  },
  "events.onThisEvent": {
    en: "On this event",
    es: "En este evento",
    he: "באירוע הזה"
  },
  "events.searchPackages": {
    en: "Search packages",
    es: "Buscar paquetes",
    he: "חיפוש חבילות"
  },
  "events.searchPackagesHint": {
    en: "Search packages or the dishes in them",
    es: "Busca paquetes o los platos que contienen",
    he: "חיפוש חבילות או המנות שבהן"
  },
  "events.packageAddsAll": {
    en: "Every dish in the package is added to this menu at once. Dishes you added by hand are left alone.",
    es: "Todos los platos del paquete se agregan a este menú a la vez. Los platos que agregaste a mano no se tocan.",
    he: "כל המנות בחבילה מתווספות לתפריט בבת אחת. מנות שהוספת ידנית נשארות כפי שהן."
  },
  "events.packageEmpty": {
    en: "Nothing active to add. Put items in this package on the Packages tab of the menu library.",
    es: "No hay nada activo que agregar. Añade platos a este paquete en la pestaña Paquetes de la biblioteca del menú.",
    he: "אין פריטים פעילים להוספה. הוסף פריטים לחבילה בלשונית החבילות בספריית התפריט."
  },
  // The selector drawer's section tabs. `id` is the service style the API
  // speaks, so only the wording moves here.
  "events.section.buffet": { en: "Buffet", es: "Bufé", he: "מזנון" },
  "events.section.plated": { en: "Plated", es: "Emplatado", he: "מוגש" },
  "events.section.drinks": { en: "Drinks", es: "Bebidas", he: "משקאות" },
  "events.section.addOns": { en: "Add-ons", es: "Extras", he: "תוספות" },

  "events.addAddOn": {
    en: "Add add-on",
    es: "Agregar extra",
    he: "הוספת תוספת"
  },
  "events.addSectionItem": {
    en: "Add {section} item",
    es: "Agregar plato de {section}",
    he: "הוספת פריט {section}"
  },
  "events.addToSection": {
    en: "Add to {section}",
    es: "Agregar a {section}",
    he: "הוספה ל{section}"
  },
  "events.clearSection": {
    en: "Clear {section}",
    es: "Limpiar {section}",
    he: "ניקוי {section}"
  },
  "events.queuedUnder": {
    en: "Queued under {section}",
    es: "En cola bajo {section}",
    he: "ממתין תחת {section}"
  },
  "events.alreadyOnMenu": {
    en: "Already on this menu",
    es: "Ya está en este menú",
    he: "כבר נמצא בתפריט הזה"
  },
  "events.servedAs": {
    en: "Served {styles}",
    es: "Se sirve {styles}",
    he: "מוגש {styles}"
  },
  "events.noAddOnsYet": {
    en: "No add-ons have been set up yet. Create one on the Add-ons tab of the menu library.",
    es: "Aún no se han configurado extras. Crea uno en la pestaña Extras de la biblioteca del menú.",
    he: "עדיין לא הוגדרו תוספות. צור אחת בלשונית התוספות בספריית התפריט."
  },
  "events.noItemsInSection": {
    en: "No items are served {section} yet. Open a library item and give it a {section} rule.",
    es: "Aún no hay platos servidos {section}. Abre un plato de la biblioteca y dale una regla {section}.",
    he: "אין עדיין פריטים שמוגשים {section}. פתח פריט מהספרייה והוסף לו כלל {section}."
  },

  "events.menuSections": {
    en: "Menu sections",
    es: "Secciones del menú",
    he: "מדורי התפריט"
  },
  "events.closeItemSelector": {
    en: "Close menu item selector",
    es: "Cerrar el selector de platos",
    he: "סגירת בורר פריטי התפריט"
  },
  "events.pickAsMany": {
    en: "Pick as many as you need, then add them together.",
    es: "Elige todos los que necesites y agrégalos juntos.",
    he: "בחר כמה שתצטרך והוסף אותם יחד."
  },
  "events.loadingMenu": {
    en: "Loading this event's menu…",
    es: "Cargando el menú de este evento…",
    he: "טוען את תפריט האירוע…"
  },

  "events.kitchenBoard": {
    en: "Kitchen board",
    es: "Tablero de cocina",
    he: "לוח המטבח"
  },
  "events.kitchenSheet": {
    en: "Kitchen sheet",
    es: "Hoja de cocina",
    he: "גיליון המטבח"
  },
  "events.kitchenReadOnly": {
    en: "Read-only. Statuses and worker assignments are set on the kitchen board.",
    es: "Solo lectura. Los estados y las asignaciones se definen en el tablero de cocina.",
    he: "לקריאה בלבד. סטטוסים והקצאות עובדים נקבעים בלוח המטבח."
  },
  "events.kitchenAcks": {
    en: "Kitchen acknowledgments",
    es: "Confirmaciones de la cocina",
    he: "אישורי המטבח"
  },
  "events.kitchenResponse": {
    en: "Kitchen response",
    es: "Respuesta de la cocina",
    he: "תגובת המטבח"
  },
  "events.noKitchenNotification": {
    en: "Kitchen has not received a change notification for this event yet.",
    es: "La cocina aún no ha recibido ninguna notificación de cambio para este evento.",
    he: "המטבח עדיין לא קיבל התראת שינוי לאירוע הזה."
  },
  "events.olderNotificationsHidden": {
    en: "Older change notifications for this event are not listed here.",
    es: "Las notificaciones de cambio anteriores de este evento no se listan aquí.",
    he: "התראות שינוי ישנות יותר לאירוע הזה אינן מוצגות כאן."
  },
  "events.noNotifications": {
    en: "No notifications",
    es: "Sin notificaciones",
    he: "אין התראות"
  },
  "events.noDishes": {
    en: "No dishes on this menu yet.",
    es: "Aún no hay platos en este menú.",
    he: "אין עדיין מנות בתפריט הזה."
  },
  "events.dish": { en: "Dish", es: "Plato", he: "מנה" },
  "events.style": { en: "Style", es: "Estilo", he: "סגנון" },
  "events.portions": { en: "Portions", es: "Porciones", he: "מנות" },
  "events.quantity": { en: "Quantity", es: "Cantidad", he: "כמות" },
  "events.assigned": { en: "Assigned", es: "Asignado", he: "הוקצה" },
  "events.prepared": { en: "Prepared", es: "Preparado", he: "הוכן" },
  "events.toCook": { en: "To cook", es: "Por cocinar", he: "לבישול" },
  "events.addOns": { en: "Add-ons", es: "Extras", he: "תוספות" },
  "events.needsAttention": {
    en: "Needs attention",
    es: "Requiere atención",
    he: "דרושה תשומת לב"
  },
  "events.sent": { en: "Sent", es: "Enviado", he: "נשלח" },
  "events.changedBy": {
    en: "Changed by",
    es: "Modificado por",
    he: "שונה על ידי"
  },
  "events.eventStarts": {
    en: "Event starts",
    es: "Inicio del evento",
    he: "תחילת האירוע"
  },
  "events.loadingKitchenSheet": {
    en: "Loading this event's kitchen sheet…",
    es: "Cargando la hoja de cocina de este evento…",
    he: "טוען את גיליון המטבח של האירוע…"
  },

  "events.timelineInstructions": {
    en: "Timeline instructions",
    es: "Instrucciones de la cronología",
    he: "הוראות ציר הזמן"
  },
  "events.timelineBlurb": {
    en: "What staff and the kitchen follow on the day.",
    es: "Lo que el personal y la cocina siguen ese día.",
    he: "מה שהצוות והמטבח מבצעים ביום האירוע."
  },
  "events.addCue": {
    en: "Add cue",
    es: "Agregar señal",
    he: "הוספת סימן"
  },
  "events.addTime": {
    en: "Add time",
    es: "Agregar hora",
    he: "הוספת שעה"
  },
  "events.cueHint": {
    en: "Add an instruction that waits on something else, such as after the soup is served.",
    es: "Agrega una instrucción que dependa de otra cosa, como después de servir la sopa.",
    he: "הוסף הוראה שממתינה למשהו אחר, למשל לאחר הגשת המרק."
  },
  "events.afterTheSoup": {
    en: "After the soup",
    es: "Después de la sopa",
    he: "אחרי המרק"
  },
  "events.confirmTimeline": {
    en: "Confirm timeline",
    es: "Confirmar la cronología",
    he: "אישור ציר הזמן"
  },
  "events.saveAsDefault": {
    en: "Save as default",
    es: "Guardar como predeterminado",
    he: "שמירה כברירת מחדל"
  },
  "events.saveAsPackageDefault": {
    en: "Save as package default",
    es: "Guardar como predeterminado del paquete",
    he: "שמירה כברירת מחדל של החבילה"
  },
  "events.noTimelineYet": {
    en: "No timeline instructions yet. Add a time for something that happens at a set hour, or a cue for something that waits on another step.",
    es: "Aún no hay instrucciones. Agrega una hora para algo que ocurre a una hora fija, o una señal para algo que espera a otro paso.",
    he: "אין עדיין הוראות ציר זמן. הוסף שעה למשהו שקורה בשעה קבועה, או סימן למשהו שממתין לשלב אחר."
  },
  "events.packageDefaultBlurb": {
    en: "An event that already has a timeline keeps its own - nothing anybody has written is replaced. Any default this package already carries is overwritten.",
    es: "Un evento que ya tiene cronología conserva la suya; no se reemplaza nada de lo escrito. El predeterminado que ya tenga el paquete se sobrescribe.",
    he: "אירוע שכבר יש לו ציר זמן שומר על שלו - דבר ממה שנכתב אינו מוחלף. ברירת מחדל קיימת של החבילה תידרס."
  },
  "events.menuConfirmedByVenue": {
    en: "Your menu has been confirmed by the venue. Contact them directly to make further changes.",
    es: "El local ha confirmado tu menú. Contáctalos directamente para hacer más cambios.",
    he: "התפריט שלך אושר על ידי המקום. צור איתם קשר ישירות לשינויים נוספים."
  },
  "events.noOnlinePayment": {
    en: "Online payment is not set up for this event. Please contact the venue to arrange payment.",
    es: "El pago en línea no está configurado para este evento. Contacta al local para gestionar el pago.",
    he: "תשלום מקוון אינו מוגדר לאירוע הזה. אנא צור קשר עם המקום כדי להסדיר את התשלום."
  },
  "events.forKitchen": { en: "Kitchen", es: "Cocina", he: "מטבח" },
  "events.forStaff": { en: "Staff", es: "Personal", he: "צוות" },

  "events.loadingFiles": {
    en: "Loading files...",
    es: "Cargando archivos...",
    he: "טוען קבצים..."
  },
  "events.noFiles": {
    en: "No files yet",
    es: "Aún no hay archivos",
    he: "אין עדיין קבצים"
  },
  "events.uploadFile": {
    en: "Upload file",
    es: "Subir archivo",
    he: "העלאת קובץ"
  },
  "events.open": { en: "Open", es: "Abrir", he: "פתיחה" },

  "events.invoicesForEvent": {
    en: "Invoices for this event",
    es: "Facturas de este evento",
    he: "חשבוניות לאירוע הזה"
  },
  "events.transactionHistory": {
    en: "Transaction history",
    es: "Historial de transacciones",
    he: "היסטוריית תנועות"
  },
  "events.totalEvent": {
    en: "Total event",
    es: "Total del evento",
    he: "סך האירוע"
  },
  "events.paymentAmount": {
    en: "Payment amount",
    es: "Importe del pago",
    he: "סכום התשלום"
  },

  "events.diningHallMap": {
    en: "Dining hall map",
    es: "Mapa del comedor",
    he: "מפת חדר האוכל"
  },
  "events.noSavedHallMap": {
    en: "No saved dining hall map yet",
    es: "Aún no hay un mapa del comedor guardado",
    he: "אין עדיין מפת חדר אוכל שמורה"
  },
  "events.hallMapFromDining": {
    en: "Pulled from the Dining Manager plan saved for this event.",
    es: "Tomado del plan del gestor del comedor guardado para este evento.",
    he: "נלקח מתוכנית ניהול חדר האוכל ששמורה לאירוע הזה."
  },
  "events.savedPreset": {
    en: "Saved preset",
    es: "Preajuste guardado",
    he: "הגדרה שמורה"
  },
  "events.viewOnly": {
    en: "View only",
    es: "Solo lectura",
    he: "צפייה בלבד"
  },
  "events.openDining": {
    en: "Open dining",
    es: "Abrir el comedor",
    he: "פתיחת חדר האוכל"
  },
  "events.updateInDining": {
    en: "Update in Dining Manager",
    es: "Actualizar en el gestor del comedor",
    he: "עדכון בניהול חדר האוכל"
  },
  "events.noPresetSaved": {
    en: "No Dining Manager hall map preset has been saved for this event yet.",
    es: "Aún no se ha guardado ningún preajuste del mapa del salón para este evento.",
    he: "עדיין לא נשמרה הגדרת מפת אולם לאירוע הזה בניהול חדר האוכל."
  },
  "events.hallMapPhoneHint": {
    en: "Hall map is view-only on phone screens. Use Dining Manager on a tablet, laptop, or desktop to adjust and save the dining layout.",
    es: "El mapa del salón es de solo lectura en el móvil. Usa el gestor del comedor en una tableta u ordenador para ajustar y guardar la distribución.",
    he: "מפת האולם היא לצפייה בלבד במסכי טלפון. השתמש בניהול חדר האוכל בטאבלט או במחשב כדי להתאים ולשמור את הפריסה."
  },
  "events.hallMapReadOnlyHint": {
    en: "This is a read-only event view of the Hall Map Preset selected in Dining Manager.",
    es: "Esta es una vista de solo lectura del preajuste del mapa seleccionado en el gestor del comedor.",
    he: "זוהי תצוגת אירוע לקריאה בלבד של הגדרת מפת האולם שנבחרה בניהול חדר האוכל."
  },
  "events.noSavedHallMapBody": {
    en: "Select a Hall Map Preset in Dining Manager, save the dining plan, then return here to view the exact event layout.",
    es: "Selecciona un preajuste del mapa en el gestor del comedor, guarda el plan y vuelve aquí para ver la distribución exacta del evento.",
    he: "בחר הגדרת מפת אולם בניהול חדר האוכל, שמור את התוכנית וחזור לכאן כדי לראות את פריסת האירוע המדויקת."
  },
  "events.hallMapZoomControls": {
    en: "Hall map preview zoom controls",
    es: "Controles de zoom de la vista previa del mapa",
    he: "פקדי הזום של תצוגת מפת האולם"
  },
  "events.hallMapZoomIn": {
    en: "Zoom hall map preview in",
    es: "Acercar la vista previa del mapa",
    he: "הגדלת תצוגת מפת האולם"
  },
  "events.hallMapZoomOut": {
    en: "Zoom hall map preview out",
    es: "Alejar la vista previa del mapa",
    he: "הקטנת תצוגת מפת האולם"
  },
  "events.hallMapFit": {
    en: "Fit hall map preview",
    es: "Ajustar la vista previa del mapa",
    he: "התאמת תצוגת מפת האולם"
  },

  "events.vendorsForEvent": {
    en: "Vendors for this event",
    es: "Proveedores de este evento",
    he: "ספקים לאירוע הזה"
  },
  "events.vendor": { en: "Vendor", es: "Proveedor", he: "ספק" },
  "events.order": { en: "Order", es: "Pedido", he: "הזמנה" },

  "events.portalLink": {
    en: "Client portal link",
    es: "Enlace del portal del cliente",
    he: "קישור לפורטל הלקוח"
  },
  "events.portalLinkBlurb": {
    en: "Anyone with this link can open the portal for this event.",
    es: "Cualquiera con este enlace puede abrir el portal de este evento.",
    he: "כל מי שיש לו את הקישור הזה יכול לפתוח את הפורטל של האירוע."
  },
  "events.openPortal": {
    en: "Open portal",
    es: "Abrir el portal",
    he: "פתיחת הפורטל"
  },
  "events.portalPreview": {
    en: "Client portal preview",
    es: "Vista previa del portal del cliente",
    he: "תצוגה מקדימה של פורטל הלקוח"
  },
  "events.closePortalPreview": {
    en: "Close client portal preview",
    es: "Cerrar la vista previa del portal",
    he: "סגירת התצוגה המקדימה של הפורטל"
  },
  "events.sendToClient": {
    en: "Send to client",
    es: "Enviar al cliente",
    he: "שליחה ללקוח"
  },
  "events.sharingChecklist": {
    en: "Client sharing checklist",
    es: "Lista de verificación para compartir",
    he: "רשימת בדיקה לשיתוף עם הלקוח"
  },
  "events.eventDetails": {
    en: "Event details",
    es: "Detalles del evento",
    he: "פרטי האירוע"
  },
  "events.menuSelection": {
    en: "Menu selection",
    es: "Selección del menú",
    he: "בחירת התפריט"
  },
  "events.nothingSelected": {
    en: "Nothing selected yet",
    es: "Aún no hay nada seleccionado",
    he: "עדיין לא נבחר דבר"
  },
  "events.noPublishedMenu": {
    en: "Your venue has not published menu selections yet.",
    es: "Tu local aún no ha publicado las selecciones del menú.",
    he: "המקום שלך עדיין לא פרסם בחירות תפריט."
  },
  "events.contactVenueForGuests": {
    en: "Contact the venue to change the guest count.",
    es: "Contacta al local para cambiar el número de invitados.",
    he: "צור קשר עם המקום כדי לשנות את מספר האורחים."
  },
  "events.tableclothOptions": {
    en: "Tablecloth options",
    es: "Opciones de mantelería",
    he: "אפשרויות מפות שולחן"
  },
  "events.drinks": { en: "Drinks", es: "Bebidas", he: "משקאות" },
  "events.invoiceTotal": {
    en: "Invoice total",
    es: "Total de la factura",
    he: "סך החשבונית"
  },
  "events.balanceDue": {
    en: "Balance due",
    es: "Saldo pendiente",
    he: "יתרה לתשלום"
  },
  "events.payBalance": {
    en: "Pay balance",
    es: "Pagar el saldo",
    he: "תשלום היתרה"
  },

  "events.moveThisEvent": {
    en: "Move this event",
    es: "Mover este evento",
    he: "העברת האירוע"
  },

  "events.internalPacket": {
    en: "Internal event packet",
    es: "Dosier interno del evento",
    he: "תיק האירוע הפנימי"
  },
  "events.closePrintPacket": {
    en: "Close print packet",
    es: "Cerrar el dosier de impresión",
    he: "סגירת תיק ההדפסה"
  },
  "events.readinessBeforePrint": {
    en: "Readiness before print",
    es: "Preparación antes de imprimir",
    he: "מוכנות לפני הדפסה"
  },
  "events.kitchenProduction": {
    en: "Kitchen production",
    es: "Producción de cocina",
    he: "ייצור במטבח"
  },
  "events.setupAndDining": {
    en: "Setup and dining",
    es: "Montaje y comedor",
    he: "הקמה וחדר אוכל"
  },
  "events.dayOfTimeline": {
    en: "Day-of timeline",
    es: "Cronología del día",
    he: "ציר הזמן ליום האירוע"
  },
  "events.hallMap": { en: "Hall map", es: "Mapa del salón", he: "מפת האולם" },
  "events.coordinator": {
    en: "Coordinator",
    es: "Coordinador",
    he: "רכז"
  },
  "events.waiters": { en: "Waiters", es: "Camareros", he: "מלצרים" },
  "events.tablecloth": {
    en: "Tablecloth",
    es: "Mantelería",
    he: "מפת שולחן"
  },
  "events.setupTime": {
    en: "Setup time",
    es: "Hora del montaje",
    he: "שעת ההקמה"
  },
  "events.startTime": {
    en: "Start time",
    es: "Hora de inicio",
    he: "שעת ההתחלה"
  },
  "events.washingTime": {
    en: "Washing time",
    es: "Hora del lavado",
    he: "שעת הנטילה"
  },
  "events.loadingKitchenSheetShort": {
    en: "Loading kitchen sheet...",
    es: "Cargando la hoja de cocina...",
    he: "טוען את גיליון המטבח..."
  },
  "events.noInternalNotes": {
    en: "No internal notes saved yet.",
    es: "Aún no hay notas internas guardadas.",
    he: "לא נשמרו עדיין הערות פנימיות."
  },
  "events.noTimelineInstructions": {
    en: "No timeline instructions saved yet.",
    es: "Aún no hay instrucciones de cronología guardadas.",
    he: "לא נשמרו עדיין הוראות ציר זמן."
  },
  "events.noKitchenSheetItems": {
    en: "No selected menu items are ready for the kitchen sheet yet.",
    es: "Aún no hay platos seleccionados listos para la hoja de cocina.",
    he: "אין עדיין פריטי תפריט מוכנים לגיליון המטבח."
  },
  "events.pending": { en: "Pending", es: "Pendiente", he: "בהמתנה" }
});
