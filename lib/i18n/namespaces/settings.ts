import { defineMessages } from "@/lib/i18n/types";

/** Settings: organization, language and region, control-center panels, halls, event types, security, branding, activity and reset. */
export const settingsMessages = defineMessages({
  "settings.title": {
    en: "Settings",
    es: "Configuración",
    he: "הגדרות"
  },
  "settings.blurb": {
    en: "Manage organization, system, access, integrations, branding, and account plan.",
    es: "Gestiona la organización, el sistema, el acceso, las integraciones, la marca y el plan.",
    he: "ניהול הארגון, המערכת, ההרשאות, השילובים, המיתוג ותוכנית החשבון."
  },
  "settings.sections": {
    en: "Settings sections",
    es: "Secciones de configuración",
    he: "מדורי ההגדרות"
  },
  "settings.close": {
    en: "Close settings",
    es: "Cerrar la configuración",
    he: "סגירת ההגדרות"
  },

  // The settings sections. `label` on the nav item stays English because it is
  // also the section identifier the page switches on; these are what is drawn.
  "settings.section.general": {
    en: "General",
    es: "General",
    he: "כללי"
  },
  "settings.section.halls": { en: "Halls", es: "Salones", he: "אולמות" },
  "settings.section.eventTypes": {
    en: "Event Types",
    es: "Tipos de evento",
    he: "סוגי אירועים"
  },
  "settings.section.calendar": {
    en: "Calendar",
    es: "Calendario",
    he: "לוח שנה"
  },
  "settings.section.kitchen": { en: "Kitchen", es: "Cocina", he: "מטבח" },
  "settings.section.notifications": {
    en: "Notifications",
    es: "Notificaciones",
    he: "התראות"
  },
  "settings.section.billing": {
    en: "Billing",
    es: "Facturación",
    he: "חיוב"
  },
  "settings.section.access": { en: "Access", es: "Acceso", he: "הרשאות" },
  "settings.section.activity": {
    en: "Activity",
    es: "Actividad",
    he: "פעילות"
  },
  "settings.section.security": {
    en: "Security",
    es: "Seguridad",
    he: "אבטחה"
  },
  "settings.sectionDesc.security": {
    en: "Two-factor authentication and session policy",
    es: "Autenticación en dos pasos y política de sesión",
    he: "אימות דו-שלבי ומדיניות התחברות"
  },
  "settings.organizationPolicy": {
    en: "Organization policy",
    es: "Política de la organización",
    he: "מדיניות הארגון"
  },
  "settings.requireTwoFactor": {
    en: "Require two-factor authentication",
    es: "Exigir autenticación en dos pasos",
    he: "לחייב אימות דו-שלבי"
  },
  "settings.requireTwoFactorHint": {
    en: "Everyone in this organization has to hold a second factor to sign in.",
    es: "Todas las personas de esta organización deben tener un segundo factor para iniciar sesión.",
    he: "כל מי שבארגון הזה חייב להחזיק גורם אימות שני כדי להתחבר."
  },
  "settings.sessionTimeout": {
    en: "Sign out after inactivity",
    es: "Cerrar sesión tras inactividad",
    he: "ניתוק לאחר חוסר פעילות"
  },
  "settings.sessionTimeoutHint": {
    en: "A board left on a wall in the kitchen is the reason this is not five minutes.",
    es: "Un tablero encendido en la cocina es la razón por la que esto no son cinco minutos.",
    he: "לוח שנשאר דולק במטבח הוא הסיבה שזה אינו חמש דקות."
  },
  "settings.minutesValue": {
    en: "{count} minutes",
    es: "{count} minutos",
    he: "{count} דקות"
  },
  "settings.hoursValue": {
    en: "{count} hours",
    es: "{count} horas",
    he: "{count} שעות"
  },
  "settings.oneDay": { en: "1 day", es: "1 día", he: "יום אחד" },
  // The policy is the administrator's; enrolling is the individual's, and the
  // two sit on one screen so the second is reachable the moment the first is set.
  "settings.thisDevice": {
    en: "This device",
    es: "Este dispositivo",
    he: "המכשיר הזה"
  },
  "settings.unknownDevice": {
    en: "Unrecognised device",
    es: "Dispositivo no reconocido",
    he: "מכשיר לא מזוהה"
  },
  // Shown in place of a city when nothing resolved one, rather than leaving a
  // gap. A missing field reads as a fault; saying so reads as a fact.
  "settings.locationUnknown": {
    en: "Location unavailable",
    es: "Ubicación no disponible",
    he: "מיקום לא זמין"
  },
  "settings.lastSeen": {
    en: "Last seen {when}",
    es: "Visto por última vez {when}",
    he: "נראה לאחרונה {when}"
  },
  "settings.signedInOn": {
    en: "Signed in {when}",
    es: "Sesión iniciada {when}",
    he: "התחבר {when}"
  },
  "settings.noOtherSessions": {
    en: "You are only signed in on this device.",
    es: "Solo tienes la sesión iniciada en este dispositivo.",
    he: "אתם מחוברים רק במכשיר הזה."
  },
  "settings.sessionsLoadFailed": {
    en: "Your sessions could not be loaded.",
    es: "No se pudieron cargar tus sesiones.",
    he: "לא ניתן היה לטעון את ההתחברויות שלך."
  },
  "settings.signOutEverywhereElse": {
    en: "Sign out other sessions",
    es: "Cerrar las demás sesiones",
    he: "ניתוק שאר ההתחברויות"
  },
  "settings.signOutEverywhereElseHint": {
    en: "Ends every other session. You stay signed in here, and your devices stay trusted.",
    es: "Cierra todas las demás sesiones. Aquí sigues con la sesión iniciada y tus dispositivos siguen siendo de confianza.",
    he: "מנתק את כל שאר ההתחברויות. כאן תישארו מחוברים, והמכשירים שלכם יישארו מהימנים."
  },
  "settings.signOutEverywhereElseConfirm": {
    en: "Every other session on this account will be signed out. Anyone using one will have to sign in again. This device stays signed in.",
    es: "Se cerrarán todas las demás sesiones de esta cuenta. Quien esté usando alguna tendrá que volver a iniciar sesión. Este dispositivo sigue con la sesión iniciada.",
    he: "כל שאר ההתחברויות לחשבון הזה ינותקו. מי שמשתמש באחת מהן יצטרך להתחבר מחדש. המכשיר הזה יישאר מחובר."
  },
  "settings.signOutAllDevices": {
    en: "Sign out all devices",
    es: "Cerrar sesión en todos los dispositivos",
    he: "ניתוק מכל המכשירים"
  },
  "settings.signOutAllDevicesHint": {
    en: "Ends every session, including this one, and removes trust from every device. Each device must be verified again to sign in.",
    es: "Cierra todas las sesiones, incluida esta, y retira la confianza de todos los dispositivos. Cada dispositivo deberá verificarse de nuevo para iniciar sesión.",
    he: "מנתק את כל ההתחברויות, כולל זו, ומבטל את האמון בכל המכשירים. כל מכשיר יצטרך אימות מחדש כדי להתחבר."
  },
  "settings.signOutAllDevicesConfirm": {
    en: "You will be signed out everywhere, including this device, and every device will need to be verified again before it can sign in.",
    es: "Se cerrará tu sesión en todas partes, incluido este dispositivo, y cada dispositivo deberá verificarse de nuevo antes de iniciar sesión.",
    he: "תנותקו מכל מקום, כולל המכשיר הזה, וכל מכשיר יצטרך אימות מחדש לפני שיוכל להתחבר."
  },
  /*
   * The bulk control revokes sessions on untrusted devices while preserving
   * every session associated with the single confirmed primary device.
   */
  /*
   * The warning before an idle sign-out.
   *
   * The seconds are interpolated rather than baked into the sentence so the
   * countdown reads naturally in every language - Hebrew and Spanish both put
   * the number somewhere English does not.
   */
  /*
   * "Never", as a DURATION rather than as a past tense.
   *
   * `common.never` already exists and is the wrong word here: it renders in
   * Hebrew as "מעולם לא", which is "never [has happened]" - correct for a
   * last-login column and wrong for "how long until this signs out".
   */
  /*
   * The kitchen board on the wall.
   *
   * Worded as a fact about the SCREEN rather than as a permission, because that
   * is what it is - "this display is shared" is something the person setting up
   * the board can answer, while "exempt this session from the inactivity
   * policy" is not.
   */
  "settings.sharedDevice": {
    en: "Shared display",
    es: "Pantalla compartida",
    he: "מסך משותף"
  },
  "settings.sharedDeviceHint": {
    en: "This screen is mounted for everyone to see, like a kitchen board. It will not be signed out for being idle. Applies to this device only, and saves immediately.",
    es: "Esta pantalla está montada para que todos la vean, como un tablero de cocina. No se cerrará la sesión por inactividad. Se aplica solo a este dispositivo y se guarda de inmediato.",
    he: "המסך הזה מותקן כדי שכולם יראו אותו, כמו לוח מטבח. הוא לא ינותק בגלל חוסר פעילות. חל על המכשיר הזה בלבד ונשמר מיד."
  },
  "settings.sharedDeviceFailed": {
    en: "That could not be saved. Try again.",
    es: "No se pudo guardar. Inténtalo de nuevo.",
    he: "לא ניתן היה לשמור. נסו שוב."
  },
  "settings.neverTimeout": {
    en: "Never",
    es: "Nunca",
    he: "אף פעם"
  },
  "settings.inactivityWarningTitle": {
    en: "Still there?",
    es: "¿Sigues ahí?",
    he: "עדיין כאן?"
  },
  "settings.inactivityWarningBody": {
    en: "You will be signed out in {seconds} seconds because this screen has been idle.",
    es: "Se cerrará tu sesión en {seconds} segundos porque esta pantalla ha estado inactiva.",
    he: "החיבור ינותק בעוד {seconds} שניות כי המסך הזה לא היה בשימוש."
  },
  "settings.inactivityStaySignedIn": {
    en: "Stay signed in",
    es: "Seguir con la sesión iniciada",
    he: "להישאר מחובר"
  },
  "settings.signOutEverywhere": {
    en: "Sign out untrusted devices",
    es: "Cerrar sesión en dispositivos no confiables",
    he: "ניתוק ממכשירים לא מהימנים"
  },
  "settings.signOutEverywhereHint": {
    en: "Ends sessions on untrusted devices. A confirmed primary device stays signed in; if you have none, all sessions are ended.",
    es: "Finaliza las sesiones en dispositivos no confiables. Un dispositivo principal confirmado seguirá conectado; si no tienes uno, se cerrarán todas las sesiones.",
    he: "מנתק הפעלות ממכשירים לא מהימנים. מכשיר ראשי מאושר יישאר מחובר; אם אין כזה, כל ההפעלות יסתיימו."
  },
  "settings.signOutEverywhereConfirm": {
    en: "Sessions on every untrusted device will be ended. A confirmed primary device will remain signed in; if none exists, all sessions will be ended.",
    es: "Se cerrarán las sesiones de todos los dispositivos no confiables. Un dispositivo principal confirmado seguirá conectado; si no existe, se cerrarán todas las sesiones.",
    he: "ההפעלות בכל המכשירים הלא מהימנים יסתיימו. מכשיר ראשי מאושר יישאר מחובר; אם אין כזה, כל ההפעלות יסתיימו."
  },
  /** The button on one row of the list. Short, because the row is narrow. */
  "settings.signOutDevice": {
    en: "Sign out",
    es: "Cerrar sesión",
    he: "ניתוק"
  },
  "settings.signingOutOthers": {
    en: "Signing out…",
    es: "Cerrando sesión…",
    he: "מנתק…"
  },
  "settings.trustedDeviceBadge": {
    en: "Trusted",
    es: "De confianza",
    he: "מהימן"
  },
  "settings.primaryDeviceBadge": {
    en: "Primary",
    es: "Principal",
    he: "ראשי"
  },
  "settings.otherSessionsFailed": {
    en: "Your other sessions could not be signed out. Please try again.",
    es: "No se pudo cerrar la sesión en tus otros dispositivos. Inténtalo de nuevo.",
    he: "לא ניתן היה לנתק את שאר ההתחברויות. נסה שוב."
  },
  "settings.yourAccount": {
    en: "Your account",
    es: "Tu cuenta",
    he: "החשבון שלך"
  },
  "settings.securityPolicyReadOnly": {
    en: "Changing this needs the Edit settings permission. Your own two-factor setup below does not.",
    es: "Cambiar esto requiere el permiso Editar ajustes. Tu propia configuración de dos pasos, más abajo, no.",
    he: "שינוי ההגדרה הזו דורש את ההרשאה ״עריכת הגדרות״. הגדרת האימות הדו-שלבי שלך למטה אינה דורשת אותה."
  },
  "settings.section.branding": {
    en: "Branding",
    es: "Marca",
    he: "מיתוג"
  },
  "settings.section.integrations": {
    en: "Integrations",
    es: "Integraciones",
    he: "שילובים"
  },
  "settings.section.reset": {
    en: "Reset",
    es: "Restablecer",
    he: "איפוס"
  },

  "settings.sectionDesc.general": {
    en: "Organization profile and account basics.",
    es: "Perfil de la organización y datos básicos de la cuenta.",
    he: "פרופיל הארגון ופרטי החשבון הבסיסיים."
  },
  "settings.sectionDesc.halls": {
    en: "Rooms, halls, capacity, and setup.",
    es: "Salas, salones, capacidad y montaje.",
    he: "חדרים, אולמות, קיבולת והקמה."
  },
  "settings.sectionDesc.eventTypes": {
    en: "Booking categories, valid days, and availability.",
    es: "Categorías de reserva, días válidos y disponibilidad.",
    he: "קטגוריות הזמנה, ימים מותרים וזמינות."
  },
  "settings.sectionDesc.calendar": {
    en: "Booking calendar behavior and date defaults.",
    es: "Comportamiento del calendario de reservas y valores de fecha predeterminados.",
    he: "התנהגות לוח ההזמנות וברירות המחדל לתאריכים."
  },
  "settings.sectionDesc.kitchen": {
    en: "Kitchen dashboard defaults and alerts.",
    es: "Valores predeterminados y alertas del panel de cocina.",
    he: "ברירות המחדל וההתראות של לוח המטבח."
  },
  "settings.sectionDesc.notifications": {
    en: "Email, kitchen, booking, and system alerts.",
    es: "Alertas de correo, cocina, reservas y sistema.",
    he: "התראות דוא״ל, מטבח, הזמנות ומערכת."
  },
  "settings.sectionDesc.billing": {
    en: "Simple payment settings and client payment link.",
    es: "Ajustes de pago simples y enlace de pago del cliente.",
    he: "הגדרות תשלום פשוטות וקישור התשלום ללקוח."
  },
  "settings.sectionDesc.access": {
    en: "Staff, roles, permissions, and invites.",
    es: "Personal, roles, permisos e invitaciones.",
    he: "צוות, תפקידים, הרשאות והזמנות."
  },
  "settings.sectionDesc.activity": {
    en: "What was changed across the organization, and by whom.",
    es: "Qué se cambió en la organización y quién lo hizo.",
    he: "מה השתנה בארגון, ועל ידי מי."
  },
  "settings.sectionDesc.branding": {
    en: "Logo, client portal copy, and PDF identity.",
    es: "Logotipo, textos del portal del cliente e identidad en PDF.",
    he: "לוגו, הטקסטים בפורטל הלקוח וזהות ה-PDF."
  },
  "settings.sectionDesc.integrations": {
    en: "Connected services and coming-soon channels.",
    es: "Servicios conectados y canales próximamente.",
    he: "שירותים מחוברים וערוצים שיגיעו בקרוב."
  },
  "settings.sectionDesc.reset": {
    en: "Permanently clear events, menus, configuration or access.",
    es: "Borra de forma permanente eventos, menús, configuración o accesos.",
    he: "מחיקה לצמיתות של אירועים, תפריטים, תצורה או הרשאות."
  },

  "settings.languageRegion": {
    en: "Language & Region",
    es: "Idioma y región",
    he: "שפה ואזור"
  },
  "settings.language": { en: "Language", es: "Idioma", he: "שפה" },
  "settings.currentTimezone": {
    en: "Current timezone",
    es: "Zona horaria actual",
    he: "אזור זמן נוכחי"
  },
  "settings.dateFormat": {
    en: "Date format",
    es: "Formato de fecha",
    he: "תבנית תאריך"
  },
  "settings.timeFormat": {
    en: "Time format",
    es: "Formato de hora",
    he: "תבנית שעה"
  },
  "settings.saveChanges": {
    en: "Save changes",
    es: "Guardar cambios",
    he: "שמירת שינויים"
  },
  "settings.langEnUs": {
    en: "English (United States)",
    es: "Inglés (Estados Unidos)",
    he: "אנגלית (ארצות הברית)"
  },
  "settings.langEnGb": {
    en: "English (United Kingdom)",
    es: "Inglés (Reino Unido)",
    he: "אנגלית (בריטניה)"
  },
  "settings.langEs": {
    en: "Spanish",
    es: "Español",
    he: "ספרדית"
  },
  "settings.langHe": {
    en: "Hebrew",
    es: "Hebreo",
    he: "עברית"
  },

  "settings.organization": {
    en: "Organization",
    es: "Organización",
    he: "ארגון"
  },
  "settings.organizationProfile": {
    en: "Organization profile",
    es: "Perfil de la organización",
    he: "פרופיל הארגון"
  },
  "settings.organizationDetails": {
    en: "Organization details and primary contact",
    es: "Detalles de la organización y contacto principal",
    he: "פרטי הארגון ואיש הקשר הראשי"
  },
  "settings.organizationName": {
    en: "Organization name",
    es: "Nombre de la organización",
    he: "שם הארגון"
  },
  "settings.contactEmail": {
    en: "Contact email",
    es: "Correo de contacto",
    he: "דוא״ל ליצירת קשר"
  },
  "settings.workspace": {
    en: "Event Core workspace",
    es: "Espacio de Event Core",
    he: "סביבת Event Core"
  },
  "settings.notificationPreferences": {
    en: "Notification preferences",
    es: "Preferencias de notificación",
    he: "העדפות התראות"
  },
  "settings.customizeBranding": {
    en: "Customize Branding",
    es: "Personalizar la marca",
    he: "התאמת המיתוג"
  },
  "settings.brandingPreview": {
    en: "Branding Preview",
    es: "Vista previa de la marca",
    he: "תצוגה מקדימה של המיתוג"
  },
  "settings.clientPaymentLink": {
    en: "Client Payment Link",
    es: "Enlace de pago del cliente",
    he: "קישור תשלום ללקוח"
  },
  "settings.paymentLink": {
    en: "Payment link",
    es: "Enlace de pago",
    he: "קישור לתשלום"
  },
  "settings.currentPlan": {
    en: "Current plan",
    es: "Plan actual",
    he: "התוכנית הנוכחית"
  },
  "settings.billingCycle": {
    en: "Billing cycle",
    es: "Ciclo de facturación",
    he: "מחזור החיוב"
  },
  "settings.nextBillingDate": {
    en: "Next billing date",
    es: "Próxima fecha de facturación",
    he: "תאריך החיוב הבא"
  },
  "settings.manageSubscription": {
    en: "Manage Subscription",
    es: "Gestionar la suscripción",
    he: "ניהול המנוי"
  },
  "settings.planProfessional": {
    en: "Professional",
    es: "Profesional",
    he: "מקצועי"
  },
  "settings.cycleMonthly": {
    en: "Monthly",
    es: "Mensual",
    he: "חודשי"
  },
  "settings.connected": {
    en: "Connected",
    es: "Conectado",
    he: "מחובר"
  },

  "settings.accessRoles": {
    en: "Access & roles",
    es: "Acceso y roles",
    he: "הרשאות ותפקידים"
  },
  "settings.calendarDefaults": {
    en: "Calendar defaults",
    es: "Valores predeterminados del calendario",
    he: "ברירות המחדל של לוח השנה"
  },
  "settings.calendarDisplay": {
    en: "Calendar display",
    es: "Visualización del calendario",
    he: "תצוגת לוח השנה"
  },
  "settings.defaultView": {
    en: "Default view",
    es: "Vista predeterminada",
    he: "תצוגת ברירת מחדל"
  },
  "settings.viewAgenda": { en: "Agenda", es: "Agenda", he: "סדר יום" },
  "settings.viewWeek": { en: "Week", es: "Semana", he: "שבוע" },
  "settings.viewMonth": { en: "Month", es: "Mes", he: "חודש" },
  "settings.weekStartsOn": {
    en: "Week starts on",
    es: "La semana empieza el",
    he: "השבוע מתחיל ביום"
  },
  "settings.sunday": { en: "Sunday", es: "Domingo", he: "ראשון" },
  "settings.monday": { en: "Monday", es: "Lunes", he: "שני" },
  "settings.saturday": { en: "Saturday", es: "Sábado", he: "שבת" },
  "settings.holdExpiration": {
    en: "Hold expiration",
    es: "Caducidad de la retención",
    he: "פקיעת שמירה"
  },
  "settings.showHebrewDates": {
    en: "Show Hebrew dates",
    es: "Mostrar fechas hebreas",
    he: "הצגת תאריך עברי"
  },
  "settings.showHebrewDatesHint": {
    en: "Display the Hebrew date beside the standard date.",
    es: "Muestra la fecha hebrea junto a la fecha estándar.",
    he: "הצגת התאריך העברי לצד התאריך הלועזי."
  },
  "settings.showAvailableIndicator": {
    en: "Show available-date indicator",
    es: "Mostrar indicador de fecha disponible",
    he: "הצגת מחוון תאריך פנוי"
  },
  "settings.showAvailableIndicatorHint": {
    en: "Mark dates that still have a bookable hall available.",
    es: "Marca las fechas que aún tienen un salón disponible para reservar.",
    he: "סימון תאריכים שבהם עדיין יש אולם פנוי להזמנה."
  },
  "settings.clickAnywhereToAdd": {
    en: "Click anywhere to add",
    es: "Haz clic en cualquier lugar para agregar",
    he: "לחיצה בכל מקום להוספה"
  },
  "settings.clickAnywhereHint": {
    en: "On: clicking anywhere on a day opens the booking form, and the + button is dropped. Off: only the + button books, and clicking the day just selects it.",
    es: "Activado: hacer clic en cualquier parte del día abre el formulario de reserva y se oculta el botón +. Desactivado: solo el botón + reserva, y hacer clic en el día solo lo selecciona.",
    he: "מופעל: לחיצה בכל מקום ביום פותחת את טופס ההזמנה, וכפתור ה-+ מוסתר. כבוי: רק כפתור ה-+ מזמין, ולחיצה על היום רק בוחרת אותו."
  },

  "settings.billingBasics": {
    en: "Billing basics",
    es: "Aspectos básicos de facturación",
    he: "יסודות החיוב"
  },
  "settings.currency": { en: "Currency", es: "Moneda", he: "מטבע" },
  "settings.currencyUsd": {
    en: "USD — US Dollar",
    es: "USD — Dólar estadounidense",
    he: "USD — דולר אמריקאי"
  },
  "settings.currencyCad": {
    en: "CAD — Canadian Dollar",
    es: "CAD — Dólar canadiense",
    he: "CAD — דולר קנדי"
  },
  "settings.currencyIls": {
    en: "ILS — Israeli New Shekel",
    es: "ILS — Nuevo séquel israelí",
    he: "ILS — שקל חדש"
  },
  "settings.acceptedPaymentMethods": {
    en: "Accepted payment methods",
    es: "Métodos de pago aceptados",
    he: "אמצעי תשלום מקובלים"
  },
  "settings.defaultDepositLabel": {
    en: "Default deposit label",
    es: "Etiqueta de depósito predeterminada",
    he: "תווית ברירת מחדל למקדמה"
  },
  "settings.showPayBalance": {
    en: "Show Pay Balance button",
    es: "Mostrar el botón Pagar saldo",
    he: "הצגת כפתור תשלום יתרה"
  },
  "settings.showPayBalanceHint": {
    en: "Display the configured client payment link in the client portal.",
    es: "Muestra el enlace de pago configurado en el portal del cliente.",
    he: "הצגת קישור התשלום המוגדר בפורטל הלקוח."
  },

  "settings.kitchenDashboard": {
    en: "Kitchen dashboard",
    es: "Panel de cocina",
    he: "לוח המטבח"
  },
  "settings.kitchenAlerts": {
    en: "Kitchen alerts",
    es: "Alertas de cocina",
    he: "התראות מטבח"
  },
  "settings.kitchenNotifications": {
    en: "Kitchen notifications",
    es: "Notificaciones de cocina",
    he: "התראות מטבח"
  },
  "settings.kitchenNotificationsHint": {
    en: "Notify kitchen staff about relevant event and menu changes.",
    es: "Notifica al personal de cocina sobre cambios relevantes de eventos y menús.",
    he: "עדכון צוות המטבח על שינויים רלוונטיים באירועים ובתפריטים."
  },
  "settings.manageKitchenWorkers": {
    en: "Manage kitchen workers",
    es: "Gestionar los trabajadores de cocina",
    he: "ניהול עובדי המטבח"
  },
  "settings.requireAck": {
    en: "Require menu-change acknowledgment",
    es: "Exigir confirmación de los cambios de menú",
    he: "דרישת אישור לשינויי תפריט"
  },
  "settings.requireAckHint": {
    en: "Menu changes remain open until a kitchen worker confirms them.",
    es: "Los cambios de menú quedan abiertos hasta que un trabajador de cocina los confirme.",
    he: "שינויי תפריט נשארים פתוחים עד שעובד מטבח מאשר אותם."
  },
  "settings.shortNoticeWarning": {
    en: "Short-notice warning",
    es: "Aviso de última hora",
    he: "אזהרת התראה קצרה"
  },
  "settings.shortNoticeThreshold": {
    en: "Short-notice alert threshold",
    es: "Umbral de alerta de última hora",
    he: "סף התראה קצרה"
  },
  "settings.soon": { en: "Soon", es: "Pronto", he: "בקרוב" },
  // Two of the four things this panel used to list as unbuilt have shipped, and
  // they live under General. Saying so is the difference between a roadmap and
  // a section that reads as broken.
  // Stands in for the logo in the preview when none has been uploaded, so the
  // card still shows the header colour rather than an empty band.
  "settings.yourVenue": {
    en: "Your venue",
    es: "Tu recinto",
    he: "המקום שלך"
  },
  "settings.brandingLivesInGeneral": {
    en: "Your logo and the client portal header are already available, under General.",
    es: "Tu logotipo y la cabecera del portal del cliente ya están disponibles, en General.",
    he: "הלוגו וכותרת פורטל הלקוחות כבר זמינים, תחת ״כללי״."
  },
  "settings.today": { en: "Today", es: "Hoy", he: "היום" },
  "settings.thisWeek": {
    en: "This week",
    es: "Esta semana",
    he: "השבוע"
  },

  "settings.hallsAndRooms": {
    en: "Halls and rooms",
    es: "Salones y salas",
    he: "אולמות וחדרים"
  },
  "settings.hallsBlurb": {
    en: "Active, bookable halls appear in booking and map-assignment forms.",
    es: "Los salones activos y reservables aparecen en los formularios de reserva y de asignación de mapa.",
    he: "אולמות פעילים הניתנים להזמנה מופיעים בטפסי ההזמנה והקצאת המפה."
  },
  "settings.hallName": {
    en: "Hall / room name",
    es: "Nombre del salón / sala",
    he: "שם האולם / החדר"
  },
  "settings.hallNameExample": {
    en: "Example: Grand Ballroom",
    es: "Ejemplo: Salón principal",
    he: "לדוגמה: אולם ראשי"
  },
  "settings.capacity": {
    en: "Capacity",
    es: "Capacidad",
    he: "קיבולת"
  },
  "settings.pricing": {
    en: "Pricing",
    es: "Precios",
    he: "תמחור"
  },
  "settings.calendarColor": {
    en: "Calendar color",
    es: "Color del calendario",
    he: "צבע בלוח השנה"
  },
  "settings.availableForBookings": {
    en: "Available for new bookings",
    es: "Disponible para nuevas reservas",
    he: "זמין להזמנות חדשות"
  },
  "settings.loadingHalls": {
    en: "Loading halls...",
    es: "Cargando salones...",
    he: "טוען אולמות..."
  },
  "settings.noHalls": {
    en: "No halls yet. Add the first hall to start accepting bookings.",
    es: "Aún no hay salones. Agrega el primero para empezar a aceptar reservas.",
    he: "אין עדיין אולמות. הוסף את האולם הראשון כדי להתחיל לקבל הזמנות."
  },

  "settings.eventTypes": {
    en: "Event types",
    es: "Tipos de evento",
    he: "סוגי אירועים"
  },
  "settings.loadingEventTypes": {
    en: "Loading event types...",
    es: "Cargando tipos de evento...",
    he: "טוען סוגי אירועים..."
  },
  "settings.noEventTypes": {
    en: "No event types yet",
    es: "Aún no hay tipos de evento",
    he: "אין עדיין סוגי אירועים"
  },
  "settings.addOneBeforeBooking": {
    en: "Add one before creating a booking.",
    es: "Agrega uno antes de crear una reserva.",
    he: "הוסף אחד לפני יצירת הזמנה."
  },
  "settings.activeForBooking": {
    en: "Active and available for booking",
    es: "Activo y disponible para reservar",
    he: "פעיל וזמין להזמנה"
  },
  "settings.bookingSettings": {
    en: "Booking settings",
    es: "Configuración de reservas",
    he: "הגדרות הזמנה"
  },
  "settings.allowedBookingDays": {
    en: "Allowed booking days",
    es: "Días permitidos para reservar",
    he: "ימים מותרים להזמנה"
  },
  "settings.allDaysHint": {
    en: "Leave every day unchecked to allow all days.",
    es: "Deja todos los días sin marcar para permitir todos los días.",
    he: "השאר את כל הימים לא מסומנים כדי לאפשר את כולם."
  },

  "settings.hold24h": { en: "24 hours", es: "24 horas", he: "24 שעות" },
  "settings.hold48h": { en: "48 hours", es: "48 horas", he: "48 שעות" },
  "settings.hold72h": { en: "72 hours", es: "72 horas", he: "72 שעות" },
  "settings.days1": { en: "1 day", es: "1 día", he: "יום אחד" },
  "settings.days3": { en: "3 days", es: "3 días", he: "3 ימים" },
  "settings.days7": { en: "7 days", es: "7 días", he: "7 ימים" },
  "settings.days14": { en: "14 days", es: "14 días", he: "14 ימים" },
  "settings.days30": { en: "30 days", es: "30 días", he: "30 ימים" },
  "settings.kitchenToday": { en: "Today", es: "Hoy", he: "היום" },
  "settings.kitchenThisWeek": {
    en: "This week",
    es: "Esta semana",
    he: "השבוע"
  },
  "settings.kitchenFourWeeks": {
    en: "4 weeks",
    es: "4 semanas",
    he: "4 שבועות"
  },
  "settings.activeEventTypesBlurb": {
    en: "Active event types appear in New Booking, Calendar, and Event forms.",
    es: "Los tipos de evento activos aparecen en Nueva reserva, Calendario y los formularios de evento.",
    he: "סוגי אירועים פעילים מופיעים בהזמנה חדשה, בלוח השנה ובטפסי האירוע."
  },
  "settings.shevaBrachosEvent": {
    en: "Shabbos Sheva Brachos event",
    es: "Evento de Shabbos Sheva Brachos",
    he: "אירוע שבת שבע ברכות"
  },
  "settings.twoFactor": {
    en: "Two-factor authentication",
    es: "Autenticación de dos factores",
    he: "אימות דו-שלבי"
  },
  "settings.twoFactorHint": {
    en: "Require a rotating code from an authenticator app when signing in.",
    es: "Exige un código rotativo de una app de autenticación al iniciar sesión.",
    he: "דרישת קוד מתחלף מאפליקציית אימות בעת הכניסה."
  },
  "settings.scanAndVerify": {
    en: "Scan and verify",
    es: "Escanear y verificar",
    he: "סריקה ואימות"
  },
  "settings.scanQrHint": {
    en: "Scan this QR code with your authenticator app, then enter its 6-digit code.",
    es: "Escanea este código QR con tu app de autenticación y luego introduce su código de 6 dígitos.",
    he: "סרוק את קוד ה-QR באפליקציית האימות, ואז הזן את הקוד בן 6 הספרות."
  },
  "settings.manualSetupKey": {
    en: "Manual setup key",
    es: "Clave de configuración manual",
    he: "מפתח הגדרה ידני"
  },
  "settings.sixDigitCode": {
    en: "6-digit code",
    es: "Código de 6 dígitos",
    he: "קוד בן 6 ספרות"
  },
  "settings.authCode": {
    en: "Authenticator verification code",
    es: "Código de verificación del autenticador",
    he: "קוד אימות מאפליקציית האימות"
  },
  "settings.verifyAndEnable": {
    en: "Verify and enable",
    es: "Verificar y activar",
    he: "אימות והפעלה"
  },
  "settings.otherSessions": {
    en: "Other active sessions",
    es: "Otras sesiones activas",
    he: "הפעלות פעילות אחרות"
  },

  "settings.portalHeader": {
    en: "Client portal header",
    es: "Encabezado del portal del cliente",
    he: "כותרת פורטל הלקוח"
  },
  "settings.headerColour": {
    en: "Header colour",
    es: "Color del encabezado",
    he: "צבע הכותרת"
  },
  "settings.headerColourHex": {
    en: "Header colour hex value",
    es: "Valor hexadecimal del color del encabezado",
    he: "ערך הקס של צבע הכותרת"
  },
  "settings.colour": { en: "Colour", es: "Color", he: "צבע" },
  "settings.preview": {
    en: "Preview",
    es: "Vista previa",
    he: "תצוגה מקדימה"
  },
  "settings.eventName": {
    en: "Event name",
    es: "Nombre del evento",
    he: "שם האירוע"
  },
  "settings.dateTimeHall": {
    en: "Date - Time - Hall",
    es: "Fecha - Hora - Salón",
    he: "תאריך - שעה - אולם"
  },
  "settings.headerImage": {
    en: "Header image",
    es: "Imagen del encabezado",
    he: "תמונת הכותרת"
  },
  "settings.logo": { en: "Logo", es: "Logotipo", he: "לוגו" },
  "settings.change": { en: "Change", es: "Cambiar", he: "החלפה" },
  "settings.dropImage": {
    en: "Drop an image here or click to browse",
    es: "Suelta una imagen aquí o haz clic para buscar",
    he: "גרור תמונה לכאן או לחץ לבחירה"
  },
  "settings.undo": { en: "Undo", es: "Deshacer", he: "ביטול פעולה" },

  "settings.activity": {
    en: "Activity",
    es: "Actividad",
    he: "פעילות"
  },
  "settings.allActions": {
    en: "All actions",
    es: "Todas las acciones",
    he: "כל הפעולות"
  },
  "settings.allModules": {
    en: "All modules",
    es: "Todos los módulos",
    he: "כל המודולים"
  },
  "settings.filterByAction": {
    en: "Filter by action",
    es: "Filtrar por acción",
    he: "סינון לפי פעולה"
  },
  "settings.filterByModule": {
    en: "Filter by module",
    es: "Filtrar por módulo",
    he: "סינון לפי מודול"
  },
  "settings.activityNeeds": {
    en: "Reading the activity history needs",
    es: "Leer el historial de actividad requiere",
    he: "קריאת היסטוריית הפעילות דורשת"
  },

  "settings.time12": {
    en: "12 Hour (1:30 PM)",
    es: "12 horas (1:30 p. m.)",
    he: "12 שעות (1:30 PM)"
  },
  "settings.time24": {
    en: "24 Hour (13:30)",
    es: "24 horas (13:30)",
    he: "24 שעות (13:30)"
  },
  "settings.paymentLinkHint": {
    en: "Where the Pay balance button on your client portal sends clients. Leave this empty to hide that button.",
    es: "A dónde envía a los clientes el botón Pagar saldo del portal. Déjalo vacío para ocultar ese botón.",
    he: "לאן כפתור ״תשלום היתרה״ בפורטל הלקוח שולח את הלקוחות. השאר ריק כדי להסתיר את הכפתור."
  },
  "settings.activityEmpty": {
    en: "Nothing yet. Every edit to an event, menu, hall, kitchen job or setting from here on lands in this list.",
    es: "Nada todavía. Cada cambio en un evento, menú, salón, tarea de cocina o ajuste aparecerá a partir de ahora en esta lista.",
    he: "עדיין כלום. כל שינוי באירוע, בתפריט, באולם, במשימת מטבח או בהגדרה יופיע מכאן ואילך ברשימה הזו."
  },
  "settings.activityBlurb": {
    en: "Every change, its author, and what it did. Append-only.",
    es: "Cada cambio, su autor y lo que hizo. Solo se agrega.",
    he: "כל שינוי, מי ביצע אותו ומה הוא עשה. רק הוספה."
  },
  "settings.portalHeaderHint": {
    en: "What clients see behind the event name when they open their portal. Saved with the rest of this page.",
    es: "Lo que ven los clientes detrás del nombre del evento al abrir su portal. Se guarda junto con el resto de esta página.",
    he: "מה שהלקוחות רואים מאחורי שם האירוע כשהם פותחים את הפורטל. נשמר יחד עם שאר העמוד."
  },
  "settings.hex": { en: "Hex", es: "Hex", he: "הקס" },
  "settings.privilegeTrailNote": {
    en: " Privilege changes need audit.read and are not shown.",
    es: " Los cambios de privilegios requieren audit.read y no se muestran.",
    he: " שינויי הרשאות דורשים audit.read ואינם מוצגים."
  },
  "settings.resetNoUndo": {
    en: "There is no undo and no export first. Take a backup outside Event Core if the data still matters to anybody.",
    es: "No hay deshacer ni exportación previa. Haz una copia de seguridad fuera de Event Core si los datos aún importan a alguien.",
    he: "אין ביטול ואין ייצוא מראש. גבה את הנתונים מחוץ ל-Event Core אם הם עדיין חשובים למישהו."
  },
  "settings.byActor": {
    en: "by {name}",
    es: "por {name}",
    he: "על ידי {name}"
  },
  "settings.byServiceAccount": {
    en: "by a service account",
    es: "por una cuenta de servicio",
    he: "על ידי חשבון שירות"
  },
  // The four resets. The words a person has to TYPE to arm one stay English -
  // they are what the route compares against - but what they are told they are
  // about to lose is here.
  "reset.events.title": {
    en: "Event reset",
    es: "Restablecer eventos",
    he: "איפוס אירועים"
  },
  "reset.events.summary": {
    en: "Deletes every event and everything recorded against one.",
    es: "Elimina todos los eventos y todo lo registrado en ellos.",
    he: "מוחק את כל האירועים ואת כל מה שנרשם עליהם."
  },
  "reset.events.removes1": {
    en: "All events, confirmed and held",
    es: "Todos los eventos, confirmados y en espera",
    he: "כל האירועים, המאושרים ואלה שבהמתנה"
  },
  "reset.events.removes2": {
    en: "Their menus, kitchen progress and kitchen notifications",
    es: "Sus menús, el progreso en cocina y las notificaciones de cocina",
    he: "התפריטים שלהם, התקדמות המטבח והתראות המטבח"
  },
  "reset.events.removes3": {
    en: "Their invoices, payments, receipts and refunds",
    es: "Sus facturas, pagos, recibos y reembolsos",
    he: "החשבוניות, התשלומים, הקבלות וההחזרים שלהם"
  },
  "reset.events.removes4": {
    en: "Their generated documents, emails, files and dining plans",
    es: "Sus documentos generados, correos, archivos y planes de comedor",
    he: "המסמכים שהופקו, המיילים, הקבצים ותוכניות חדר האוכל שלהם"
  },
  "reset.events.keeps1": {
    en: "The menu library, packages and add-ons",
    es: "La biblioteca de menú, los paquetes y los extras",
    he: "ספריית התפריט, החבילות והתוספות"
  },
  "reset.events.keeps2": {
    en: "Halls, clients, staff and every setting",
    es: "Salones, clientes, personal y todos los ajustes",
    he: "אולמות, לקוחות, צוות וכל ההגדרות"
  },

  "reset.events-and-menus.title": {
    en: "Events and menu reset",
    es: "Restablecer eventos y menú",
    he: "איפוס אירועים ותפריט"
  },
  "reset.events-and-menus.summary": {
    en: "Everything the event reset removes, plus the menu library it was built from.",
    es: "Todo lo que elimina el restablecimiento de eventos, más la biblioteca de menú con la que se construyó.",
    he: "כל מה שאיפוס האירועים מוחק, ובנוסף ספריית התפריט שממנה הם נבנו."
  },
  "reset.events-and-menus.removes1": {
    en: "Everything in the event reset",
    es: "Todo lo del restablecimiento de eventos",
    he: "כל מה שכלול באיפוס האירועים"
  },
  "reset.events-and-menus.removes2": {
    en: "Saved menu items, categories and services",
    es: "Platos, categorías y servicios guardados",
    he: "פריטי תפריט, קטגוריות וסגנונות הגשה שנשמרו"
  },
  "reset.events-and-menus.removes3": {
    en: "Packages, add-ons and tablecloth options",
    es: "Paquetes, extras y opciones de mantelería",
    he: "חבילות, תוספות ואפשרויות מפות שולחן"
  },
  "reset.events-and-menus.removes4": {
    en: "Kitchen-only events raised against a menu",
    es: "Eventos solo de cocina creados sobre un menú",
    he: "אירועי מטבח בלבד שנפתחו מול תפריט"
  },
  "reset.events-and-menus.keeps1": {
    en: "Halls, clients, staff and every setting",
    es: "Salones, clientes, personal y todos los ajustes",
    he: "אולמות, לקוחות, צוות וכל ההגדרות"
  },

  "reset.settings.title": {
    en: "Settings reset",
    es: "Restablecer ajustes",
    he: "איפוס הגדרות"
  },
  "reset.settings.summary": {
    en: "Puts configuration, roles and permissions back to how a new organization starts.",
    es: "Devuelve la configuración, los roles y los permisos al estado de una organización nueva.",
    he: "מחזיר את התצורה, התפקידים וההרשאות למצב שבו ארגון חדש מתחיל."
  },
  "reset.settings.removes1": {
    en: "Every custom role and per-person permission exception",
    es: "Todos los roles personalizados y las excepciones de permisos por persona",
    he: "כל תפקיד מותאם וכל חריגת הרשאה אישית"
  },
  "reset.settings.removes2": {
    en: "Every other person's access, and their sign-in",
    es: "El acceso de todas las demás personas y su inicio de sesión",
    he: "הגישה של כל שאר האנשים וההתחברות שלהם"
  },
  "reset.settings.removes3": {
    en: "Service accounts and the authorization history",
    es: "Las cuentas de servicio y el historial de autorizaciones",
    he: "חשבונות שירות והיסטוריית ההרשאות"
  },
  "reset.settings.removes4": {
    en: "Saved preferences, notification settings and payment settings",
    es: "Las preferencias guardadas, los ajustes de notificaciones y los de pago",
    he: "העדפות שמורות, הגדרות התראות והגדרות תשלום"
  },
  "reset.settings.keeps1": {
    en: "Events, menus and halls",
    es: "Eventos, menús y salones",
    he: "אירועים, תפריטים ואולמות"
  },
  "reset.settings.keeps2": {
    en: "Your own account, and the organization's plan",
    es: "Tu propia cuenta y el plan de la organización",
    he: "החשבון שלך ותוכנית הארגון"
  },

  "reset.full-account.title": {
    en: "Full account reset",
    es: "Restablecer toda la cuenta",
    he: "איפוס מלא של החשבון"
  },
  "reset.full-account.summary": {
    en: "Empties the organization completely, leaving the account and your own login.",
    es: "Vacía la organización por completo y deja la cuenta y tu propio inicio de sesión.",
    he: "מרוקן את הארגון לחלוטין, ומשאיר את החשבון ואת ההתחברות שלך."
  },
  "reset.full-account.removes1": {
    en: "Everything the other three resets remove",
    es: "Todo lo que eliminan los otros tres restablecimientos",
    he: "כל מה ששלושת האיפוסים האחרים מוחקים"
  },
  "reset.full-account.removes2": {
    en: "Halls, hall maps, event types and blocked dates",
    es: "Salones, mapas de salón, tipos de evento y fechas bloqueadas",
    he: "אולמות, מפות אולם, סוגי אירוע ותאריכים חסומים"
  },
  "reset.full-account.removes3": {
    en: "Clients, vendors, files and stored documents",
    es: "Clientes, proveedores, archivos y documentos guardados",
    he: "לקוחות, ספקים, קבצים ומסמכים שמורים"
  },
  "reset.full-account.removes4": {
    en: "Kitchen workers, day notes and the activity history",
    es: "Personal de cocina, notas del día e historial de actividad",
    he: "עובדי מטבח, הערות יומיות והיסטוריית הפעילות"
  },
  "reset.full-account.keeps1": {
    en: "The organization itself and its subscription",
    es: "La organización en sí y su suscripción",
    he: "הארגון עצמו והמנוי שלו"
  },
  "reset.full-account.keeps2": {
    en: "Your own login, membership and the Owner role",
    es: "Tu propio inicio de sesión, tu pertenencia y el rol de Propietario",
    he: "ההתחברות שלך, החברות שלך ותפקיד הבעלים"
  },

  "reset.finishedOne": {
    en: "{title} finished. 1 record removed. Reload the page to see the empty workspace.",
    es: "{title} finalizado. Se eliminó 1 registro. Recarga la página para ver el espacio vacío.",
    he: "{title} הסתיים. רשומה אחת הוסרה. רענן את העמוד כדי לראות את סביבת העבודה הריקה."
  },
  "reset.finishedMany": {
    en: "{title} finished. {count} records removed. Reload the page to see the empty workspace.",
    es: "{title} finalizado. Se eliminaron {count} registros. Recarga la página para ver el espacio vacío.",
    he: "{title} הסתיים. {count} רשומות הוסרו. רענן את העמוד כדי לראות את סביבת העבודה הריקה."
  },

  // The subscription ladder. The tier NAMES stay English - they are the
  // product's own vocabulary, the same in every language and the string the
  // checkout route and the entitlement checks read - but everything a venue
  // reads to choose between them is here.
  "plan.billedAnnually": {
    en: "Billed annually",
    es: "Facturación anual",
    he: "חיוב שנתי"
  },
  "plan.trialLength": {
    en: "14-day trial",
    es: "Prueba de 14 días",
    he: "תקופת ניסיון של 14 יום"
  },
  "plan.starter.description": {
    en: "Perfect for small venues",
    es: "Perfecto para recintos pequeños",
    he: "מושלם למקומות קטנים"
  },
  "plan.professional.description": {
    en: "Best for growing venues",
    es: "Ideal para recintos en crecimiento",
    he: "הכי מתאים למקומות שגדלים"
  },
  "plan.enterprise.description": {
    en: "For large venues & chains",
    es: "Para recintos grandes y cadenas",
    he: "למקומות גדולים ולרשתות"
  },
  "plan.free_trial.description": {
    en: "Try Event Core with one active hall",
    es: "Prueba Event Core con un salón activo",
    he: "נסו את Event Core עם אולם פעיל אחד"
  },

  "plan.feature.halls2": {
    en: "Up to 2 halls",
    es: "Hasta 2 salones",
    he: "עד 2 אולמות"
  },
  "plan.feature.halls10": {
    en: "Up to 10 halls",
    es: "Hasta 10 salones",
    he: "עד 10 אולמות"
  },
  "plan.feature.hallsUnlimited": {
    en: "Unlimited halls",
    es: "Salones ilimitados",
    he: "אולמות ללא הגבלה"
  },
  "plan.feature.hall1": {
    en: "1 active hall",
    es: "1 salón activo",
    he: "אולם פעיל אחד"
  },
  "plan.feature.unlimitedBookings": {
    en: "Unlimited bookings",
    es: "Reservas ilimitadas",
    he: "הזמנות ללא הגבלה"
  },
  "plan.feature.calendarScheduling": {
    en: "Calendar & scheduling",
    es: "Calendario y programación",
    he: "יומן ותזמון"
  },
  "plan.feature.clientManagement": {
    en: "Client management",
    es: "Gestión de clientes",
    he: "ניהול לקוחות"
  },
  "plan.feature.invoicingPayments": {
    en: "Invoicing & payments",
    es: "Facturación y pagos",
    he: "חשבוניות ותשלומים"
  },
  "plan.feature.emailSupport": {
    en: "Email support",
    es: "Soporte por correo",
    he: "תמיכה בדוא״ל"
  },
  "plan.feature.allStarter": {
    en: "All Starter features",
    es: "Todas las funciones de Starter",
    he: "כל התכונות של Starter"
  },
  "plan.feature.staffManagement": {
    en: "Staff management",
    es: "Gestión de personal",
    he: "ניהול צוות"
  },
  "plan.feature.reportsAnalytics": {
    en: "Reports & analytics",
    es: "Informes y analíticas",
    he: "דוחות וניתוחים"
  },
  "plan.feature.pdfContracts": {
    en: "PDF contracts",
    es: "Contratos en PDF",
    he: "חוזים ב-PDF"
  },
  "plan.feature.prioritySupport": {
    en: "Priority support",
    es: "Soporte prioritario",
    he: "תמיכה בעדיפות"
  },
  "plan.feature.allProfessional": {
    en: "All Professional features",
    es: "Todas las funciones de Professional",
    he: "כל התכונות של Professional"
  },
  "plan.feature.advancedAnalytics": {
    en: "Advanced analytics",
    es: "Analíticas avanzadas",
    he: "ניתוחים מתקדמים"
  },
  "plan.feature.apiAccess": {
    en: "API access",
    es: "Acceso a la API",
    he: "גישה ל-API"
  },
  "plan.feature.accountManager": {
    en: "Dedicated account manager",
    es: "Gestor de cuenta dedicado",
    he: "מנהל לקוח ייעודי"
  },
  "plan.feature.premiumSupport": {
    en: "24/7 premium support",
    es: "Soporte premium 24/7",
    he: "תמיכת פרימיום 24/7"
  },
  "plan.feature.dashboardAccess": {
    en: "Dashboard access",
    es: "Acceso al panel",
    he: "גישה ללוח הבקרה"
  },
  "plan.feature.bookingTools": {
    en: "Calendar & booking tools",
    es: "Herramientas de calendario y reservas",
    he: "כלי יומן והזמנות"
  },
  "plan.feature.kitchenDiningPreviews": {
    en: "Kitchen and dining previews",
    es: "Vistas previas de cocina y comedor",
    he: "תצוגות מקדימות של המטבח וחדר האוכל"
  },
  "plan.feature.upgradeAnytime": {
    en: "Upgrade anytime",
    es: "Mejora tu plan cuando quieras",
    he: "שדרוג בכל עת"
  },

  // The branding field is used twice, for the logo and for the portal header
  // image, and names its subject inside four sentences.
  "settings.subjectLogo": { en: "logo", es: "logotipo", he: "לוגו" },
  "settings.subjectHeaderImage": {
    en: "header image",
    es: "imagen de cabecera",
    he: "תמונת הכותרת"
  },
  "settings.currentSubject": {
    en: "Current {subject}",
    es: "{subject} actual",
    he: "{subject} נוכחי"
  },
  "settings.uploadsWhenYouSave": {
    en: "{size} - uploads when you save",
    es: "{size} - se sube al guardar",
    he: "{size} - יועלה בעת השמירה"
  },
  "settings.subjectWillBeRemoved": {
    en: "The current {subject} will be removed when you save.",
    es: "El {subject} actual se eliminará al guardar.",
    he: "{subject} הנוכחי יוסר בעת השמירה."
  },
  "settings.savingReplacesSubject": {
    en: "Saving replaces the {subject} this organization has now.",
    es: "Al guardar se reemplaza el {subject} que esta organización tiene ahora.",
    he: "השמירה תחליף את {subject} שיש לארגון כעת."
  },
  "settings.savedForOrganization": {
    en: "Saved for this organization",
    es: "Guardado para esta organización",
    he: "נשמר עבור הארגון הזה"
  },
  "settings.imageHint": {
    en: "Optional. {formats}, up to {mb} MB.",
    es: "Opcional. {formats}, hasta {mb} MB.",
    he: "אופציונלי. {formats}, עד {mb} מגה-בייט."
  },
  "settings.imageHintRequired": {
    en: "{formats}, up to {mb} MB. Wide images read best.",
    es: "{formats}, hasta {mb} MB. Las imágenes anchas se ven mejor.",
    he: "{formats}, עד {mb} מגה-בייט. תמונות רחבות נראות טוב יותר."
  },

  "settings.eventTypeSaveFailed": {
    en: "Unable to save event type.",
    es: "No se pudo guardar el tipo de evento.",
    he: "לא ניתן לשמור את סוג האירוע."
  },
  "settings.eventTypeUpdateFailed": {
    en: "Unable to update event type.",
    es: "No se pudo actualizar el tipo de evento.",
    he: "לא ניתן לעדכן את סוג האירוע."
  },
  "settings.eventTypeDeleteFailed": {
    en: "Unable to delete event type.",
    es: "No se pudo eliminar el tipo de evento.",
    he: "לא ניתן למחוק את סוג האירוע."
  },
  "settings.allDays": { en: "All days", es: "Todos los días", he: "כל הימים" },
  "settings.editEventType": {
    en: "Edit event type",
    es: "Editar tipo de evento",
    he: "עריכת סוג אירוע"
  },
  "settings.addEventType": {
    en: "Add event type",
    es: "Agregar tipo de evento",
    he: "הוספת סוג אירוע"
  },
  "settings.saveEventType": {
    en: "Save event type",
    es: "Guardar tipo de evento",
    he: "שמירת סוג האירוע"
  },

  "settings.regularBasePrice": {
    en: "Regular base price",
    es: "Precio base normal",
    he: "מחיר בסיס רגיל"
  },
  "settings.regularPerCouple": {
    en: "Regular per couple",
    es: "Normal por pareja",
    he: "רגיל לזוג"
  },
  "settings.memberBasePrice": {
    en: "Member base price",
    es: "Precio base para socios",
    he: "מחיר בסיס לחבר"
  },
  "settings.memberPerCouple": {
    en: "Member per couple",
    es: "Socio por pareja",
    he: "חבר לזוג"
  },
  "settings.perCouplePrice": {
    en: "Per couple price",
    es: "Precio por pareja",
    he: "מחיר לזוג"
  },
  "settings.memberPerCouplePrice": {
    en: "Member per couple price",
    es: "Precio por pareja para socios",
    he: "מחיר לזוג לחבר"
  },
  "settings.trialHallLimitLong": {
    en: "Free trial organizations can only use 1 active hall. Upgrade your plan to add more halls.",
    es: "Las organizaciones en prueba gratuita solo pueden usar 1 salón activo. Mejora tu plan para agregar más.",
    he: "ארגונים בתקופת ניסיון חינם יכולים להשתמש באולם פעיל אחד בלבד. שדרג את התוכנית כדי להוסיף עוד."
  },
  "settings.trialHallLimit": {
    en: "Free trial organizations can only use 1 active hall.",
    es: "Las organizaciones en prueba gratuita solo pueden usar 1 salón activo.",
    he: "ארגונים בתקופת ניסיון חינם יכולים להשתמש באולם פעיל אחד בלבד."
  },
  "settings.enterHallName": {
    en: "Enter a hall name.",
    es: "Introduce un nombre de salón.",
    he: "הזן שם אולם."
  },
  "settings.hallSaveFailed": {
    en: "Unable to save this hall.",
    es: "No se pudo guardar este salón.",
    he: "לא ניתן לשמור את האולם."
  },
  "settings.hallUpdateFailed": {
    en: "Unable to update this hall.",
    es: "No se pudo actualizar este salón.",
    he: "לא ניתן לעדכן את האולם."
  },
  "settings.hallDeleteFailed": {
    en: "Unable to delete this hall.",
    es: "No se pudo eliminar este salón.",
    he: "לא ניתן למחוק את האולם."
  },
  "settings.notBookable": {
    en: "Not bookable",
    es: "No reservable",
    he: "לא ניתן להזמנה"
  },
  "settings.editHall": {
    en: "Edit hall",
    es: "Editar salón",
    he: "עריכת אולם"
  },
  "settings.addHall": {
    en: "Add hall",
    es: "Agregar salón",
    he: "הוספת אולם"
  },
  "settings.createHall": {
    en: "Create hall",
    es: "Crear salón",
    he: "יצירת אולם"
  },
  "settings.hallPricingHint": {
    en: "Used as the default hall pricing when creating packages, proposals, or event billing.",
    es: "Se usa como precio predeterminado del salón al crear paquetes, propuestas o facturación de eventos.",
    he: "משמש כתמחור ברירת המחדל של האולם ביצירת חבילות, הצעות או חיוב אירועים."
  },
  "settings.hallPricingReadOnly": {
    en: "Read-only: setting what a hall costs needs the hall pricing permission. Everything else on this form is yours to change.",
    es: "Solo lectura: fijar el precio de un salón requiere el permiso de precios. Todo lo demás en este formulario puedes cambiarlo.",
    he: "לקריאה בלבד: קביעת מחיר האולם דורשת הרשאת תמחור. כל השאר בטופס פתוח לשינוי."
  },

  "settings.mfaLoadFailed": {
    en: "Unable to load security settings.",
    es: "No se pudo cargar la configuración de seguridad.",
    he: "לא ניתן לטעון את הגדרות האבטחה."
  },
  "settings.mfaSetupFailed": {
    en: "Unable to start two-factor authentication setup.",
    es: "No se pudo iniciar la configuración de la autenticación de dos factores.",
    he: "לא ניתן להתחיל את הגדרת האימות הדו-שלבי."
  },
  "settings.mfaEmailSent": {
    en: "We sent a verification code to {email} before showing the authenticator setup. It expires in 10 minutes.",
    es: "Enviamos un código de verificación a {email} antes de mostrar la configuración del autenticador. Caduca en 10 minutos.",
    he: "שלחנו קוד אימות אל {email} לפני הצגת הגדרת המאמת. הוא יפוג בעוד 10 דקות."
  },
  "settings.mfaEmailCode": {
    en: "Code from the email",
    es: "Código del correo",
    he: "הקוד מהדוא״ל"
  },
  "settings.mfaEmailVerify": {
    en: "Verify email",
    es: "Verificar correo",
    he: "אמת דוא״ל"
  },
  "settings.mfaEmailResend": {
    en: "Send a new code",
    es: "Enviar un código nuevo",
    he: "שלח קוד חדש"
  },
  "settings.mfaEmailFailed": {
    en: "The verification email could not be sent or checked. Try again.",
    es: "No se pudo enviar o comprobar el correo de verificación. Inténtalo de nuevo.",
    he: "לא ניתן היה לשלוח או לבדוק את דוא״ל האימות. נסה שוב."
  },
  "settings.mfaEnterEmailCode": {
    en: "Enter the 6-digit code from the email.",
    es: "Introduce el código de 6 dígitos del correo.",
    he: "הזן את הקוד בן 6 הספרות מהדוא״ל."
  },
  "settings.mfaSetupExpired": {
    en: "Setup took too long, so it was cancelled to keep your account safe. Start again.",
    es: "La configuración tardó demasiado y se canceló para proteger tu cuenta. Empieza de nuevo.",
    he: "ההגדרה ארכה זמן רב מדי ובוטלה כדי לשמור על חשבונך. התחל מחדש."
  },
  "settings.enterSixDigitCode": {
    en: "Enter the 6-digit code from your authenticator app.",
    es: "Introduce el código de 6 dígitos de tu app de autenticación.",
    he: "הזן את הקוד בן 6 הספרות מאפליקציית האימות."
  },
  "settings.mfaEnabled": {
    en: "Two-factor authentication is now enabled.",
    es: "La autenticación de dos factores está activada.",
    he: "האימות הדו-שלבי הופעל."
  },
  "settings.mfaCodeRejected": {
    en: "The verification code could not be accepted.",
    es: "No se pudo aceptar el código de verificación.",
    he: "לא ניתן היה לקבל את קוד האימות."
  },
  "settings.mfaDisabled": {
    en: "Two-factor authentication has been disabled.",
    es: "La autenticación de dos factores se ha desactivado.",
    he: "האימות הדו-שלבי בוטל."
  },
  "settings.otherSessionsSignedOut": {
    en: "Sessions on untrusted devices have been signed out.",
    es: "Se cerraron las sesiones de los dispositivos no confiables.",
    he: "ההפעלות במכשירים הלא מהימנים נותקו."
  },
  "settings.notEnabled": {
    en: "Not enabled",
    es: "No activado",
    he: "לא מופעל"
  },
  // The other half of the badge beside it. It was hardcoded English, which
  // read as a deliberate choice next to a translated "Not enabled" and was
  // simply an oversight.
  "settings.enabled": {
    en: "Enabled",
    es: "Activado",
    he: "מופעל"
  },
  "settings.disableMfa": {
    en: "Disable MFA",
    es: "Desactivar MFA",
    he: "ביטול אימות דו-שלבי"
  },
  "settings.setUpMfa": {
    en: "Set up MFA",
    es: "Configurar MFA",
    he: "הגדרת אימות דו-שלבי"
  },
  "settings.authenticatorQr": {
    en: "Authenticator QR code",
    es: "Código QR del autenticador",
    he: "קוד QR לאפליקציית האימות"
  },

  "settings.styleImage": { en: "Image", es: "Imagen", he: "תמונה" },
  "settings.styleImageHint": {
    en: "A photograph, dimmed so the text stays readable.",
    es: "Una fotografía, atenuada para que el texto siga siendo legible.",
    he: "תצלום, מעומעם כדי שהטקסט יישאר קריא."
  },
  "settings.solidColour": {
    en: "Solid colour",
    es: "Color sólido",
    he: "צבע אחיד"
  },
  "settings.solidColourHint": {
    en: "One colour behind the event name.",
    es: "Un color detrás del nombre del evento.",
    he: "צבע אחד מאחורי שם האירוע."
  },
  "settings.resetDidNotRun": {
    en: "The reset did not run.",
    es: "El restablecimiento no se ejecutó.",
    he: "האיפוס לא בוצע."
  },
  "settings.resetting": {
    en: "Resetting...",
    es: "Restableciendo...",
    he: "מאפס..."
  },

  "settings.manageStaff": {
    en: "Manage staff",
    es: "Gestionar el personal",
    he: "ניהול הצוות"
  },
  "settings.manageStaffHint": {
    en: "Add, deactivate, and update team members.",
    es: "Agrega, desactiva y actualiza miembros del equipo.",
    he: "הוספה, השבתה ועדכון של חברי צוות."
  },
  "settings.manageRoles": {
    en: "Manage roles",
    es: "Gestionar roles",
    he: "ניהול תפקידים"
  },
  "settings.manageRolesHint": {
    en: "Create roles and assign permission sets.",
    es: "Crea roles y asigna conjuntos de permisos.",
    he: "יצירת תפקידים והקצאת ערכות הרשאות."
  },
  "settings.permissionSummary": {
    en: "Permission summary",
    es: "Resumen de permisos",
    he: "סיכום הרשאות"
  },
  "settings.permissionSummaryHint": {
    en: "Review access across the organization.",
    es: "Revisa el acceso en toda la organización.",
    he: "סקירת ההרשאות בכל הארגון."
  },
  "settings.inviteUser": {
    en: "Invite user",
    es: "Invitar usuario",
    he: "הזמנת משתמש"
  },
  "settings.inviteUserHint": {
    en: "Send a new staff member an invitation.",
    es: "Envía una invitación a un nuevo miembro del personal.",
    he: "שלח הזמנה לחבר צוות חדש."
  },
  "settings.brandColor": {
    en: "Brand color",
    es: "Color de marca",
    he: "צבע המותג"
  },
  "settings.emailFooter": {
    en: "Email footer",
    es: "Pie de correo",
    he: "כותרת תחתונה בדוא״ל"
  },
  "settings.pdfBranding": {
    en: "PDF & print branding",
    es: "Marca en PDF e impresión",
    he: "מיתוג ב-PDF ובהדפסה"
  },
  "settings.stripeLink": {
    en: "Stripe / payment link",
    es: "Stripe / enlace de pago",
    he: "Stripe / קישור תשלום"
  },
  "settings.whatsappSms": {
    en: "WhatsApp & SMS",
    es: "WhatsApp y SMS",
    he: "WhatsApp ו-SMS"
  },

  "settings.paymentLinkSaved": {
    en: "Payment link saved.",
    es: "Enlace de pago guardado.",
    he: "קישור התשלום נשמר."
  },
  "settings.paymentLinkCleared": {
    en: "Payment link cleared. Pay balance is hidden on the client portal.",
    es: "Enlace de pago borrado. El botón Pagar saldo queda oculto en el portal.",
    he: "קישור התשלום נוקה. כפתור תשלום היתרה מוסתר בפורטל הלקוח."
  },
  "settings.paymentLinkSaveFailed": {
    en: "Could not save the payment link.",
    es: "No se pudo guardar el enlace de pago.",
    he: "לא ניתן היה לשמור את קישור התשלום."
  },
  "settings.notificationSaveFailed": {
    en: "Could not save notification preference.",
    es: "No se pudo guardar la preferencia de notificación.",
    he: "לא ניתן היה לשמור את העדפת ההתראות."
  },
  "settings.saveFailed": {
    en: "Could not save settings.",
    es: "No se pudo guardar la configuración.",
    he: "לא ניתן היה לשמור את ההגדרות."
  },
  "settings.saved": {
    en: "Settings saved.",
    es: "Configuración guardada.",
    he: "ההגדרות נשמרו."
  },
  "settings.noViewPermission": {
    en: "You do not have permission to view organization settings. Contact an administrator if you need access.",
    es: "No tienes permiso para ver la configuración de la organización. Contacta a un administrador si necesitas acceso.",
    he: "אין לך הרשאה לצפות בהגדרות הארגון. פנה למנהל אם נדרשת לך גישה."
  },
  "settings.emailNotifications": {
    en: "Email notifications",
    es: "Notificaciones por correo",
    he: "התראות בדוא״ל"
  },
  "settings.emailNotificationsHint": {
    en: "Receive important updates via email.",
    es: "Recibe actualizaciones importantes por correo.",
    he: "קבל עדכונים חשובים בדוא״ל."
  },
  "settings.eventConfirmations": {
    en: "Event confirmations",
    es: "Confirmaciones de eventos",
    he: "אישורי אירועים"
  },
  "settings.eventConfirmationsHint": {
    en: "New bookings, updates, and cancellations.",
    es: "Nuevas reservas, actualizaciones y cancelaciones.",
    he: "הזמנות חדשות, עדכונים וביטולים."
  },
  "settings.invoiceAlerts": {
    en: "Invoice & billing alerts",
    es: "Alertas de facturas y cobros",
    he: "התראות חשבוניות וחיוב"
  },
  "settings.invoiceAlertsHint": {
    en: "Payment reminders and invoice updates.",
    es: "Recordatorios de pago y actualizaciones de facturas.",
    he: "תזכורות תשלום ועדכוני חשבוניות."
  },
  "settings.systemAnnouncements": {
    en: "System announcements",
    es: "Anuncios del sistema",
    he: "הודעות מערכת"
  },
  "settings.systemAnnouncementsHint": {
    en: "Product updates and maintenance alerts.",
    es: "Actualizaciones del producto y avisos de mantenimiento.",
    he: "עדכוני מוצר והתראות תחזוקה."
  },
  "settings.integrationsStatus": {
    en: "Integrations Status",
    es: "Estado de las integraciones",
    he: "מצב השילובים"
  },
  "settings.savePaymentLink": {
    en: "Save Payment Link",
    es: "Guardar enlace de pago",
    he: "שמירת קישור התשלום"
  },
  "settings.uploadingImages": {
    en: "Uploading images...",
    es: "Subiendo imágenes...",
    he: "מעלה תמונות..."
  },
  "settings.reset": { en: "Reset", es: "Restablecer", he: "איפוס" },
  "settings.resetPermanent": {
    en: "Everything on this panel is permanent.",
    es: "Todo en este panel es permanente.",
    he: "כל מה שבפאנל הזה הוא בלתי הפיך."
  },
  "settings.keeps": { en: "Keeps", es: "Conserva", he: "נשמר" },
  "settings.deletes": { en: "Deletes", es: "Elimina", he: "נמחק" }
});
