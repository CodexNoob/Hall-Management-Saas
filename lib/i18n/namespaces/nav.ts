import { defineMessages } from "@/lib/i18n/types";

/**
 * The dashboard chrome: sidebar sections and items, the topbar title and its
 * jump-to search, the profile menu, the trial pill and the startup screen.
 * These are on screen on every route, so they are the first thing that has to
 * change when the language does.
 */
export const navMessages = defineMessages({
  "nav.workspace": {
    en: "Workspace",
    es: "Espacio de trabajo",
    he: "סביבת עבודה"
  },
  "nav.operations": { en: "Operations", es: "Operaciones", he: "תפעול" },
  "nav.office": { en: "Office", es: "Oficina", he: "משרד" },
  "nav.dashboard": { en: "Dashboard", es: "Panel", he: "לוח בקרה" },
  "nav.kitchen": { en: "Kitchen", es: "Cocina", he: "מטבח" },
  "nav.calendar": { en: "Calendar", es: "Calendario", he: "לוח שנה" },
  "nav.events": { en: "Events", es: "Eventos", he: "אירועים" },
  "nav.menu": { en: "Menu", es: "Menú", he: "תפריט" },
  "nav.dining": {
    en: "Dining Manager",
    es: "Gestión del comedor",
    he: "ניהול חדר אוכל"
  },
  "nav.hallMap": {
    en: "Hall Room Map",
    es: "Mapa de salones",
    he: "מפת האולם"
  },
  "nav.files": { en: "Files", es: "Archivos", he: "קבצים" },
  "nav.billing": { en: "Billing", es: "Facturación", he: "חיוב" },
  "nav.staff": { en: "Staff", es: "Personal", he: "צוות" },
  "nav.clients": { en: "Clients", es: "Clientes", he: "לקוחות" },
  "nav.vendors": { en: "Vendors", es: "Proveedores", he: "ספקים" },
  "nav.settings": { en: "Settings", es: "Configuración", he: "הגדרות" },
  "nav.access": { en: "Access", es: "Acceso", he: "הרשאות" },

  "nav.openNavigation": {
    en: "Open navigation",
    es: "Abrir navegación",
    he: "פתיחת ניווט"
  },
  "nav.closeNavigation": {
    en: "Close navigation",
    es: "Cerrar navegación",
    he: "סגירת ניווט"
  },
  "nav.profileMenu": {
    en: "Profile menu",
    es: "Menú de perfil",
    he: "תפריט פרופיל"
  },
  "nav.helpLinks": {
    en: "Help links",
    es: "Enlaces de ayuda",
    he: "קישורי עזרה"
  },
  "nav.appName": {
    en: "Hall Management SaaS",
    es: "Hall Management SaaS",
    he: "Hall Management SaaS"
  },

  "nav.search.dashboard": {
    en: "Operating day overview",
    es: "Resumen del día operativo",
    he: "סקירת יום התפעול"
  },
  "nav.search.kitchen": {
    en: "Kitchen production board",
    es: "Tablero de producción de cocina",
    he: "לוח הייצור של המטבח"
  },
  "nav.search.calendar": {
    en: "Room availability and bookings",
    es: "Disponibilidad de salones y reservas",
    he: "זמינות חדרים והזמנות"
  },
  "nav.search.events": {
    en: "Event manager workspace",
    es: "Espacio del gestor de eventos",
    he: "סביבת ניהול האירועים"
  },
  "nav.search.menu": {
    en: "Library, packages, buffet, plated, add-ons",
    es: "Biblioteca, paquetes, bufé, emplatado, extras",
    he: "ספרייה, חבילות, מזנון, מוגש, תוספות"
  },
  "nav.search.clients": {
    en: "Client directory and event history",
    es: "Directorio de clientes e historial de eventos",
    he: "ספריית לקוחות והיסטוריית אירועים"
  },
  "nav.search.billing": {
    en: "Invoices, balances, transactions",
    es: "Facturas, saldos, transacciones",
    he: "חשבוניות, יתרות, תנועות"
  },
  "nav.search.dining": {
    en: "Dining room operations",
    es: "Operaciones del comedor",
    he: "תפעול חדר האוכל"
  },
  "nav.search.hallMap": {
    en: "Hall layouts and room map",
    es: "Distribución de salones y mapa",
    he: "פריסות האולם ומפת החדרים"
  },

  "nav.placeholder.kitchen": {
    en: "Search kitchen events and items",
    es: "Buscar eventos y elementos de cocina",
    he: "חיפוש אירועים ופריטי מטבח"
  },
  "nav.placeholder.calendar": {
    en: "Search bookings, clients and halls",
    es: "Buscar reservas, clientes y salones",
    he: "חיפוש הזמנות, לקוחות ואולמות"
  },
  "nav.placeholder.menu": {
    en: "Search menu items and packages",
    es: "Buscar platos y paquetes",
    he: "חיפוש פריטי תפריט וחבילות"
  },
  "nav.placeholder.clients": {
    en: "Search clients and contact details",
    es: "Buscar clientes y datos de contacto",
    he: "חיפוש לקוחות ופרטי קשר"
  },
  "nav.placeholder.vendors": {
    en: "Search vendors and categories",
    es: "Buscar proveedores y categorías",
    he: "חיפוש ספקים וקטגוריות"
  },
  "nav.placeholder.staff": {
    en: "Search staff, roles and departments",
    es: "Buscar personal, roles y departamentos",
    he: "חיפוש צוות, תפקידים ומחלקות"
  },
  "nav.placeholder.settings": {
    en: "Search settings",
    es: "Buscar en la configuración",
    he: "חיפוש בהגדרות"
  },

  "profile.upgrade": {
    en: "Upgrade Plan",
    es: "Mejorar plan",
    he: "שדרוג תוכנית"
  },
  "profile.profile": { en: "Profile", es: "Perfil", he: "פרופיל" },
  "profile.myAccount": { en: "My Account", es: "Mi cuenta", he: "החשבון שלי" },  "profile.help": { en: "Help", es: "Ayuda", he: "עזרה" },
  "profile.logout": { en: "Logout", es: "Cerrar sesión", he: "התנתקות" },
  // A person's own language, set from the profile dialog rather than from
  // Settings - see components/forms/profile-language-field.tsx for why.
  "profile.myLanguage": {
    en: "My language",
    es: "Mi idioma",
    he: "השפה שלי"
  },
  "profile.followOrganization": {
    en: "Follow the organization",
    es: "Seguir a la organización",
    he: "לפי הארגון"
  },
  "profile.languageAppliesNow": {
    en: "Applies as soon as you choose it.",
    es: "Se aplica en cuanto lo eliges.",
    he: "חל מיד עם הבחירה."
  },
  "profile.languageSaveFailed": {
    en: "Your language could not be saved. Please try again.",
    es: "No se pudo guardar tu idioma. Inténtalo de nuevo.",
    he: "לא ניתן היה לשמור את השפה שלך. נסה שוב."
  },
  "profile.editProfile": {
    en: "Edit profile",
    es: "Editar perfil",
    he: "עריכת פרופיל"
  },
  "profile.displayName": {
    en: "Display name",
    es: "Nombre visible",
    he: "שם תצוגה"
  },
  "profile.username": {
    en: "Username",
    es: "Nombre de usuario",
    he: "שם משתמש"
  },
  "profile.blurb": {
    en: "Your profile helps your team recognize you across the dashboard.",
    es: "Tu perfil ayuda a que tu equipo te reconozca en todo el panel.",
    he: "הפרופיל שלך עוזר לצוות לזהות אותך בכל לוח הבקרה."
  },
  "profile.confirmLogout": {
    en: "Confirm logout",
    es: "Confirmar cierre de sesión",
    he: "אישור התנתקות"
  },
  "profile.logoutQuestion": {
    en: "Are you sure you want to log out of your account?",
    es: "¿Seguro que quieres cerrar sesión en tu cuenta?",
    he: "האם אתה בטוח שברצונך להתנתק מהחשבון?"
  },

  "shell.trial": { en: "Trial", es: "Prueba", he: "תקופת ניסיון" },
  "shell.trialPlan": {
    en: "Trial Plan",
    es: "Plan de prueba",
    he: "תוכנית ניסיון"
  },
  // The trial pill counts down in two widths, so the plural forms are separate
  // keys rather than one string with an "(s)" in it — Hebrew and Spanish do not
  // pluralise by appending a letter.
  "shell.trialFree": {
    en: "Free trial",
    es: "Prueba gratuita",
    he: "ניסיון חינם"
  },
  "shell.trialEndsToday": {
    en: "Ends today",
    es: "Termina hoy",
    he: "מסתיים היום"
  },
  "shell.trialToday": { en: "Today", es: "Hoy", he: "היום" },
  "shell.trialDayLeft": {
    en: "1 day left",
    es: "Queda 1 día",
    he: "נותר יום אחד"
  },
  "shell.trialDaysLeft": {
    en: "{count} days left",
    es: "Quedan {count} días",
    he: "נותרו {count} ימים"
  },
  "shell.trialDaysShort": {
    en: "{count}d",
    es: "{count}d",
    he: "{count} י׳"
  },
  "shell.trialDayRemaining": {
    en: "1 day remaining",
    es: "1 día restante",
    he: "נותר יום אחד"
  },
  "shell.trialDaysRemaining": {
    en: "{count} days remaining",
    es: "{count} días restantes",
    he: "נותרו {count} ימים"
  },
  "shell.trialPercentUsed": {
    en: "{percent}% of trial period used",
    es: "{percent}% del período de prueba usado",
    he: "{percent}% מתקופת הניסיון נוצלו"
  },
  "shell.trialAria": {
    en: "Trial - {label}",
    es: "Prueba - {label}",
    he: "ניסיון - {label}"
  },
  "shell.trialEnded": {
    en: "Your free trial has ended",
    es: "Tu prueba gratuita ha terminado",
    he: "תקופת הניסיון החינמית הסתיימה"
  },
  "shell.dashboardSubtitle": {
    en: "Current operating day overview for halls, kitchen, dining, events, billing, and staff.",
    es: "Resumen del día operativo actual para salones, cocina, comedor, eventos, facturación y personal.",
    he: "סקירת יום התפעול הנוכחי לאולמות, מטבח, חדר אוכל, אירועים, חיוב וצוות."
  },
  "shell.loadingDashboard": {
    en: "Loading dashboard",
    es: "Cargando el panel",
    he: "טוען את לוח הבקרה"
  },
  "shell.dashboardFailed": {
    en: "Dashboard couldn't load",
    es: "No se pudo cargar el panel",
    he: "לא ניתן לטעון את לוח הבקרה"
  },
  "shell.eventsOverview": {
    en: "Events overview",
    es: "Resumen de eventos",
    he: "סקירת אירועים"
  },
  "shell.income": { en: "Income", es: "Ingresos", he: "הכנסות" },
  "shell.expenses": { en: "Expenses", es: "Gastos", he: "הוצאות" },
  "shell.noEventsInRange": {
    en: "No events in range",
    es: "No hay eventos en el rango",
    he: "אין אירועים בטווח"
  },
  "shell.noFinancialActivity": {
    en: "No financial activity yet",
    es: "Aún no hay actividad financiera",
    he: "אין עדיין פעילות פיננסית"
  },
  "shell.subscriptionPlan": {
    en: "Subscription Plan",
    es: "Plan de suscripción",
    he: "תוכנית מנוי"
  },
  "shell.choosePlan": {
    en: "Choose the plan that fits your hall management operation.",
    es: "Elige el plan que se ajuste a la operación de tu salón.",
    he: "בחר את התוכנית שמתאימה לתפעול האולם שלך."
  },
  "shell.closePlans": {
    en: "Close subscription plans",
    es: "Cerrar los planes de suscripción",
    he: "סגירת תוכניות המנוי"
  },
  "shell.availableNow": {
    en: "Available Now",
    es: "Disponible ahora",
    he: "זמין עכשיו"
  },
  "shell.comingSoon": {
    en: "Coming Soon",
    es: "Próximamente",
    he: "בקרוב"
  },
  "shell.teamMember": {
    en: "Team member",
    es: "Miembro del equipo",
    he: "חבר צוות"
  },
  "shell.upgradeNow": {
    en: "Upgrade Now",
    es: "Mejorar ahora",
    he: "שדרג עכשיו"
  },
  "shell.preparingDashboard": {
    en: "Preparing your dashboard...",
    es: "Preparando tu panel...",
    he: "מכין את לוח הבקרה שלך..."
  },
  "shell.checkingSession": {
    en: "Checking your session...",
    es: "Comprobando tu sesión...",
    he: "בודק את ההפעלה שלך..."
  },
  "shell.loadingDashboardData": {
    en: "Loading dashboard data...",
    es: "Cargando los datos del panel...",
    he: "טוען את נתוני לוח הבקרה..."
  },
  "shell.couldNotFinishLoading": {
    en: "The dashboard could not finish loading.",
    es: "El panel no pudo terminar de cargarse.",
    he: "לוח הבקרה לא הצליח לסיים את הטעינה."
  },
  "shell.openingEvents": {
    en: "Opening events",
    es: "Abriendo eventos",
    he: "פותח אירועים"
  },
  "shell.noPagePermission": {
    en: "You do not have the permission this page needs. Ask whoever manages access in your organization.",
    es: "No tienes el permiso que esta página necesita. Pregunta a quien gestiona el acceso en tu organización.",
    he: "אין לך את ההרשאה שהעמוד הזה דורש. פנה למי שמנהל את ההרשאות בארגון."
  },
  "shell.loadingPageEllipsis": {
    en: "Loading page…",
    es: "Cargando la página…",
    he: "טוען את העמוד…"
  },
  // The boundary below the root layout. `global-error.tsx` replaces that
  // layout, so it sits above the provider and keeps its English copy.
  "shell.pageFailedToLoad": {
    en: "This page failed to load. The problem has been reported. You can try again, and if it keeps happening send us the reference below.",
    es: "Esta página no se pudo cargar. El problema ya se ha notificado. Puedes intentarlo de nuevo y, si sigue ocurriendo, envíanos la referencia de abajo.",
    he: "טעינת העמוד נכשלה. הבעיה דווחה. אפשר לנסות שוב, ואם זה חוזר שלחו לנו את המזהה שלמטה."
  },
  "shell.reference": {
    en: "Reference",
    es: "Referencia",
    he: "מזהה"
  },
  "shell.loadingPage": {
    en: "Loading page",
    es: "Cargando la página",
    he: "טוען את העמוד"
  },
  "shell.logoutFailed": {
    en: "Unable to log out. Please try again.",
    es: "No se pudo cerrar sesión. Inténtalo de nuevo.",
    he: "לא ניתן להתנתק. נסה שוב."
  },
  "shell.loggingOut": {
    en: "Logging out...",
    es: "Cerrando sesión...",
    he: "מתנתק..."
  },
  "shell.trialEndedLong": {
    en: "Your 14-day free trial has ended. Choose a subscription plan to continue using Event Core.",
    es: "Tu prueba gratuita de 14 días ha terminado. Elige un plan de suscripción para seguir usando Event Core.",
    he: "תקופת הניסיון בת 14 הימים הסתיימה. בחר תוכנית מנוי כדי להמשיך להשתמש ב-Event Core."
  },
  "shell.choosePlanToContinue": {
    en: "Choose a subscription plan to continue using Event Core.",
    es: "Elige un plan de suscripción para seguir usando Event Core.",
    he: "בחר תוכנית מנוי כדי להמשיך להשתמש ב-Event Core."
  },
  "shell.reportProblem": {
    en: "Report a problem",
    es: "Informar de un problema",
    he: "דיווח על בעיה"
  },
  "shell.helpCenter": {
    en: "Help Center",
    es: "Centro de ayuda",
    he: "מרכז העזרה"
  },
  "shell.releaseNotes": {
    en: "Release Notes",
    es: "Notas de la versión",
    he: "הערות גרסה"
  },
  "shell.termsOfService": {
    en: "Terms of Service",
    es: "Términos del servicio",
    he: "תנאי השירות"
  },
  "shell.privacyPolicy": {
    en: "Privacy Policy",
    es: "Política de privacidad",
    he: "מדיניות הפרטיות"
  },
  "shell.openProfileMenu": {
    en: "Open {name} profile menu",
    es: "Abrir el menú de perfil de {name}",
    he: "פתיחת תפריט הפרופיל של {name}"
  },
  "shell.expandSidebar": {
    en: "Expand sidebar",
    es: "Expandir la barra lateral",
    he: "הרחבת סרגל הצד"
  },
  "shell.closeSidebar": {
    en: "Close Sidebar",
    es: "Cerrar la barra lateral",
    he: "סגירת סרגל הצד"
  },
  "shell.saveNote": {
    en: "Save note",
    es: "Guardar nota",
    he: "שמירת ההערה"
  },
  "shell.actionFailed": {
    en: "The action could not be completed. Please try again.",
    es: "No se pudo completar la acción. Inténtalo de nuevo.",
    he: "לא ניתן היה להשלים את הפעולה. נסה שוב."
  },
  "shell.enterANumber": {
    en: "Enter a number.",
    es: "Introduce un número.",
    he: "הזן מספר."
  },
  "shell.somethingWentWrong": {
    en: "Something went wrong",
    es: "Algo salió mal",
    he: "משהו השתבש"
  },
  "shell.headsUp": {
    en: "Heads up",
    es: "Atención",
    he: "לתשומת לבך"
  },
  "shell.success": { en: "Success", es: "Listo", he: "הצלחה" },

  // The operating-schedule row: its status, what it still needs, and the
  // fallbacks for a row with pieces missing.
  "shell.statusConfirmed": {
    en: "Confirmed",
    es: "Confirmado",
    he: "מאושר"
  },
  "shell.statusMenuReview": {
    en: "Menu review",
    es: "Revisión del menú",
    he: "בדיקת תפריט"
  },
  "shell.statusOnHold": {
    en: "On hold",
    es: "En espera",
    he: "בהמתנה"
  },
  "shell.statusBalanceDue": {
    en: "Balance due",
    es: "Saldo pendiente",
    he: "יתרה לתשלום"
  },
  "shell.allDay": { en: "All day", es: "Todo el día", he: "כל היום" },
  "shell.eventDetailsPending": {
    en: "Event details pending",
    es: "Detalles del evento pendientes",
    he: "פרטי האירוע ממתינים"
  },
  "shell.unassignedHall": {
    en: "Unassigned hall",
    es: "Salón sin asignar",
    he: "אולם לא משויך"
  },
  "shell.unassigned": {
    en: "Unassigned",
    es: "Sin asignar",
    he: "לא משויך"
  },
  "shell.nextBillingFollowUp": {
    en: "Billing follow-up",
    es: "Seguimiento de facturación",
    he: "מעקב חיוב"
  },
  "shell.nextConfirmBooking": {
    en: "Confirm booking",
    es: "Confirmar la reserva",
    he: "אישור ההזמנה"
  },
  "shell.nextReviewEventFile": {
    en: "Review event file",
    es: "Revisar el expediente del evento",
    he: "בדיקת תיק האירוע"
  },
  "shell.noBillingActivity": {
    en: "Paid invoices and processed refunds will appear here once billing activity is recorded for this period.",
    es: "Las facturas pagadas y los reembolsos procesados aparecerán aquí cuando se registre actividad de facturación en este periodo.",
    he: "חשבוניות ששולמו והחזרים שעובדו יופיעו כאן לאחר שתירשם פעילות חיוב בתקופה הזו."
  },

  "shell.perMonth": { en: "/month", es: "/mes", he: "/חודש" },
  "shell.getStarted": {
    en: "Get Started",
    es: "Comenzar",
    he: "התחלה"
  },
  "shell.openingCheckout": {
    en: "Opening checkout…",
    es: "Abriendo el pago…",
    he: "פותח את התשלום…"
  },
  "shell.checkoutFailed": {
    en: "Could not start subscription checkout.",
    es: "No se pudo iniciar el pago de la suscripción.",
    he: "לא ניתן להתחיל את תהליך התשלום למנוי."
  },
  "shell.notifications": {
    en: "Notifications",
    es: "Notificaciones",
    he: "התראות"
  },
  "shell.dismissNotification": {
    en: "Dismiss notification",
    es: "Descartar notificación",
    he: "סגירת ההתראה"
  },
  "shell.addNote": { en: "Add note", es: "Agregar nota", he: "הוספת הערה" },
  "shell.closeTodayNotes": {
    en: "Close today notes",
    es: "Cerrar las notas de hoy",
    he: "סגירת הערות היום"
  },
  "shell.loadingTodayNotes": {
    en: "Loading today's notes...",
    es: "Cargando las notas de hoy...",
    he: "טוען את הערות היום..."
  },
  "shell.noTodayNotes": {
    en: "No notes have been added for today.",
    es: "No se han agregado notas para hoy.",
    he: "לא נוספו הערות להיום."
  },
  "shell.typeInternalNote": {
    en: "Type internal note",
    es: "Escribe una nota interna",
    he: "כתוב הערה פנימית"
  }
});
