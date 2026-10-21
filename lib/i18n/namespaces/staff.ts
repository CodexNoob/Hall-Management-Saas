import { defineMessages } from "@/lib/i18n/types";

/** Staff directory and invitations, plus the roles, assignments and audit screens. */
export const staffMessages = defineMessages({
  "staff.title": { en: "Staff", es: "Personal", he: "צוות" },

  // The tab strip. Each tab already carries its own `value` identifier, so
  // these replace the display label outright rather than sitting beside it.
  "staff.tab.people": { en: "People", es: "Personas", he: "אנשים" },
  "staff.tab.roles": {
    en: "Roles & Permissions",
    es: "Roles y permisos",
    he: "תפקידים והרשאות"
  },
  "staff.tab.invitations": {
    en: "Invitations",
    es: "Invitaciones",
    he: "הזמנות"
  },
  "staff.tab.activity": {
    en: "Activity",
    es: "Actividad",
    he: "פעילות"
  },
  "staff.management": {
    en: "Staff management",
    es: "Gestión del personal",
    he: "ניהול הצוות"
  },
  "staff.directory": {
    en: "Directory",
    es: "Directorio",
    he: "ספרייה"
  },
  "staff.directoryBlurb": {
    en: "Profiles here, privileges under Roles & Permissions.",
    es: "Los perfiles están aquí; los privilegios en Roles y permisos.",
    he: "הפרופילים כאן, ההרשאות תחת תפקידים והרשאות."
  },
  "staff.invitations": {
    en: "Invitations",
    es: "Invitaciones",
    he: "הזמנות"
  },
  "staff.invitationsBlurb": {
    en: "Sent, and not signed in yet. An invitation is a staff row nobody has arrived at.",
    es: "Enviadas y aún sin iniciar sesión. Una invitación es una ficha de personal a la que nadie ha llegado.",
    he: "נשלחו וטרם נכנסו. הזמנה היא רשומת צוות שאיש טרם הגיע אליה."
  },
  "staff.allSignedIn": {
    en: "Everybody invited has signed in at least once.",
    es: "Todos los invitados han iniciado sesión al menos una vez.",
    he: "כל המוזמנים נכנסו לפחות פעם אחת."
  },
  "staff.invite": { en: "Invite", es: "Invitar", he: "הזמנה" },
  "staff.person": { en: "Person", es: "Persona", he: "אדם" },
  "staff.department": {
    en: "Department",
    es: "Departamento",
    he: "מחלקה"
  },
  "staff.jobTitle": {
    en: "Job title",
    es: "Puesto",
    he: "תפקיד"
  },
  "staff.jobTitleHint": {
    en: "Shown in the sidebar. Not a permission.",
    es: "Se muestra en la barra lateral. No es un permiso.",
    he: "מוצג בסרגל הצד. אינו הרשאה."
  },
  "staff.emailAddresses": {
    en: "Email addresses",
    es: "Direcciones de correo",
    he: "כתובות דוא״ל"
  },
  "staff.emailPlaceholder": {
    en: "one@example.com, two@example.com",
    es: "uno@ejemplo.com, dos@ejemplo.com",
    he: "one@example.com, two@example.com"
  },
  "staff.lastSignIn": {
    en: "Last sign-in",
    es: "Último inicio de sesión",
    he: "כניסה אחרונה"
  },
  "staff.presenceOnline": { en: "Online", es: "En línea", he: "מחובר" },
  "staff.presenceAway": { en: "Away", es: "Ausente", he: "לא פעיל" },
  "staff.presenceOffline": {
    en: "Offline",
    es: "Desconectado",
    he: "לא מחובר"
  },
  "staff.allStatuses": {
    en: "All statuses",
    es: "Todos los estados",
    he: "כל הסטטוסים"
  },
  "staff.holds": { en: "Holds", es: "Tiene", he: "מחזיק" },
  "staff.noRole": { en: "No role", es: "Sin rol", he: "ללא תפקיד" },
  "staff.noRoleYet": {
    en: "No role yet",
    es: "Aún sin rol",
    he: "אין עדיין תפקיד"
  },
  "staff.noRoleNothingPermitted": {
    en: "No role yet, so nothing is permitted.",
    es: "Aún sin rol, así que nada está permitido.",
    he: "אין עדיין תפקיד, ולכן דבר אינו מותר."
  },
  "staff.manageAccess": {
    en: "Manage access",
    es: "Gestionar acceso",
    he: "ניהול הרשאות"
  },
  "staff.closeProfile": {
    en: "Close staff profile",
    es: "Cerrar el perfil del personal",
    he: "סגירת פרופיל הצוות"
  },
  "staff.seeResolution": {
    en: "See exactly what this resolves to",
    es: "Ver exactamente a qué se resuelve",
    he: "ראה בדיוק למה זה מתפרש"
  },

  "staff.accessRestricted": {
    en: "Access restricted",
    es: "Acceso restringido",
    he: "הגישה מוגבלת"
  },
  "staff.accessRestrictedBody": {
    en: "Staff management needs the staff.read permission for the directory, or role.read for roles and permissions.",
    es: "La gestión del personal requiere el permiso staff.read para el directorio, o role.read para roles y permisos.",
    he: "ניהול הצוות דורש הרשאת staff.read לספרייה, או role.read לתפקידים והרשאות."
  },
  "staff.invitationLinksOnce": {
    en: "Some invitations could not be emailed. Send these links yourself - this is the only time they are shown.",
    es: "Algunas invitaciones no se pudieron enviar por correo. Envía estos enlaces tú mismo: es la única vez que se muestran.",
    he: "חלק מההזמנות לא נשלחו בדוא״ל. שלח את הקישורים בעצמך - זו הפעם היחידה שהם מוצגים."
  },
  "staff.invitationLinkFooter": {
    en: "An invitation that could not be emailed shows its link at the top of this page, once. It is the only copy.",
    es: "Una invitación que no se pudo enviar por correo muestra su enlace al principio de esta página, una vez. Es la única copia.",
    he: "הזמנה שלא נשלחה בדוא״ל מציגה את הקישור בראש העמוד, פעם אחת בלבד. זהו העותק היחיד."
  },

  "staff.notProvided": {
    en: "Not provided",
    es: "No proporcionado",
    he: "לא סופק"
  },
  "staff.changeNotSaved": {
    en: "The change could not be saved.",
    es: "No se pudo guardar el cambio.",
    he: "לא ניתן היה לשמור את השינוי."
  },
  "staff.inviteStaff": {
    en: "Invite staff",
    es: "Invitar personal",
    he: "הזמנת צוות"
  },
  "staff.arriveWithNoPermissions": {
    en: "They arrive with no permissions. Give them a role from Access when they are ready.",
    es: "Llegan sin permisos. Asígnales un rol desde Acceso cuando estén listos.",
    he: "הם מגיעים ללא הרשאות. הענק להם תפקיד מתוך ההרשאות כשיהיו מוכנים."
  },
  "staff.profileOnly": {
    en: "Profile only. What this person can do lives in Roles & Permissions.",
    es: "Solo perfil. Lo que esta persona puede hacer está en Roles y permisos.",
    he: "פרופיל בלבד. מה שהאדם הזה רשאי לעשות נמצא בתפקידים והרשאות."
  },
  "staff.sendInvitations": {
    en: "Send invitations",
    es: "Enviar invitaciones",
    he: "שליחת הזמנות"
  },
  "staff.invitationLinkCopied": {
    en: "Invitation link copied.",
    es: "Enlace de invitación copiado.",
    he: "קישור ההזמנה הועתק."
  },
  "staff.copyFailed": {
    en: "Copy failed - select the link and copy it by hand.",
    es: "No se pudo copiar: selecciona el enlace y cópialo a mano.",
    he: "ההעתקה נכשלה - בחר את הקישור והעתק אותו ידנית."
  },
  "staff.invitationsSent": {
    en: "Invitations sent.",
    es: "Invitaciones enviadas.",
    he: "ההזמנות נשלחו."
  },
  "staff.profileSaved": {
    en: "Profile saved.",
    es: "Perfil guardado.",
    he: "הפרופיל נשמר."
  },
  "staff.changeFailed": {
    en: "The change failed.",
    es: "El cambio falló.",
    he: "השינוי נכשל."
  },
  "staff.accessRestored": {
    en: "Access restored.",
    es: "Acceso restaurado.",
    he: "ההרשאה שוחזרה."
  },
  "staff.accessRevoked": {
    en: "Access revoked.",
    es: "Acceso revocado.",
    he: "ההרשאה בוטלה."
  },
  "staff.lastLogin": {
    en: "Last login",
    es: "Último inicio de sesión",
    he: "כניסה אחרונה"
  },

  /*
   * The devices one staff member is signed in on, and the button to end one.
   *
   * The answer to "they left their phone in a taxi but they still work here":
   * deactivating the account locks them out of everything at once and stops
   * them working, which is the wrong tool for a lost device.
   */
  "staff.activeSessions": {
    en: "Active sessions",
    es: "Sesiones activas",
    he: "התחברויות פעילות"
  },
  "staff.activeSessionsHint": {
    en: "Devices {name} is currently signed in on. Ending one does not deactivate the account.",
    es: "Dispositivos en los que {name} tiene la sesión iniciada. Finalizar una no desactiva la cuenta.",
    he: "מכשירים ש-{name} מחובר בהם כעת. ניתוק אחד אינו משבית את החשבון."
  },
  "staff.noActiveSessions": {
    en: "This person is not signed in on any device.",
    es: "Esta persona no tiene la sesión iniciada en ningún dispositivo.",
    he: "האדם הזה אינו מחובר באף מכשיר."
  },
  "staff.sessionsLoadFailed": {
    en: "Their sessions could not be loaded.",
    es: "No se pudieron cargar sus sesiones.",
    he: "לא ניתן היה לטעון את ההתחברויות שלהם."
  },
  "staff.signOutAllDevices": {
    en: "Sign out every device",
    es: "Cerrar sesión en todos los dispositivos",
    he: "ניתוק מכל המכשירים"
  },
  "staff.sessionRevoked": {
    en: "Signed out.",
    es: "Sesión cerrada.",
    he: "נותק."
  },
  "staff.sessionRevokeFailed": {
    en: "That session could not be ended. Try again.",
    es: "No se pudo finalizar esa sesión. Inténtalo de nuevo.",
    he: "לא ניתן היה לסיים את ההתחברות הזו. נסו שוב."
  },

  "access.title": { en: "Access", es: "Acceso", he: "הרשאות" },
  "access.starterCannotDelete": {
    en: "Starter roles cannot be deleted. Edit what this one grants instead.",
    es: "Los roles iniciales no se pueden eliminar. Edita lo que este concede.",
    he: "לא ניתן למחוק תפקידי בסיס. ערוך את מה שהתפקיד מעניק במקום זאת."
  },
  "access.reassignFirst": {
    en: "Reassign the people holding this role first.",
    es: "Primero reasigna a las personas que tienen este rol.",
    he: "תחילה שייך מחדש את מי שמחזיק בתפקיד הזה."
  },
  "access.rolesListLandmark": {
    en: "Roles",
    es: "Roles",
    he: "תפקידים"
  },
  "access.seeingWhoHoldsWhat": {
    en: "Seeing who holds what needs the staff.read permission as well.",
    es: "Ver quién tiene qué también requiere el permiso staff.read.",
    he: "כדי לראות מי מחזיק במה נדרשת גם ההרשאה staff.read."
  },
  "access.somethingWentWrong": {
    en: "Something went wrong. Please try again.",
    es: "Algo salió mal. Inténtalo de nuevo.",
    he: "משהו השתבש. נסה שוב."
  },
  "access.assignmentFailed": {
    en: "Assignment failed.",
    es: "La asignación falló.",
    he: "ההקצאה נכשלה."
  },
  "access.revokeFailed": {
    en: "Revoke failed.",
    es: "La revocación falló.",
    he: "הביטול נכשל."
  },
  "access.loadingRoles": {
    en: "Loading roles...",
    es: "Cargando roles...",
    he: "טוען תפקידים..."
  },
  "access.noRolesAvailable": {
    en: "No roles available",
    es: "No hay roles disponibles",
    he: "אין תפקידים זמינים"
  },
  "access.eventType": {
    en: "Event type",
    es: "Tipo de evento",
    he: "סוג אירוע"
  },
  "access.assigning": {
    en: "Assigning...",
    es: "Asignando...",
    he: "מקצה..."
  },
  "access.updateFailed": {
    en: "Update failed.",
    es: "La actualización falló.",
    he: "העדכון נכשל."
  },
  "access.roleOnly": {
    en: "Role only",
    es: "Solo rol",
    he: "תפקיד בלבד"
  },
  "access.deniedForPerson": {
    en: "Denied for this person. A DENY is final - nothing overrides it, including a role that grants it.",
    es: "Denegado para esta persona. Una denegación es definitiva: nada la anula, ni siquiera un rol que lo conceda.",
    he: "נדחה עבור האדם הזה. סירוב הוא סופי - דבר אינו גובר עליו, גם לא תפקיד שמעניק זאת."
  },
  "access.grantedDirectly": {
    en: "Granted directly to this person, organization-wide.",
    es: "Concedido directamente a esta persona, en toda la organización.",
    he: "הוענק ישירות לאדם הזה, בכל הארגון."
  },
  "access.assignmentExpired": {
    en: "The only assignment that carried this has expired.",
    es: "La única asignación que lo otorgaba ha caducado.",
    he: "ההקצאה היחידה שנשאה זאת פגה."
  },
  "access.notHeld": { en: "Not held.", es: "No se tiene.", he: "לא מוחזק." },
  "access.rankHint": {
    en: "Lower outranks higher. The starter roles sit at 100, 200, 300, 400 and 500, so a new role slots between two of them without renumbering anything.",
    es: "Un número menor manda sobre uno mayor. Los roles iniciales están en 100, 200, 300, 400 y 500, así que un rol nuevo encaja entre dos sin renumerar nada.",
    he: "מספר נמוך גובר על גבוה. תפקידי הבסיס נמצאים ב-100, 200, 300, 400 ו-500, כך שתפקיד חדש נכנס בין שניים מהם בלי למספר מחדש דבר."
  },
  "access.saveFailed": {
    en: "Save failed.",
    es: "No se pudo guardar.",
    he: "השמירה נכשלה."
  },
  "access.clearGroup": {
    en: "Clear group",
    es: "Limpiar grupo",
    he: "ניקוי הקבוצה"
  },
  "access.selectGroup": {
    en: "Select group",
    es: "Seleccionar grupo",
    he: "בחירת הקבוצה"
  },
  "access.saveRole": {
    en: "Save role",
    es: "Guardar rol",
    he: "שמירת התפקיד"
  },
  "access.createRole": {
    en: "Create role",
    es: "Crear rol",
    he: "יצירת תפקיד"
  },

  "access.action.roleCreated": {
    en: "Role created",
    es: "Rol creado",
    he: "תפקיד נוצר"
  },
  "access.action.roleUpdated": {
    en: "Role updated",
    es: "Rol actualizado",
    he: "תפקיד עודכן"
  },
  "access.action.roleDeleted": {
    en: "Role deleted",
    es: "Rol eliminado",
    he: "תפקיד נמחק"
  },
  "access.action.roleAssigned": {
    en: "Role assigned",
    es: "Rol asignado",
    he: "תפקיד הוקצה"
  },
  "access.action.roleRevoked": {
    en: "Role revoked",
    es: "Rol revocado",
    he: "תפקיד בוטל"
  },
  "access.action.permissionsChanged": {
    en: "Individual permissions changed",
    es: "Permisos individuales modificados",
    he: "הרשאות אישיות שונו"
  },
  "access.action.staffInvited": {
    en: "Staff invited",
    es: "Personal invitado",
    he: "צוות הוזמן"
  },
  "access.action.accessRevoked": {
    en: "Access revoked",
    es: "Acceso revocado",
    he: "ההרשאה בוטלה"
  },
  "access.action.passwordReset": {
    en: "Password reset sent",
    es: "Restablecimiento de contraseña enviado",
    he: "נשלח איפוס סיסמה"
  },
  "staff.passwordReset": { en: "Password", es: "Contraseña", he: "סיסמה" },
  "staff.passwordResetHint": {
    en: "Forgot their password? Send {name} a link to choose a new one. You never see or set it.",
    es: "¿Olvidó su contraseña? Envía a {name} un enlace para elegir una nueva. Tú nunca la ves ni la defines.",
    he: "שכח את הסיסמה? שלח ל-{name} קישור לבחירת סיסמה חדשה. אתה לעולם לא רואה או קובע אותה."
  },
  "staff.emailResetLink": {
    en: "Email reset link",
    es: "Enviar enlace por correo",
    he: "שלח קישור בדוא״ל"
  },
  "staff.getResetLink": {
    en: "Get a link to share",
    es: "Obtener enlace para compartir",
    he: "קבל קישור לשיתוף"
  },
  "staff.resetEmailed": {
    en: "Reset link emailed to {email}.",
    es: "Enlace enviado a {email}.",
    he: "קישור האיפוס נשלח אל {email}."
  },
  "staff.resetLinkReady": {
    en: "Share this link with {name}. It replaces any reset link sent before.",
    es: "Comparte este enlace con {name}. Reemplaza cualquier enlace enviado antes.",
    he: "שתף את הקישור עם {name}. הוא מחליף כל קישור איפוס קודם."
  },
  "staff.resetEmailFailedLink": {
    en: "The email could not be sent, so here is a link to share instead.",
    es: "No se pudo enviar el correo; aquí tienes un enlace para compartir.",
    he: "לא ניתן היה לשלוח דוא״ל, הנה קישור לשיתוף במקום."
  },
  "staff.resetFailed": {
    en: "Could not create a password reset.",
    es: "No se pudo crear el restablecimiento.",
    he: "לא ניתן היה ליצור איפוס סיסמה."
  },
  "staff.linkCopied": { en: "Copied", es: "Copiado", he: "הועתק" },
  "access.action.accessRestored": {
    en: "Access restored",
    es: "Acceso restaurado",
    he: "ההרשאה שוחזרה"
  },
  "access.restricted": {
    en: "Access restricted",
    es: "Acceso restringido",
    he: "הגישה מוגבלת"
  },
  "access.restrictedBody": {
    en: "Reading roles needs the role.read permission. Ask whoever manages access in your organization.",
    es: "Leer los roles requiere el permiso role.read. Pregunta a quien gestiona el acceso en tu organización.",
    he: "קריאת תפקידים דורשת את ההרשאה role.read. פנה למי שמנהל את ההרשאות בארגון."
  },
  "access.ceilingNote": {
    en: "A role can never hand out more than you hold yourself, and never at or above your own rank. Both refusals name what stopped them.",
    es: "Un rol nunca puede otorgar más de lo que tú tienes, ni a tu rango o por encima. Ambas negativas indican qué las bloqueó.",
    he: "תפקיד לעולם לא יכול להעניק יותר ממה שיש לך, ולעולם לא בדרגה שלך או מעליה. שני הסירובים מציינים מה עצר אותם."
  },
  "access.nothingYetPerson": {
    en: "Nothing yet. This person can sign in and see nothing until they are given a role - which is the correct default, not a bug.",
    es: "Nada todavía. Esta persona puede iniciar sesión y no ver nada hasta que se le asigne un rol, que es el valor correcto por defecto, no un fallo.",
    he: "עדיין כלום. האדם הזה יכול להיכנס ולא לראות דבר עד שיקבל תפקיד - וזו ברירת המחדל הנכונה, לא תקלה."
  },
  "access.assignmentsAddUp": {
    en: "Assignments add up. Two hall-scoped rows mean both halls; one organization-wide row means everywhere. They never narrow each other.",
    es: "Las asignaciones se suman. Dos filas de ámbito de salón significan ambos salones; una fila de toda la organización significa en todas partes. Nunca se restringen entre sí.",
    he: "ההקצאות מצטברות. שתי שורות ברמת אולם משמען שני האולמות; שורה ברמת הארגון משמעה בכל מקום. הן לעולם אינן מצמצמות זו את זו."
  },
  "access.auditEmpty": {
    en: "Nothing yet. Every role edit, assignment and override from here on lands in this list.",
    es: "Nada todavía. Cada edición de rol, asignación y excepción a partir de ahora aparecerá en esta lista.",
    he: "עדיין כלום. כל עריכת תפקיד, הקצאה ועקיפה מכאן ואילך יופיעו ברשימה הזו."
  },
  "access.blurb": {
    en: "Roles, assignments, and who can do what",
    es: "Roles, asignaciones y quién puede hacer qué",
    he: "תפקידים, הקצאות, ומי רשאי לעשות מה"
  },
  "access.roles": { en: "Roles", es: "Roles", he: "תפקידים" },
  "access.people": { en: "People", es: "Personas", he: "אנשים" },
  "access.newRole": {
    en: "New role",
    es: "Nuevo rol",
    he: "תפקיד חדש"
  },
  "access.nobodyYet": {
    en: "Nobody to show yet.",
    es: "Aún no hay nadie que mostrar.",
    he: "אין עדיין את מי להציג."
  },
  "access.pickSomebody": {
    en: "Pick somebody to see exactly what they can do, and why.",
    es: "Elige a alguien para ver exactamente qué puede hacer y por qué.",
    he: "בחר מישהו כדי לראות בדיוק מה הוא רשאי לעשות, ולמה."
  },
  "access.permissionSummary": {
    en: "Permission summary",
    es: "Resumen de permisos",
    he: "סיכום הרשאות"
  },
  "access.starter": {
    en: "Starter",
    es: "Inicial",
    he: "בסיסי"
  },
  "access.rank": { en: "Rank", es: "Rango", he: "דירוג" },
  "access.sensitive": {
    en: "Sensitive",
    es: "Sensible",
    he: "רגיש"
  },
  "access.filterPermissions": {
    en: "Filter permissions",
    es: "Filtrar permisos",
    he: "סינון הרשאות"
  },
  "access.readOnlyRoles": {
    en: "You can read roles but not author them. That needs",
    es: "Puedes leer los roles pero no crearlos. Eso requiere",
    he: "אפשר לקרוא תפקידים אך לא ליצור אותם. לשם כך נדרש"
  },
  "access.addRole": {
    en: "Add a role",
    es: "Agregar un rol",
    he: "הוספת תפקיד"
  },
  "access.role": { en: "Role", es: "Rol", he: "תפקיד" },
  "access.scope": { en: "Scope", es: "Alcance", he: "היקף" },
  "access.until": { en: "Until", es: "Hasta", he: "עד" },
  "access.by": { en: "by", es: "por", he: "על ידי" },
  "access.chooseOne": {
    en: "Choose one",
    es: "Elige uno",
    he: "בחר אחד"
  },
  // `describeScope` renders an assignment's reach. The label after the colon is
  // the hall or event-type name, which is tenant data and stays as stored.
  "access.scopeHall": {
    en: "Hall: {name}",
    es: "Salón: {name}",
    he: "אולם: {name}"
  },
  "access.scopeEventType": {
    en: "Type: {name}",
    es: "Tipo: {name}",
    he: "סוג: {name}"
  },
  "access.scopeDeleted": {
    en: "(deleted)",
    es: "(eliminado)",
    he: "(נמחק)"
  },
  "access.wholeOrganization": {
    en: "Whole organization",
    es: "Toda la organización",
    he: "כל הארגון"
  },
  "access.oneHall": {
    en: "One hall",
    es: "Un salón",
    he: "אולם אחד"
  },
  "access.oneEventType": {
    en: "One event type",
    es: "Un tipo de evento",
    he: "סוג אירוע אחד"
  },
  "access.holdsNow": {
    en: "Holds now",
    es: "Tiene ahora",
    he: "מחזיק כעת"
  },
  "access.expiresOptional": {
    en: "Expires (optional)",
    es: "Caduca (opcional)",
    he: "פג תוקף (אופציונלי)"
  },
  "access.revoke": { en: "Revoke", es: "Revocar", he: "ביטול" },
  "access.onlyWhatMatters": {
    en: "Only what matters",
    es: "Solo lo que importa",
    he: "רק מה שחשוב"
  },
  "access.resolving": {
    en: "Resolving...",
    es: "Resolviendo...",
    he: "מחשב..."
  },
  "access.allChanges": {
    en: "All changes",
    es: "Todos los cambios",
    he: "כל השינויים"
  },
  "access.privilegeChanges": {
    en: "Privilege changes",
    es: "Cambios de privilegios",
    he: "שינויי הרשאות"
  },
  "access.auditBlurb": {
    en: "Every change, its author, and what it did. Append-only.",
    es: "Cada cambio, su autor y lo que hizo. Solo se agrega.",
    he: "כל שינוי, מי ביצע אותו ומה הוא עשה. רק הוספה."
  },
  "access.auditNeeds": {
    en: "Reading the audit trail needs",
    es: "Leer el registro de auditoría requiere",
    he: "קריאת יומן הביקורת דורשת"
  }
});
