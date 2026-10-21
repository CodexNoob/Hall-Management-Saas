import { defineMessages } from "@/lib/i18n/types";

/** The in-app support centre and the organization onboarding form. */
export const supportMessages = defineMessages({
  "support.title": {
    en: "Event Core Support",
    es: "Soporte de Event Core",
    he: "תמיכת Event Core"
  },
  "support.reportProblem": {
    en: "Report a problem",
    es: "Informar de un problema",
    he: "דיווח על בעיה"
  },
  "support.reportBlurb": {
    en: "Report a bug and receive a trackable reference number.",
    es: "Informa de un error y recibe un número de referencia rastreable.",
    he: "דווח על תקלה וקבל מספר אסמכתה למעקב."
  },
  "support.closeForm": {
    en: "Close report form",
    es: "Cerrar el formulario de informe",
    he: "סגירת טופס הדיווח"
  },
  "support.problemTitle": {
    en: "Problem title",
    es: "Título del problema",
    he: "כותרת הבעיה"
  },
  "support.problemTitleExample": {
    en: "Example: New booking does not save",
    es: "Ejemplo: la nueva reserva no se guarda",
    he: "לדוגמה: הזמנה חדשה לא נשמרת"
  },
  "support.whatHappened": {
    en: "What happened?",
    es: "¿Qué ocurrió?",
    he: "מה קרה?"
  },
  "support.addMoreInfo": {
    en: "Add more information…",
    es: "Agrega más información…",
    he: "הוסף מידע נוסף…"
  },
  "support.noSecrets": {
    en: "Do not include passwords, card details, or authentication codes.",
    es: "No incluyas contraseñas, datos de tarjetas ni códigos de autenticación.",
    he: "אין לכלול סיסמאות, פרטי כרטיס או קודי אימות."
  },
  "support.priority": {
    en: "Priority",
    es: "Prioridad",
    he: "עדיפות"
  },
  "support.priorityLow": { en: "Low", es: "Baja", he: "נמוכה" },
  "support.priorityNormal": {
    en: "Normal",
    es: "Normal",
    he: "רגילה"
  },
  "support.priorityHigh": { en: "High", es: "Alta", he: "גבוהה" },
  "support.priorityCritical": {
    en: "Critical — service unavailable",
    es: "Crítica: servicio no disponible",
    he: "קריטית — השירות אינו זמין"
  },
  "support.categoryBug": {
    en: "Bug or error",
    es: "Error o fallo",
    he: "תקלה או שגיאה"
  },
  "support.categoryFeature": {
    en: "Feature request",
    es: "Solicitud de función",
    he: "בקשת תכונה"
  },
  "support.categoryBilling": {
    en: "Billing or subscription",
    es: "Facturación o suscripción",
    he: "חיוב או מנוי"
  },
  "support.categoryAccount": {
    en: "Account or login",
    es: "Cuenta o inicio de sesión",
    he: "חשבון או כניסה"
  },
  "support.categoryOther": { en: "Other", es: "Otro", he: "אחר" },
  "support.requests": {
    en: "Support requests",
    es: "Solicitudes de soporte",
    he: "פניות תמיכה"
  },
  "support.noRequests": {
    en: "No support requests have been submitted.",
    es: "No se han enviado solicitudes de soporte.",
    he: "לא נשלחו פניות תמיכה."
  },
  "support.loadingRequests": {
    en: "Loading requests…",
    es: "Cargando solicitudes…",
    he: "טוען פניות…"
  },
  "support.loadingReplies": {
    en: "Loading replies...",
    es: "Cargando respuestas...",
    he: "טוען תגובות..."
  },
  "support.submitted": {
    en: "Request submitted",
    es: "Solicitud enviada",
    he: "הפנייה נשלחה"
  },
  "support.yourReference": {
    en: "Your support reference is:",
    es: "Tu referencia de soporte es:",
    he: "אסמכתת התמיכה שלך היא:"
  },

  "support.repliesLoadFailed": {
    en: "Unable to load replies.",
    es: "No se pudieron cargar las respuestas.",
    he: "לא ניתן לטעון את התגובות."
  },
  "support.unknownPlatform": {
    en: "Unknown platform",
    es: "Plataforma desconocida",
    he: "פלטפורמה לא ידועה"
  },
  "support.replyFailed": {
    en: "Unable to send reply.",
    es: "No se pudo enviar la respuesta.",
    he: "לא ניתן לשלוח את התגובה."
  },
  "support.sending": {
    en: "Sending…",
    es: "Enviando…",
    he: "שולח…"
  },
  "support.sendReply": {
    en: "Send reply",
    es: "Enviar respuesta",
    he: "שליחת תגובה"
  },

  "onboarding.setupFailed": {
    en: "Setup failed",
    es: "La configuración falló",
    he: "ההגדרה נכשלה"
  },
  "onboarding.enterOrganizationName": {
    en: "Please enter your organization name.",
    es: "Introduce el nombre de tu organización.",
    he: "הזן את שם הארגון."
  },
  "onboarding.enterFullName": {
    en: "Please enter your full name.",
    es: "Introduce tu nombre completo.",
    he: "הזן את שמך המלא."
  },
  "onboarding.organizationReady": {
    en: "{name} is ready.",
    es: "{name} está listo.",
    he: "{name} מוכן."
  },
  "onboarding.organizationCreated": {
    en: "Organization created",
    es: "Organización creada",
    he: "הארגון נוצר"
  },
  "onboarding.createFailed": {
    en: "Unable to create your organization. Please try again.",
    es: "No se pudo crear tu organización. Inténtalo de nuevo.",
    he: "לא ניתן ליצור את הארגון. נסה שוב."
  },
  "onboarding.signOutFailed": {
    en: "Unable to sign out. Please try again.",
    es: "No se pudo cerrar sesión. Inténtalo de nuevo.",
    he: "לא ניתן להתנתק. נסה שוב."
  },
  "onboarding.signOutFailedTitle": {
    en: "Sign-out failed",
    es: "Fallo al cerrar sesión",
    he: "ההתנתקות נכשלה"
  },
  "onboarding.signingOut": {
    en: "Signing out...",
    es: "Cerrando sesión...",
    he: "מתנתק..."
  },
  "onboarding.signOut": {
    en: "Sign out",
    es: "Cerrar sesión",
    he: "התנתקות"
  },
  "onboarding.creatingOrganization": {
    en: "Creating organization...",
    es: "Creando la organización...",
    he: "יוצר את הארגון..."
  },
  "onboarding.createOrganizationButton": {
    en: "Create organization",
    es: "Crear organización",
    he: "יצירת ארגון"
  },

  "support.descriptionPlaceholder": {
    en: "Please include:\n1. What you were trying to do\n2. Steps that caused the problem\n3. What you expected\n4. What happened instead",
    es: "Incluye por favor:\n1. Qué intentabas hacer\n2. Los pasos que causaron el problema\n3. Qué esperabas\n4. Qué ocurrió en su lugar",
    he: "אנא כלול:\n1. מה ניסית לעשות\n2. הצעדים שגרמו לבעיה\n3. מה ציפית שיקרה\n4. מה קרה בפועל"
  },
  "support.submitRequest": {
    en: "Submit request",
    es: "Enviar solicitud",
    he: "שליחת הפנייה"
  },
  "support.submitting": {
    en: "Submitting…",
    es: "Enviando…",
    he: "שולח…"
  },
  "onboarding.createOrganization": {
    en: "Create a new organization",
    es: "Crear una nueva organización",
    he: "יצירת ארגון חדש"
  },
  "onboarding.step2of2": {
    en: "Step 2 of 2",
    es: "Paso 2 de 2",
    he: "שלב 2 מתוך 2"
  },
  "onboarding.organizationName": {
    en: "Organization name",
    es: "Nombre de la organización",
    he: "שם הארגון"
  },
  "onboarding.organizationNameHint": {
    en: "Shown to your team on bookings and activity history.",
    es: "Se muestra a tu equipo en las reservas y el historial de actividad.",
    he: "מוצג לצוות שלך בהזמנות ובהיסטוריית הפעילות."
  },
  "onboarding.fullName": {
    en: "Your full name",
    es: "Tu nombre completo",
    he: "שמך המלא"
  },
  "onboarding.phoneHint": {
    en: "Optional. Used for booking confirmations and account recovery.",
    es: "Opcional. Se usa para confirmaciones de reserva y recuperación de la cuenta.",
    he: "אופציונלי. משמש לאישורי הזמנה ולשחזור החשבון."
  },
  "onboarding.plan": { en: "Plan", es: "Plan", he: "תוכנית" },
  "onboarding.blurb": {
    en: "An organization holds your halls, bookings, staff, and billing settings. You can invite your team once it exists.",
    es: "Una organización contiene tus salones, reservas, personal y ajustes de facturación. Podrás invitar a tu equipo una vez creada.",
    he: "ארגון מחזיק את האולמות, ההזמנות, הצוות והגדרות החיוב שלך. תוכל להזמין את הצוות לאחר שייווצר."
  },
  "onboarding.nameHint": {
    en: "What's the name of your company or venue? You can change this later.",
    es: "¿Cómo se llama tu empresa o local? Puedes cambiarlo más adelante.",
    he: "מה שם החברה או המקום שלך? תוכל לשנות זאת מאוחר יותר."
  },
  "onboarding.planHint": {
    en: "Which plan fits your organization best? Every organization starts with a {days}-day free trial — you only pay when you activate billing in Settings.",
    es: "¿Qué plan se ajusta mejor a tu organización? Cada organización empieza con una prueba gratuita de {days} días: solo pagas cuando activas la facturación en Configuración.",
    he: "איזו תוכנית מתאימה לארגון שלך? כל ארגון מתחיל בתקופת ניסיון חינם של {days} ימים — משלמים רק כשמפעילים חיוב בהגדרות."
  }
});
