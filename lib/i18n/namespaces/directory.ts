import { defineMessages } from "@/lib/i18n/types";

/**
 * Clients and Vendors. Both are directory screens kept out of the shipped
 * navigation, but they are reachable and their chrome still has to translate.
 */
export const directoryMessages = defineMessages({
  "clients.title": { en: "Clients", es: "Clientes", he: "לקוחות" },
  "clients.directory": {
    en: "Client directory",
    es: "Directorio de clientes",
    he: "ספריית הלקוחות"
  },
  "clients.blurb": {
    en: "Manage client contacts, event history, and internal notes.",
    es: "Gestiona los contactos de clientes, el historial de eventos y las notas internas.",
    he: "ניהול אנשי קשר של לקוחות, היסטוריית אירועים והערות פנימיות."
  },
  "clients.new": {
    en: "New client",
    es: "Nuevo cliente",
    he: "לקוח חדש"
  },
  "clients.addToDirectory": {
    en: "Add a client to the organization directory.",
    es: "Agrega un cliente al directorio de la organización.",
    he: "הוספת לקוח לספריית הארגון."
  },
  "clients.closeDetails": {
    en: "Close client details",
    es: "Cerrar los detalles del cliente",
    he: "סגירת פרטי הלקוח"
  },
  "clients.name": {
    en: "Client name",
    es: "Nombre del cliente",
    he: "שם הלקוח"
  },
  "clients.search": {
    en: "Search name, email, phone or tag",
    es: "Buscar nombre, correo, teléfono o etiqueta",
    he: "חיפוש שם, דוא״ל, טלפון או תגית"
  },
  "clients.total": {
    en: "Total clients",
    es: "Clientes totales",
    he: "סך הלקוחות"
  },
  "clients.active": {
    en: "Active clients",
    es: "Clientes activos",
    he: "לקוחות פעילים"
  },
  "clients.upcomingEvents": {
    en: "Upcoming events",
    es: "Próximos eventos",
    he: "אירועים קרובים"
  },
  "clients.openEvents": {
    en: "Open events",
    es: "Eventos abiertos",
    he: "אירועים פתוחים"
  },
  "clients.outstanding": {
    en: "Outstanding",
    es: "Pendiente",
    he: "יתרה פתוחה"
  },
  "clients.billed": { en: "Billed", es: "Facturado", he: "חויב" },
  "clients.lead": { en: "Lead", es: "Prospecto", he: "ליד" },
  "clients.recentActivity": {
    en: "Recent activity",
    es: "Actividad reciente",
    he: "פעילות אחרונה"
  },
  "clients.files": { en: "Files", es: "Archivos", he: "קבצים" },
  "clients.create": {
    en: "Create client",
    es: "Crear cliente",
    he: "יצירת לקוח"
  },
  "clients.readOnly": {
    en: "You have read-only access",
    es: "Tienes acceso de solo lectura",
    he: "יש לך גישת קריאה בלבד"
  },
  "clients.orgRecords": {
    en: "Organization client records",
    es: "Registros de clientes de la organización",
    he: "רשומות הלקוחות של הארגון"
  },
  "clients.currentlyActive": {
    en: "Currently active",
    es: "Activos actualmente",
    he: "פעילים כעת"
  },
  "clients.scheduledEvents": {
    en: "Scheduled client events",
    es: "Eventos de clientes programados",
    he: "אירועי לקוחות מתוכננים"
  },
  "clients.acrossOpenInvoices": {
    en: "Across open invoices",
    es: "En facturas abiertas",
    he: "בחשבוניות פתוחות"
  },
  "clients.noContactDetails": {
    en: "No contact details",
    es: "Sin datos de contacto",
    he: "אין פרטי קשר"
  },
  "clients.noEmail": { en: "No email", es: "Sin correo", he: "אין דוא״ל" },
  "clients.noPhone": { en: "No phone", es: "Sin teléfono", he: "אין טלפון" },
  "clients.markInactive": {
    en: "Mark inactive",
    es: "Marcar como inactivo",
    he: "סימון כלא פעיל"
  },
  "clients.allInvoices": {
    en: "All invoices",
    es: "Todas las facturas",
    he: "כל החשבוניות"
  },
  "clients.paidTransactions": {
    en: "Paid transactions",
    es: "Transacciones pagadas",
    he: "תנועות ששולמו"
  },
  "clients.openBalances": {
    en: "Open balances",
    es: "Saldos abiertos",
    he: "יתרות פתוחות"
  },
  "clients.linkedDocuments": {
    en: "Linked documents",
    es: "Documentos vinculados",
    he: "מסמכים מקושרים"
  },
  "clients.hallNotAssigned": {
    en: "Hall not assigned",
    es: "Salón sin asignar",
    he: "לא שויך אולם"
  },
  "clients.paid": { en: "Paid", es: "Pagado", he: "שולם" },
  "clients.events": { en: "Events", es: "Eventos", he: "אירועים" },
  "clients.internalNotes": {
    en: "Internal notes",
    es: "Notas internas",
    he: "הערות פנימיות"
  },
  "clients.noneYet": {
    en: "No clients yet",
    es: "Aún no hay clientes",
    he: "אין עדיין לקוחות"
  },
  "clients.noneYetBody": {
    en: "Create the first client or create an event to populate the directory.",
    es: "Crea el primer cliente o crea un evento para llenar el directorio.",
    he: "צור את הלקוח הראשון או צור אירוע כדי לאכלס את הספרייה."
  },
  "clients.noMatching": {
    en: "No matching clients",
    es: "No hay clientes coincidentes",
    he: "אין לקוחות תואמים"
  },
  "clients.noMatchingBody": {
    en: "Adjust your search or status filter.",
    es: "Ajusta tu búsqueda o el filtro de estado.",
    he: "שנה את החיפוש או את מסנן הסטטוס."
  },
  "clients.noEvents": {
    en: "No events",
    es: "No hay eventos",
    he: "אין אירועים"
  },
  "clients.noEventsBody": {
    en: "Create an event for this client.",
    es: "Crea un evento para este cliente.",
    he: "צור אירוע ללקוח הזה."
  },
  "clients.noActivity": {
    en: "No activity yet",
    es: "Aún no hay actividad",
    he: "אין עדיין פעילות"
  },
  "clients.noActivityBody": {
    en: "Client changes and linked actions will appear here.",
    es: "Los cambios del cliente y las acciones vinculadas aparecerán aquí.",
    he: "שינויים בלקוח ופעולות מקושרות יופיעו כאן."
  },

  "vendors.title": {
    en: "Vendors",
    es: "Proveedores",
    he: "ספקים"
  },
  "vendors.directory": {
    en: "Vendor directory",
    es: "Directorio de proveedores",
    he: "ספריית הספקים"
  },
  "vendors.blurb": {
    en: "Manage suppliers, service providers, contacts, contracts, and vendor activity.",
    es: "Gestiona suministradores, proveedores de servicios, contactos, contratos y su actividad.",
    he: "ניהול ספקים, נותני שירות, אנשי קשר, חוזים ופעילות הספקים."
  },
  "vendors.new": {
    en: "New vendor",
    es: "Nuevo proveedor",
    he: "ספק חדש"
  },
  "vendors.add": {
    en: "Add vendor",
    es: "Agregar proveedor",
    he: "הוספת ספק"
  },
  "vendors.edit": {
    en: "Edit vendor",
    es: "Editar proveedor",
    he: "עריכת ספק"
  },
  "vendors.name": {
    en: "Vendor name",
    es: "Nombre del proveedor",
    he: "שם הספק"
  },
  "vendors.closeDialog": {
    en: "Close vendor dialog",
    es: "Cerrar el diálogo del proveedor",
    he: "סגירת חלון הספק"
  },
  "vendors.search": {
    en: "Search vendors",
    es: "Buscar proveedores",
    he: "חיפוש ספקים"
  },
  "vendors.total": {
    en: "Total vendors",
    es: "Proveedores totales",
    he: "סך הספקים"
  },
  "vendors.active": {
    en: "Active vendors",
    es: "Proveedores activos",
    he: "ספקים פעילים"
  },
  "vendors.inactive": {
    en: "Inactive vendors",
    es: "Proveedores inactivos",
    he: "ספקים לא פעילים"
  },
  "vendors.verifiedActive": {
    en: "Verified and active",
    es: "Verificados y activos",
    he: "מאומתים ופעילים"
  },
  "vendors.pendingInactive": {
    en: "Pending or inactive",
    es: "Pendientes o inactivos",
    he: "ממתינים או לא פעילים"
  },
  "vendors.allRecords": {
    en: "All vendor records",
    es: "Todos los registros de proveedores",
    he: "כל רשומות הספקים"
  },
  "vendors.categories": {
    en: "Categories",
    es: "Categorías",
    he: "קטגוריות"
  },
  "vendors.categoriesOverview": {
    en: "Categories overview",
    es: "Resumen de categorías",
    he: "סקירת הקטגוריות"
  },
  "vendors.serviceCategories": {
    en: "Service categories",
    es: "Categorías de servicio",
    he: "קטגוריות שירות"
  },
  "vendors.serviceType": {
    en: "Service type",
    es: "Tipo de servicio",
    he: "סוג השירות"
  },
  "vendors.contact": { en: "Contact", es: "Contacto", he: "איש קשר" },
  "vendors.contactPerson": {
    en: "Contact person",
    es: "Persona de contacto",
    he: "איש קשר"
  },
  "vendors.rating": {
    en: "Rating",
    es: "Valoración",
    he: "דירוג"
  },
  "vendors.allRatings": {
    en: "All ratings",
    es: "Todas las valoraciones",
    he: "כל הדירוגים"
  },
  "vendors.allStatus": {
    en: "All status",
    es: "Todos los estados",
    he: "כל הסטטוסים"
  },
  "vendors.additionalFilters": {
    en: "Additional filters",
    es: "Filtros adicionales",
    he: "מסננים נוספים"
  },
  "vendors.linkedEvents": {
    en: "Linked events",
    es: "Eventos vinculados",
    he: "אירועים מקושרים"
  },
  "vendors.linkedEvents60": {
    en: "Linked events (next 60 days)",
    es: "Eventos vinculados (próximos 60 días)",
    he: "אירועים מקושרים (60 הימים הקרובים)"
  },
  "vendors.assignToEvent": {
    en: "Assign to event",
    es: "Asignar a un evento",
    he: "שיוך לאירוע"
  },
  "vendors.contractStatus": {
    en: "Contract status",
    es: "Estado del contrato",
    he: "סטטוס החוזה"
  },
  "vendors.contractReminder": {
    en: "Contract reminder",
    es: "Recordatorio de contrato",
    he: "תזכורת חוזה"
  },
  "vendors.history": {
    en: "Vendor history (recent)",
    es: "Historial del proveedor (reciente)",
    he: "היסטוריית הספק (אחרונה)"
  },
  "vendors.viewHistory": {
    en: "View history",
    es: "Ver historial",
    he: "צפייה בהיסטוריה"
  },
  "vendors.actions": {
    en: "Vendor actions",
    es: "Acciones del proveedor",
    he: "פעולות הספק"
  },
  "vendors.moreActions": {
    en: "More actions",
    es: "Más acciones",
    he: "פעולות נוספות"
  },
  "vendors.quickActions": {
    en: "Quick actions",
    es: "Acciones rápidas",
    he: "פעולות מהירות"
  },
  "vendors.pending": {
    en: "Pending",
    es: "Pendiente",
    he: "בהמתנה"
  },
  "vendors.notProvided": {
    en: "Not provided",
    es: "No proporcionado",
    he: "לא סופק"
  },
  "vendors.createFailed": {
    en: "Unable to create vendor.",
    es: "No se pudo crear el proveedor.",
    he: "לא ניתן ליצור את הספק."
  },
  "vendors.updateFailed": {
    en: "Unable to update vendor.",
    es: "No se pudo actualizar el proveedor.",
    he: "לא ניתן לעדכן את הספק."
  },
  "vendors.saveFailed": {
    en: "Unable to save vendor.",
    es: "No se pudo guardar el proveedor.",
    he: "לא ניתן לשמור את הספק."
  },
  "vendors.allCategories": {
    en: "All categories",
    es: "Todas las categorías",
    he: "כל הקטגוריות"
  },
  "vendors.actionsFor": {
    en: "Actions for {name}",
    es: "Acciones para {name}",
    he: "פעולות עבור {name}"
  },
  "vendors.serviceCompleted": {
    en: "Service completed",
    es: "Servicio completado",
    he: "השירות הושלם"
  },
  "vendors.contractRenewed": {
    en: "Contract renewed",
    es: "Contrato renovado",
    he: "החוזה חודש"
  },
  "vendors.contractExpiresIn": {
    en: "Contract expires in {days} days",
    es: "El contrato caduca en {days} días",
    he: "החוזה פג בעוד {days} ימים"
  },
  "vendors.noneYet": {
    en: "No vendors yet",
    es: "Aún no hay proveedores",
    he: "אין עדיין ספקים"
  },
  "vendors.stars4": {
    en: "4+ stars",
    es: "4+ estrellas",
    he: "4+ כוכבים"
  },
  "vendors.stars3": {
    en: "3+ stars",
    es: "3+ estrellas",
    he: "3+ כוכבים"
  },
  "vendors.upcomingCount": {
    en: "{count} upcoming",
    es: "{count} próximos",
    he: "{count} קרובים"
  },
  "vendors.category": {
    en: "Category",
    es: "Categoría",
    he: "קטגוריה"
  },
  "vendors.save": {
    en: "Save vendor",
    es: "Guardar proveedor",
    he: "שמירת הספק"
  },
  "vendors.saving": {
    en: "Saving...",
    es: "Guardando...",
    he: "שומר..."
  }
});
