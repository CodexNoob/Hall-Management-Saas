import { defineMessages } from "@/lib/i18n/types";

/** My Account - the page every signed-in person has for their own account. */
export const accountMessages = defineMessages({
  "account.title": { en: "My Account", es: "Mi cuenta", he: "החשבון שלי" },
  "account.blurb": {
    en: "Your own profile, sign-in and notifications. Changes here affect only you.",
    es: "Tu perfil, inicio de sesión y notificaciones. Los cambios aquí solo te afectan a ti.",
    he: "הפרופיל, הכניסה וההתראות שלך. שינויים כאן משפיעים רק עליך."
  },

  "account.close": {
    en: "Close My Account",
    es: "Cerrar Mi cuenta",
    he: "סגור את החשבון שלי"
  },
  "account.sections": {
    en: "Account sections",
    es: "Secciones de la cuenta",
    he: "אזורי החשבון"
  },
  "account.profileHint": {
    en: "How you appear to your team.",
    es: "Cómo te ve tu equipo.",
    he: "איך הצוות שלך רואה אותך."
  },
  "account.passwordSectionHint": {
    en: "Change the password you sign in with.",
    es: "Cambia la contraseña con la que inicias sesión.",
    he: "שנה את הסיסמה שבה אתה נכנס."
  },
  "account.securityHint": {
    en: "Add a second step when you sign in.",
    es: "Agrega un segundo paso al iniciar sesión.",
    he: "הוסף שלב נוסף בעת הכניסה."
  },
  "account.devicesHint": {
    en: "Where you are signed in right now.",
    es: "Dónde has iniciado sesión ahora mismo.",
    he: "היכן אתה מחובר כרגע."
  },
  "account.notificationsHint": {
    en: "Choose which emails you receive.",
    es: "Elige qué correos recibes.",
    he: "בחר אילו הודעות דוא״ל תקבל."
  },
  "account.regionHint": {
    en: "How dates, times and the dashboard language are shown.",
    es: "Cómo se muestran las fechas, las horas y el idioma del panel.",
    he: "איך מוצגים תאריכים, שעות ושפת המערכת."
  },
  "account.accessHint": {
    en: "Your roles and what they let you do.",
    es: "Tus roles y lo que te permiten hacer.",
    he: "התפקידים שלך ומה הם מאפשרים לך."
  },

  // Profile
  "account.profile": { en: "Profile", es: "Perfil", he: "פרופיל" },
  "account.name": { en: "Full name", es: "Nombre completo", he: "שם מלא" },
  "account.phone": { en: "Phone number", es: "Teléfono", he: "מספר טלפון" },
  "account.email": { en: "Email", es: "Correo electrónico", he: "דוא״ל" },
  "account.department": { en: "Department", es: "Departamento", he: "מחלקה" },
  "account.jobTitle": { en: "Job title", es: "Cargo", he: "תפקיד" },
  "account.organization": {
    en: "Organization",
    es: "Organización",
    he: "ארגון"
  },
  "account.managedByOrganization": {
    en: "Managed by your organization",
    es: "Administrado por tu organización",
    he: "מנוהל על ידי הארגון שלך"
  },
  "account.notSet": { en: "Not set", es: "Sin definir", he: "לא הוגדר" },
  "account.save": {
    en: "Save changes",
    es: "Guardar cambios",
    he: "שמור שינויים"
  },
  "account.saving": { en: "Saving…", es: "Guardando…", he: "שומר…" },
  "account.saved": {
    en: "Profile saved.",
    es: "Perfil guardado.",
    he: "הפרופיל נשמר."
  },
  "account.saveFailed": {
    en: "Could not save your profile.",
    es: "No se pudo guardar tu perfil.",
    he: "לא ניתן היה לשמור את הפרופיל."
  },

  // Password
  "account.password": { en: "Password", es: "Contraseña", he: "סיסמה" },
  "account.passwordHint": {
    en: "Use at least 8 characters, including a letter and a number.",
    es: "Usa al menos 8 caracteres, con una letra y un número.",
    he: "השתמש לפחות ב-8 תווים, כולל אות ומספר."
  },
  "account.currentPassword": {
    en: "Current password",
    es: "Contraseña actual",
    he: "סיסמה נוכחית"
  },
  "account.newPassword": {
    en: "New password",
    es: "Nueva contraseña",
    he: "סיסמה חדשה"
  },
  "account.confirmPassword": {
    en: "Confirm new password",
    es: "Confirmar nueva contraseña",
    he: "אימות סיסמה חדשה"
  },
  "account.changePassword": {
    en: "Change password",
    es: "Cambiar contraseña",
    he: "שנה סיסמה"
  },
  "account.passwordChanged": {
    en: "Your password was changed.",
    es: "Tu contraseña fue cambiada.",
    he: "הסיסמה שלך שונתה."
  },
  "account.passwordFailed": {
    en: "Could not change your password.",
    es: "No se pudo cambiar tu contraseña.",
    he: "לא ניתן היה לשנות את הסיסמה."
  },
  "account.forgotCurrent": {
    en: "Forgot your current password?",
    es: "¿Olvidaste tu contraseña actual?",
    he: "שכחת את הסיסמה הנוכחית?"
  },
  "account.resetSending": {
    en: "Sending reset link…",
    es: "Enviando enlace…",
    he: "שולח קישור…"
  },
  "account.resetSent": {
    en: "We sent a reset link to {email}. Open it to choose a new password.",
    es: "Enviamos un enlace a {email}. Ábrelo para elegir una nueva contraseña.",
    he: "שלחנו קישור לאיפוס אל {email}. פתח אותו כדי לבחור סיסמה חדשה."
  },
  "account.resetFailed": {
    en: "Could not send the reset link.",
    es: "No se pudo enviar el enlace.",
    he: "לא ניתן היה לשלוח את הקישור."
  },
  "account.passwordMismatch": {
    en: "The new passwords do not match.",
    es: "Las contraseñas nuevas no coinciden.",
    he: "הסיסמאות החדשות אינן תואמות."
  },

  // Sign-in security and devices
  "account.security": {
    en: "Sign-in security",
    es: "Seguridad de inicio de sesión",
    he: "אבטחת כניסה"
  },
  "account.twoFactorRequired": {
    en: "Required by your organization, so it cannot be turned off here.",
    es: "Requerido por tu organización, por lo que no se puede desactivar aquí.",
    he: "נדרש על ידי הארגון שלך, ולכן לא ניתן לכבות אותו כאן."
  },
  "account.devices": { en: "Devices", es: "Dispositivos", he: "מכשירים" },

  // Trusted devices
  "account.deviceBannerTitle": {
    en: "Confirm this device",
    es: "Confirma este dispositivo",
    he: "אשר את המכשיר הזה"
  },
  "account.deviceBannerSent": {
    en: "We sent a confirmation email to verify this device.",
    es: "Te enviamos un correo de confirmación para verificar este dispositivo.",
    he: "שלחנו דוא״ל אישור כדי לאמת את המכשיר הזה."
  },
  "account.deviceBannerUnconfirmed": {
    en: "This device isn't confirmed yet. We'll email you a code to confirm it.",
    es: "Este dispositivo aún no está confirmado. Te enviaremos un código por correo.",
    he: "המכשיר הזה עדיין לא אושר. נשלח לך קוד בדוא״ל כדי לאשר אותו."
  },
  "account.deviceGateIntro": {
    en: "We need to confirm this device before opening your dashboard.",
    es: "Necesitamos confirmar este dispositivo antes de abrir tu panel.",
    he: "עלינו לאשר את המכשיר הזה לפני פתיחת לוח הבקרה."
  },
  "account.deviceGateNotYou": {
    en: "If this was not you, reset your password and contact your administrator.",
    es: "Si no fuiste tú, restablece tu contraseña y contacta a tu administrador.",
    he: "אם זה לא היית אתה, אפס את הסיסמה ופנה למנהל."
  },
  "account.deviceResendIn": {
    en: "Resend in {seconds}s",
    es: "Reenviar en {seconds} s",
    he: "שליחה חוזרת בעוד {seconds} שנ׳"
  },
  "account.deviceSignOut": { en: "Sign out", es: "Cerrar sesión", he: "התנתק" },
  "account.deviceSendCode": {
    en: "Send code",
    es: "Enviar código",
    he: "שלח קוד"
  },
  "account.deviceResend": {
    en: "Resend confirmation",
    es: "Reenviar confirmación",
    he: "שלח אישור שוב"
  },
  "account.deviceConfirm": {
    en: "Confirm device",
    es: "Confirmar dispositivo",
    he: "אשר מכשיר"
  },
  "account.deviceCodeLabel": {
    en: "Code from the email",
    es: "Código del correo",
    he: "הקוד מהדוא״ל"
  },
  "account.deviceConfirmed": {
    en: "This device is confirmed.",
    es: "Este dispositivo está confirmado.",
    he: "המכשיר הזה אושר."
  },
  "account.deviceLater": { en: "Later", es: "Más tarde", he: "מאוחר יותר" },
  "account.deviceFailed": {
    en: "Could not confirm this device. Try again.",
    es: "No se pudo confirmar este dispositivo. Inténtalo de nuevo.",
    he: "לא ניתן היה לאשר את המכשיר. נסה שוב."
  },
  "account.trustedDevices": {
    en: "Your devices",
    es: "Tus dispositivos",
    he: "המכשירים שלך"
  },
  "account.trustedDevicesHint": {
    en: "A device you confirm with the emailed code stays trusted for 30 days. Signing in there doesn't ask for that code again - or for your authenticator code once you've entered it on that device, unless your organization requires two-factor authentication. Removing a device ends its trust and signs it out immediately.",
    es: "Un dispositivo que confirmas con el código del correo sigue siendo de confianza durante 30 días. Al iniciar sesión en él no se vuelve a pedir ese código, ni el código de tu app de autenticación una vez que lo hayas ingresado en ese dispositivo, salvo que tu organización exija la verificación en dos pasos. Al quitar un dispositivo se le retira la confianza y se cierra su sesión de inmediato.",
    he: "מכשיר שאישרת עם הקוד מהדוא״ל נשאר מהימן למשך 30 יום. כניסה ממנו לא תבקש שוב את הקוד הזה - וגם לא את קוד אפליקציית האימות לאחר שהזנת אותו במכשיר זה, אלא אם הארגון שלך מחייב אימות דו-שלבי. הסרת מכשיר מבטלת את האמון בו ומנתקת אותו מיד."
  },
  "account.devicePrimary": { en: "Primary", es: "Principal", he: "ראשי" },
  "account.deviceTrusted": { en: "Trusted", es: "De confianza", he: "מהימן" },
  "account.deviceTrustedUntil": {
    en: "Trusted until {when}",
    es: "De confianza hasta {when}",
    he: "מהימן עד {when}"
  },
  "account.deviceTrustExpired": {
    en: "Verification expired",
    es: "Verificación vencida",
    he: "האימות פג"
  },
  "account.deviceUnconfirmed": {
    en: "Not confirmed",
    es: "Sin confirmar",
    he: "לא אושר"
  },
  "account.thisDevice": {
    en: "This device",
    es: "Este dispositivo",
    he: "המכשיר הזה"
  },
  "account.deviceLastSeen": {
    en: "Last seen {when}",
    es: "Visto por última vez {when}",
    he: "נראה לאחרונה {when}"
  },
  "account.deviceRemove": { en: "Remove", es: "Quitar", he: "הסר" },
  /** The current device's button: removing it signs this browser out. */
  "account.deviceRemoveAndSignOut": {
    en: "Remove and sign out",
    es: "Quitar y cerrar sesión",
    he: "הסר והתנתק"
  },
  "account.deviceRemoveConfirm": {
    en: "Remove device",
    es: "Quitar dispositivo",
    he: "הסר מכשיר"
  },
  "account.deviceRemoveCodeSent": {
    en: "To remove this device, enter the 6-digit code we sent to {email}. It expires in 10 minutes.",
    es: "Para quitar este dispositivo, ingresa el código de 6 dígitos que enviamos a {email}. Vence en 10 minutos.",
    he: "כדי להסיר את המכשיר, הזינו את הקוד בן 6 הספרות ששלחנו אל {email}. הוא יפוג בעוד 10 דקות."
  },
  "account.deviceRemoveSignsOutHere": {
    en: "This is the device you are using, so you will be signed out.",
    es: "Es el dispositivo que estás usando, así que se cerrará tu sesión.",
    he: "זה המכשיר שבו אתם משתמשים, ולכן תנותקו."
  },
  "account.deviceRemoveResend": {
    en: "Send a new code",
    es: "Enviar un código nuevo",
    he: "שלח קוד חדש"
  },
  "account.yourEmail": {
    en: "your email",
    es: "tu correo",
    he: "הדוא״ל שלך"
  },
  "account.deviceRemoveFailed": {
    en: "Could not remove that device.",
    es: "No se pudo quitar ese dispositivo.",
    he: "לא ניתן היה להסיר את המכשיר."
  },
  "account.noDevices": {
    en: "No devices recorded yet.",
    es: "Aún no hay dispositivos registrados.",
    he: "עדיין לא נרשמו מכשירים."
  },

  // Notifications
  "account.notifications": {
    en: "Notifications",
    es: "Notificaciones",
    he: "התראות"
  },
  "account.notificationsFailed": {
    en: "Could not save that preference.",
    es: "No se pudo guardar esa preferencia.",
    he: "לא ניתן היה לשמור את ההעדפה."
  },

  // Language and region
  "account.region": {
    en: "Language & region",
    es: "Idioma y región",
    he: "שפה ואזור"
  },
  "account.language": { en: "Language", es: "Idioma", he: "שפה" },
  "account.timezone": { en: "Time zone", es: "Zona horaria", he: "אזור זמן" },
  "account.setByOrganization": {
    en: "Set by your organization",
    es: "Definido por tu organización",
    he: "נקבע על ידי הארגון שלך"
  },

  // My access
  "account.access": { en: "My access", es: "Mi acceso", he: "הגישה שלי" },
  "account.accessBlurb": {
    en: "What you can do in {organization}. Only an administrator can change this.",
    es: "Lo que puedes hacer en {organization}. Solo un administrador puede cambiarlo.",
    he: "מה שאתה יכול לעשות ב-{organization}. רק מנהל יכול לשנות זאת."
  },
  "account.roles": { en: "Roles", es: "Roles", he: "תפקידים" },
  "account.noRoles": {
    en: "You have no role yet. Ask your administrator to assign one.",
    es: "Aún no tienes un rol. Pide a tu administrador que te asigne uno.",
    he: "עדיין אין לך תפקיד. בקש מהמנהל להקצות לך אחד."
  },
  "account.scopeOrganization": {
    en: "Whole organization",
    es: "Toda la organización",
    he: "כל הארגון"
  },
  "account.until": { en: "Until {when}", es: "Hasta {when}", he: "עד {when}" },
  "account.permissions": {
    en: "What you can do",
    es: "Lo que puedes hacer",
    he: "מה אתה יכול לעשות"
  },
  "account.askAdmin": {
    en: "Need more access? Ask your administrator.",
    es: "¿Necesitas más acceso? Pregunta a tu administrador.",
    he: "צריך גישה נוספת? פנה למנהל."
  }
});
