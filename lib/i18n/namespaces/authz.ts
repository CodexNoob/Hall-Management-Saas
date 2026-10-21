import { defineMessages } from "@/lib/i18n/types";

/**
 * The permission catalog, in words.
 *
 * One `label` and one `desc` entry per key in `lib/authz/catalog.ts`, named
 * `authz.` plus the permission key so the two files cannot drift apart without
 * a lookup miss that is visible on the Roles & Permissions screen. The catalog
 * itself keeps its English, which is what `GET /api/access/catalog` sends, what
 * the seed writes, and what any caller without a translator sees.
 *
 * The keys themselves - `event.status.update` and the rest - are never
 * translated. They are the identifiers every guard compares against.
 */
export const authzMessages = defineMessages({
  "authz.group.Events & bookings": {
    en: "Events & bookings",
    es: "Eventos y reservas",
    he: "אירועים והזמנות"
  },
  "authz.group.Documents": {
    en: "Documents",
    es: "Documentos",
    he: "מסמכים"
  },
  "authz.group.Menu": { en: "Menu", es: "Menú", he: "תפריט" },
  "authz.group.Event menus": {
    en: "Event menus",
    es: "Menús de eventos",
    he: "תפריטי אירועים"
  },
  "authz.group.Kitchen": { en: "Kitchen", es: "Cocina", he: "מטבח" },
  "authz.group.Dining": { en: "Dining", es: "Comedor", he: "חדר אוכל" },
  "authz.group.Venue": { en: "Venue", es: "Recinto", he: "המקום" },
  "authz.group.Records": { en: "Records", es: "Registros", he: "רשומות" },
  "authz.group.Money": { en: "Money", es: "Dinero", he: "כספים" },
  "authz.group.Access": { en: "Access", es: "Acceso", he: "הרשאות" },
  "authz.group.Configuration": {
    en: "Configuration",
    es: "Configuración",
    he: "תצורה"
  },
  "authz.group.Scheduling": {
    en: "Scheduling",
    es: "Programación",
    he: "תזמון"
  },

  "authz.calendar.read.label": {
    en: "View calendar",
    es: "Ver el calendario",
    he: "צפייה ביומן"
  },
  "authz.calendar.read.desc": {
    en: "View availability and the booking calendar.",
    es: "Ver la disponibilidad y el calendario de reservas.",
    he: "צפייה בזמינות וביומן ההזמנות."
  },
  "authz.booking.create.label": {
    en: "Create bookings",
    es: "Crear reservas",
    he: "יצירת הזמנות"
  },
  "authz.booking.create.desc": {
    en: "Hold a date and turn an inquiry into a booking.",
    es: "Reservar una fecha y convertir una consulta en una reserva.",
    he: "שמירת תאריך והפיכת פנייה להזמנה."
  },
  "authz.booking.cancel.label": {
    en: "Cancel bookings",
    es: "Cancelar reservas",
    he: "ביטול הזמנות"
  },
  "authz.booking.cancel.desc": {
    en: "Release a held date and cancel a booking.",
    es: "Liberar una fecha reservada y cancelar una reserva.",
    he: "שחרור תאריך שמור וביטול הזמנה."
  },
  "authz.event.read.label": {
    en: "View events",
    es: "Ver eventos",
    he: "צפייה באירועים"
  },
  "authz.event.read.desc": {
    en: "Open the event manager and read event records.",
    es: "Abrir el gestor de eventos y leer los registros de eventos.",
    he: "פתיחת מנהל האירועים וקריאת רשומות האירועים."
  },
  "authz.event.create.label": {
    en: "Create events",
    es: "Crear eventos",
    he: "יצירת אירועים"
  },
  "authz.event.create.desc": {
    en: "Create event records.",
    es: "Crear registros de eventos.",
    he: "יצירת רשומות אירוע."
  },
  "authz.event.update.label": {
    en: "Edit events",
    es: "Editar eventos",
    he: "עריכת אירועים"
  },
  "authz.event.update.desc": {
    en: "Change event details, timing, hall, and client.",
    es: "Cambiar los detalles, el horario, el salón y el cliente del evento.",
    he: "שינוי פרטי האירוע, השעות, האולם והלקוח."
  },
  "authz.event.delete.label": {
    en: "Delete events",
    es: "Eliminar eventos",
    he: "מחיקת אירועים"
  },
  "authz.event.delete.desc": {
    en: "Permanently remove an event record.",
    es: "Eliminar de forma permanente un registro de evento.",
    he: "הסרה לצמיתות של רשומת אירוע."
  },
  "authz.event.status.update.label": {
    en: "Change event status",
    es: "Cambiar el estado del evento",
    he: "שינוי סטטוס האירוע"
  },
  "authz.event.status.update.desc": {
    en: "Advance or roll back an event's booking status.",
    es: "Avanzar o revertir el estado de reserva de un evento.",
    he: "קידום או החזרה של סטטוס ההזמנה של אירוע."
  },
  "authz.event.document.generate.label": {
    en: "Generate event documents",
    es: "Generar documentos del evento",
    he: "הפקת מסמכי אירוע"
  },
  "authz.event.document.generate.desc": {
    en: "Render and download event PDFs and contracts.",
    es: "Generar y descargar PDF y contratos del evento.",
    he: "יצירה והורדה של קובצי PDF וחוזים לאירוע."
  },

  "authz.menu.read.label": {
    en: "View menu",
    es: "Ver el menú",
    he: "צפייה בתפריט"
  },
  "authz.menu.read.desc": {
    en: "View menu items, packages, and add-ons.",
    es: "Ver los platos, paquetes y extras del menú.",
    he: "צפייה בפריטי התפריט, בחבילות ובתוספות."
  },
  "authz.menu.create.label": {
    en: "Create menu entries",
    es: "Crear entradas del menú",
    he: "יצירת פריטי תפריט"
  },
  "authz.menu.create.desc": {
    en: "Add menu items, packages, and add-ons.",
    es: "Añadir platos, paquetes y extras.",
    he: "הוספת פריטי תפריט, חבילות ותוספות."
  },
  "authz.menu.update.label": {
    en: "Edit menu entries",
    es: "Editar entradas del menú",
    he: "עריכת פריטי תפריט"
  },
  "authz.menu.update.desc": {
    en: "Change menu items, packages, add-ons, and pricing.",
    es: "Cambiar platos, paquetes, extras y precios.",
    he: "שינוי פריטי תפריט, חבילות, תוספות ומחירים."
  },
  "authz.menu.delete.label": {
    en: "Delete menu entries",
    es: "Eliminar entradas del menú",
    he: "מחיקת פריטי תפריט"
  },
  "authz.menu.delete.desc": {
    en: "Remove menu items, packages, and add-ons.",
    es: "Quitar platos, paquetes y extras.",
    he: "הסרת פריטי תפריט, חבילות ותוספות."
  },
  "authz.menu.import.label": {
    en: "Bulk import menu",
    es: "Importar el menú en bloque",
    he: "ייבוא תפריט בכמות"
  },
  "authz.menu.import.desc": {
    en: "Replace or extend the menu from an uploaded file.",
    es: "Reemplazar o ampliar el menú desde un archivo subido.",
    he: "החלפה או הרחבה של התפריט מתוך קובץ שהועלה."
  },

  "authz.eventmenu.read.label": {
    en: "View event menus",
    es: "Ver los menús de eventos",
    he: "צפייה בתפריטי אירועים"
  },
  "authz.eventmenu.read.desc": {
    en: "Read the menu chosen for an event.",
    es: "Leer el menú elegido para un evento.",
    he: "קריאת התפריט שנבחר לאירוע."
  },
  "authz.eventmenu.update.label": {
    en: "Edit event menus",
    es: "Editar los menús de eventos",
    he: "עריכת תפריטי אירועים"
  },
  "authz.eventmenu.update.desc": {
    en: "Add, remove, and re-price lines on an event's menu.",
    es: "Añadir, quitar y volver a tarifar líneas del menú de un evento.",
    he: "הוספה, הסרה ותמחור מחדש של שורות בתפריט האירוע."
  },
  "authz.eventmenu.confirm.label": {
    en: "Confirm event menus",
    es: "Confirmar los menús de eventos",
    he: "אישור תפריטי אירועים"
  },
  "authz.eventmenu.confirm.desc": {
    en: "Lock an event's menu as final for the kitchen.",
    es: "Bloquear el menú de un evento como definitivo para la cocina.",
    he: "נעילת תפריט האירוע כסופי עבור המטבח."
  },

  "authz.kitchen.read.label": {
    en: "View kitchen",
    es: "Ver la cocina",
    he: "צפייה במטבח"
  },
  "authz.kitchen.read.desc": {
    en: "Open the kitchen dashboard and production views.",
    es: "Abrir el panel de cocina y las vistas de producción.",
    he: "פתיחת לוח המטבח ותצוגות ההכנה."
  },
  "authz.kitchen.read.all.label": {
    en: "View the whole kitchen board",
    es: "Ver todo el tablero de cocina",
    he: "צפייה בכל לוח המטבח"
  },
  "authz.kitchen.read.all.desc": {
    en: "See every event and dish, not only the ones assigned to you.",
    es: "Ver todos los eventos y platos, no solo los asignados a ti.",
    he: "צפייה בכל האירועים והמנות, לא רק באלה ששובצו לך."
  },
  "authz.kitchen.status.update.label": {
    en: "Update production status",
    es: "Actualizar el estado de producción",
    he: "עדכון סטטוס ההכנה"
  },
  "authz.kitchen.status.update.desc": {
    en: "Advance production status on kitchen items.",
    es: "Avanzar el estado de producción de los platos en cocina.",
    he: "קידום סטטוס ההכנה של פריטי המטבח."
  },
  "authz.kitchen.event.create.label": {
    en: "Create kitchen events",
    es: "Crear eventos de cocina",
    he: "יצירת אירועי מטבח"
  },
  "authz.kitchen.event.create.desc": {
    en: "Create standalone kitchen events with no booking behind them.",
    es: "Crear eventos de cocina independientes, sin una reserva detrás.",
    he: "יצירת אירועי מטבח עצמאיים ללא הזמנה מאחוריהם."
  },
  "authz.kitchen.worker.read.label": {
    en: "View kitchen workers",
    es: "Ver el personal de cocina",
    he: "צפייה בעובדי המטבח"
  },
  "authz.kitchen.worker.read.desc": {
    en: "See the kitchen roster.",
    es: "Ver la plantilla de cocina.",
    he: "צפייה בסידור העבודה של המטבח."
  },
  "authz.kitchen.worker.assign.label": {
    en: "Assign kitchen workers",
    es: "Asignar personal de cocina",
    he: "שיבוץ עובדי מטבח"
  },
  "authz.kitchen.worker.assign.desc": {
    en: "Add, edit, and assign workers to events and shifts.",
    es: "Añadir, editar y asignar trabajadores a eventos y turnos.",
    he: "הוספה, עריכה ושיבוץ של עובדים לאירועים ולמשמרות."
  },

  "authz.dining.read.label": {
    en: "View dining plans",
    es: "Ver los planes de comedor",
    he: "צפייה בתוכניות חדר האוכל"
  },
  "authz.dining.read.desc": {
    en: "Read seating and dining plans.",
    es: "Leer los planes de asientos y de comedor.",
    he: "קריאת תוכניות הישיבה וחדר האוכל."
  },
  "authz.dining.update.label": {
    en: "Edit dining plans",
    es: "Editar los planes de comedor",
    he: "עריכת תוכניות חדר האוכל"
  },
  "authz.dining.update.desc": {
    en: "Change seating, tables, and dining plans.",
    es: "Cambiar los asientos, las mesas y los planes de comedor.",
    he: "שינוי הישיבה, השולחנות ותוכניות חדר האוכל."
  },

  "authz.hall.read.label": {
    en: "View halls",
    es: "Ver los salones",
    he: "צפייה באולמות"
  },
  "authz.hall.read.desc": {
    en: "Read the hall list, capacities, and pricing.",
    es: "Leer la lista de salones, sus capacidades y sus precios.",
    he: "קריאת רשימת האולמות, הקיבולות והמחירים."
  },
  "authz.hall.create.label": {
    en: "Create halls",
    es: "Crear salones",
    he: "יצירת אולמות"
  },
  "authz.hall.create.desc": {
    en: "Add a hall to the venue.",
    es: "Añadir un salón al recinto.",
    he: "הוספת אולם למקום."
  },
  "authz.hall.update.label": {
    en: "Edit halls",
    es: "Editar salones",
    he: "עריכת אולמות"
  },
  "authz.hall.update.desc": {
    en: "Change a hall's name, capacity, colour, and daily event limit.",
    es: "Cambiar el nombre, la capacidad, el color y el límite diario de eventos de un salón.",
    he: "שינוי שם האולם, הקיבולת, הצבע ומגבלת האירועים היומית."
  },
  "authz.hall.price.update.label": {
    en: "Set hall pricing",
    es: "Definir los precios de los salones",
    he: "קביעת מחירי אולם"
  },
  "authz.hall.price.update.desc": {
    en: "Change what a hall costs, including member rates.",
    es: "Cambiar lo que cuesta un salón, incluidas las tarifas para socios.",
    he: "שינוי עלות האולם, כולל תעריפי חברים."
  },
  "authz.hall.delete.label": {
    en: "Remove halls",
    es: "Quitar salones",
    he: "הסרת אולמות"
  },
  "authz.hall.delete.desc": {
    en: "Deactivate a hall or delete one that nothing references yet.",
    es: "Desactivar un salón o eliminar uno al que todavía nada hace referencia.",
    he: "השבתת אולם או מחיקת אולם שדבר עדיין אינו מפנה אליו."
  },
  "authz.hallmap.read.label": {
    en: "View hall maps",
    es: "Ver los mapas de salón",
    he: "צפייה במפות אולם"
  },
  "authz.hallmap.read.desc": {
    en: "Open saved floor plans and shape libraries.",
    es: "Abrir los planos guardados y las bibliotecas de formas.",
    he: "פתיחת תוכניות קומה שמורות וספריות צורות."
  },
  "authz.hallmap.update.label": {
    en: "Edit hall maps",
    es: "Editar los mapas de salón",
    he: "עריכת מפות אולם"
  },
  "authz.hallmap.update.desc": {
    en: "Draw and save floor plans and shape library entries.",
    es: "Dibujar y guardar planos y entradas de la biblioteca de formas.",
    he: "שרטוט ושמירה של תוכניות קומה ופריטי ספריית צורות."
  },

  "authz.client.read.label": {
    en: "View clients",
    es: "Ver los clientes",
    he: "צפייה בלקוחות"
  },
  "authz.client.read.desc": {
    en: "Read the client directory and client history.",
    es: "Leer el directorio de clientes y su historial.",
    he: "קריאת ספריית הלקוחות וההיסטוריה שלהם."
  },
  "authz.client.create.label": {
    en: "Create clients",
    es: "Crear clientes",
    he: "יצירת לקוחות"
  },
  "authz.client.create.desc": {
    en: "Add client records.",
    es: "Añadir registros de clientes.",
    he: "הוספת רשומות לקוח."
  },
  "authz.client.update.label": {
    en: "Edit clients",
    es: "Editar clientes",
    he: "עריכת לקוחות"
  },
  "authz.client.update.desc": {
    en: "Change client details and contact information.",
    es: "Cambiar los datos y la información de contacto de un cliente.",
    he: "שינוי פרטי הלקוח ופרטי הקשר."
  },
  "authz.client.delete.label": {
    en: "Delete clients",
    es: "Eliminar clientes",
    he: "מחיקת לקוחות"
  },
  "authz.client.delete.desc": {
    en: "Permanently remove a client record.",
    es: "Eliminar de forma permanente un registro de cliente.",
    he: "הסרה לצמיתות של רשומת לקוח."
  },
  "authz.vendor.read.label": {
    en: "View vendors",
    es: "Ver los proveedores",
    he: "צפייה בספקים"
  },
  "authz.vendor.read.desc": {
    en: "Read the vendor directory.",
    es: "Leer el directorio de proveedores.",
    he: "קריאת ספריית הספקים."
  },
  "authz.vendor.manage.label": {
    en: "Manage vendors",
    es: "Gestionar los proveedores",
    he: "ניהול ספקים"
  },
  "authz.vendor.manage.desc": {
    en: "Create, edit, and remove vendor records.",
    es: "Crear, editar y eliminar registros de proveedores.",
    he: "יצירה, עריכה והסרה של רשומות ספקים."
  },

  "authz.file.read.label": {
    en: "View files",
    es: "Ver los archivos",
    he: "צפייה בקבצים"
  },
  "authz.file.read.desc": {
    en: "Browse and download stored files.",
    es: "Explorar y descargar los archivos guardados.",
    he: "עיון והורדה של קבצים שמורים."
  },
  "authz.file.create.label": {
    en: "Upload files",
    es: "Subir archivos",
    he: "העלאת קבצים"
  },
  "authz.file.create.desc": {
    en: "Upload files and create folders.",
    es: "Subir archivos y crear carpetas.",
    he: "העלאת קבצים ויצירת תיקיות."
  },
  "authz.file.delete.label": {
    en: "Delete files",
    es: "Eliminar archivos",
    he: "מחיקת קבצים"
  },
  "authz.file.delete.desc": {
    en: "Permanently remove stored files and folders.",
    es: "Eliminar de forma permanente archivos y carpetas guardados.",
    he: "הסרה לצמיתות של קבצים ותיקיות שמורים."
  },

  "authz.invoice.read.label": {
    en: "View invoices",
    es: "Ver las facturas",
    he: "צפייה בחשבוניות"
  },
  "authz.invoice.read.desc": {
    en: "Read invoices, balances, and payment history.",
    es: "Leer facturas, saldos e historial de pagos.",
    he: "קריאת חשבוניות, יתרות והיסטוריית תשלומים."
  },
  "authz.invoice.create.label": {
    en: "Create invoices",
    es: "Crear facturas",
    he: "יצירת חשבוניות"
  },
  "authz.invoice.create.desc": {
    en: "Raise a new invoice against an event or client.",
    es: "Emitir una factura nueva a un evento o a un cliente.",
    he: "הפקת חשבונית חדשה לאירוע או ללקוח."
  },
  "authz.invoice.update.label": {
    en: "Edit invoices",
    es: "Editar facturas",
    he: "עריכת חשבוניות"
  },
  "authz.invoice.update.desc": {
    en: "Change invoice lines, discounts, taxes, and schedules.",
    es: "Cambiar las líneas, los descuentos, los impuestos y los plazos de una factura.",
    he: "שינוי שורות החשבונית, ההנחות, המסים ולוחות התשלום."
  },
  "authz.invoice.void.label": {
    en: "Void invoices",
    es: "Anular facturas",
    he: "ביטול חשבוניות"
  },
  "authz.invoice.void.desc": {
    en: "Void an issued invoice.",
    es: "Anular una factura ya emitida.",
    he: "ביטול חשבונית שכבר הופקה."
  },
  "authz.payment.record.label": {
    en: "Record payments",
    es: "Registrar pagos",
    he: "רישום תשלומים"
  },
  "authz.payment.record.desc": {
    en: "Record money received against an invoice.",
    es: "Registrar el dinero recibido de una factura.",
    he: "רישום כסף שהתקבל על חשבון חשבונית."
  },
  "authz.payment.refund.label": {
    en: "Refund payments",
    es: "Reembolsar pagos",
    he: "החזר תשלומים"
  },
  "authz.payment.refund.desc": {
    en: "Send money back to a client.",
    es: "Devolver dinero a un cliente.",
    he: "החזרת כסף ללקוח."
  },
  "authz.payment.notify.label": {
    en: "Send payment emails",
    es: "Enviar correos de pago",
    he: "שליחת מיילי תשלום"
  },
  "authz.payment.notify.desc": {
    en: "Email invoices, receipts, and payment requests to clients.",
    es: "Enviar por correo facturas, recibos y solicitudes de pago a los clientes.",
    he: "שליחת חשבוניות, קבלות ובקשות תשלום ללקוחות בדוא״ל."
  },
  "authz.bank.connect.label": {
    en: "Connect bank accounts",
    es: "Conectar cuentas bancarias",
    he: "חיבור חשבונות בנק"
  },
  "authz.bank.connect.desc": {
    en: "Link and unlink the organization's bank feed.",
    es: "Vincular y desvincular el feed bancario de la organización.",
    he: "חיבור וניתוק של הזנת הבנק של הארגון."
  },
  "authz.report.read.label": {
    en: "View financial reports",
    es: "Ver los informes financieros",
    he: "צפייה בדוחות כספיים"
  },
  "authz.report.read.desc": {
    en: "Read revenue, aging, and reconciliation reports.",
    es: "Leer informes de ingresos, antigüedad de saldos y conciliación.",
    he: "קריאת דוחות הכנסות, יתרות פתוחות והתאמות."
  },

  "authz.staff.read.label": {
    en: "View staff directory",
    es: "Ver el directorio de personal",
    he: "צפייה בספריית הצוות"
  },
  "authz.staff.read.desc": {
    en: "See who works here and what they hold.",
    es: "Ver quién trabaja aquí y qué permisos tiene.",
    he: "צפייה במי עובד כאן ובמה שהוא מחזיק."
  },
  "authz.staff.invite.label": {
    en: "Invite staff",
    es: "Invitar personal",
    he: "הזמנת אנשי צוות"
  },
  "authz.staff.invite.desc": {
    en: "Send an invitation to a new staff member.",
    es: "Enviar una invitación a un nuevo miembro del personal.",
    he: "שליחת הזמנה לאיש צוות חדש."
  },
  "authz.staff.update.label": {
    en: "Edit staff profiles",
    es: "Editar los perfiles del personal",
    he: "עריכת פרופילי צוות"
  },
  "authz.staff.update.desc": {
    en: "Change a staff member's name, phone, and title.",
    es: "Cambiar el nombre, el teléfono y el cargo de un miembro del personal.",
    he: "שינוי שם, טלפון ותפקיד של איש צוות."
  },
  "authz.staff.deactivate.label": {
    en: "Deactivate staff",
    es: "Desactivar personal",
    he: "השבתת אנשי צוות"
  },
  "authz.staff.deactivate.desc": {
    en: "Revoke a staff member's access to this organization.",
    es: "Revocar el acceso de un miembro del personal a esta organización.",
    he: "שלילת הגישה של איש צוות לארגון הזה."
  },
  "authz.role.read.label": {
    en: "View roles",
    es: "Ver los roles",
    he: "צפייה בתפקידים"
  },
  "authz.role.read.desc": {
    en: "Read the role list, the catalog, and effective permissions.",
    es: "Leer la lista de roles, el catálogo y los permisos efectivos.",
    he: "קריאת רשימת התפקידים, הקטלוג וההרשאות בפועל."
  },
  "authz.role.manage.label": {
    en: "Author roles",
    es: "Crear y editar roles",
    he: "כתיבת תפקידים"
  },
  "authz.role.manage.desc": {
    en: "Create, edit, and delete roles and what they grant.",
    es: "Crear, editar y eliminar roles y lo que conceden.",
    he: "יצירה, עריכה ומחיקה של תפקידים ושל מה שהם מעניקים."
  },
  "authz.role.assign.label": {
    en: "Assign roles",
    es: "Asignar roles",
    he: "שיוך תפקידים"
  },
  "authz.role.assign.desc": {
    en: "Put people into roles that already exist.",
    es: "Asignar personas a roles que ya existen.",
    he: "שיוך אנשים לתפקידים קיימים."
  },
  "authz.permission.override.label": {
    en: "Override permissions",
    es: "Anular permisos",
    he: "עקיפת הרשאות"
  },
  "authz.permission.override.desc": {
    en: "Grant or deny an individual permission to one person.",
    es: "Conceder o denegar un permiso concreto a una persona.",
    he: "הענקה או שלילה של הרשאה בודדת לאדם אחד."
  },
  "authz.audit.read.label": {
    en: "Read the audit trail",
    es: "Leer el registro de auditoría",
    he: "קריאת יומן הביקורת"
  },
  "authz.audit.read.desc": {
    en: "Read and export the privilege-change audit log.",
    es: "Leer y exportar el registro de cambios de privilegios.",
    he: "קריאה וייצוא של יומן שינויי ההרשאות."
  },
  "authz.activity.read.label": {
    en: "Read the activity history",
    es: "Leer el historial de actividad",
    he: "קריאת היסטוריית הפעילות"
  },
  "authz.activity.read.desc": {
    en: "Read and export the record of what was changed across the organization.",
    es: "Leer y exportar el registro de lo que se ha cambiado en toda la organización.",
    he: "קריאה וייצוא של התיעוד לגבי מה שהשתנה בכל הארגון."
  },

  "authz.settings.read.label": {
    en: "View settings",
    es: "Ver los ajustes",
    he: "צפייה בהגדרות"
  },
  "authz.settings.read.desc": {
    en: "Read organization settings.",
    es: "Leer los ajustes de la organización.",
    he: "קריאת הגדרות הארגון."
  },
  "authz.settings.update.label": {
    en: "Edit settings",
    es: "Editar los ajustes",
    he: "עריכת ההגדרות"
  },
  "authz.settings.update.desc": {
    en: "Change organization settings and preferences.",
    es: "Cambiar los ajustes y las preferencias de la organización.",
    he: "שינוי הגדרות והעדפות הארגון."
  },
  "authz.integration.manage.label": {
    en: "Manage integrations",
    es: "Gestionar las integraciones",
    he: "ניהול אינטגרציות"
  },
  "authz.integration.manage.desc": {
    en: "Connect and configure third-party integrations.",
    es: "Conectar y configurar integraciones de terceros.",
    he: "חיבור והגדרה של אינטגרציות חיצוניות."
  },
  "authz.eventtype.create.label": {
    en: "Create event types",
    es: "Crear tipos de evento",
    he: "יצירת סוגי אירוע"
  },
  "authz.eventtype.create.desc": {
    en: "Add an event type to the list bookings choose from.",
    es: "Añadir un tipo de evento a la lista entre la que eligen las reservas.",
    he: "הוספת סוג אירוע לרשימה שממנה בוחרות ההזמנות."
  },
  "authz.eventtype.update.label": {
    en: "Edit event types",
    es: "Editar tipos de evento",
    he: "עריכת סוגי אירוע"
  },
  "authz.eventtype.update.desc": {
    en: "Rename an event type and change which days it is valid on.",
    es: "Renombrar un tipo de evento y cambiar los días en los que es válido.",
    he: "שינוי שם של סוג אירוע ושינוי הימים שבהם הוא תקף."
  },
  "authz.eventtype.delete.label": {
    en: "Remove event types",
    es: "Quitar tipos de evento",
    he: "הסרת סוגי אירוע"
  },
  "authz.eventtype.delete.desc": {
    en: "Deactivate an event type or delete one no event has used yet.",
    es: "Desactivar un tipo de evento o eliminar uno que ningún evento haya usado todavía.",
    he: "השבתת סוג אירוע או מחיקת סוג שאף אירוע עדיין לא השתמש בו."
  },
  "authz.organization.reset.label": {
    en: "Reset organization data",
    es: "Restablecer los datos de la organización",
    he: "איפוס נתוני הארגון"
  },
  "authz.organization.reset.desc": {
    en: "Permanently delete this organization's events, menus, configuration or staff access. Cannot be undone.",
    es: "Eliminar de forma permanente los eventos, menús, configuración o accesos del personal de esta organización. No se puede deshacer.",
    he: "מחיקה לצמיתות של האירועים, התפריטים, התצורה או גישת הצוות של הארגון. לא ניתן לבטל."
  },

  "authz.schoolcycle.read.label": {
    en: "View school schedule",
    es: "Ver el calendario escolar",
    he: "צפייה בלוח הזמנים של בית הספר"
  },
  "authz.schoolcycle.read.desc": {
    en: "Read school cycles and the recurring schedule.",
    es: "Leer los ciclos escolares y el horario recurrente.",
    he: "קריאת מחזורי בית הספר ולוח הזמנים החוזר."
  },
  "authz.schoolcycle.manage.label": {
    en: "Manage school schedule",
    es: "Gestionar el calendario escolar",
    he: "ניהול לוח הזמנים של בית הספר"
  },
  "authz.schoolcycle.manage.desc": {
    en: "Maintain school cycles and the recurring schedule.",
    es: "Mantener los ciclos escolares y el horario recurrente.",
    he: "תחזוקת מחזורי בית הספר ולוח הזמנים החוזר."
  },
  "authz.note.manage.label": {
    en: "Manage day notes",
    es: "Gestionar las notas del día",
    he: "ניהול הערות היום"
  },
  "authz.note.manage.desc": {
    en: "Write and clear the shared notes for a day.",
    es: "Escribir y borrar las notas compartidas de un día.",
    he: "כתיבה וניקוי של ההערות המשותפות ליום."
  }
});
