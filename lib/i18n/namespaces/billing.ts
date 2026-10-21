import { defineMessages } from "@/lib/i18n/types";

/** Billing module: dashboard, transactions, invoices, event billing, reports and settings. */
export const billingMessages = defineMessages({
  "billing.title": { en: "Billing", es: "Facturación", he: "חיוב" },

  // The tab strip. `BillingTab` is the English name, because the page switches
  // on it; these are what the strip draws.
  "billing.tab.dashboard": {
    en: "Dashboard",
    es: "Panel",
    he: "לוח בקרה"
  },
  "billing.tab.transactions": {
    en: "Transactions",
    es: "Transacciones",
    he: "תנועות"
  },
  "billing.tab.invoices": {
    en: "Invoices",
    es: "Facturas",
    he: "חשבוניות"
  },
  "billing.tab.eventBilling": {
    en: "Event Billing",
    es: "Facturación de eventos",
    he: "חיוב אירועים"
  },
  "billing.tab.reports": {
    en: "Reports",
    es: "Informes",
    he: "דוחות"
  },
  "billing.tab.settings": {
    en: "Settings",
    es: "Configuración",
    he: "הגדרות"
  },
  "billing.blurb": {
    en: "Transactions, invoices, event billing, payments, and financial dashboard.",
    es: "Transacciones, facturas, facturación de eventos, pagos y panel financiero.",
    he: "תנועות, חשבוניות, חיוב אירועים, תשלומים ולוח פיננסי."
  },
  "billing.importBankFile": {
    en: "Import bank file",
    es: "Importar archivo bancario",
    he: "ייבוא קובץ בנק"
  },
  "billing.newInvoice": {
    en: "New invoice",
    es: "Nueva factura",
    he: "חשבונית חדשה"
  },
  "billing.reviewRecentTransaction": {
    en: "Review recent transaction",
    es: "Revisar transacción reciente",
    he: "בדיקת תנועה אחרונה"
  },

  "billing.dashboard": {
    en: "Billing dashboard",
    es: "Panel de facturación",
    he: "לוח החיוב"
  },
  "billing.dashboardBlurb": {
    en: "Daily office view for the finance team.",
    es: "Vista diaria de oficina para el equipo de finanzas.",
    he: "תצוגה משרדית יומית לצוות הכספים."
  },
  "billing.paidIncome": {
    en: "Paid Income",
    es: "Ingresos cobrados",
    he: "הכנסות ששולמו"
  },
  "billing.openInvoices": {
    en: "Open Invoices",
    es: "Facturas abiertas",
    he: "חשבוניות פתוחות"
  },
  "billing.needsReview": {
    en: "Needs Review",
    es: "Requiere revisión",
    he: "דורש בדיקה"
  },
  "billing.cashMovement": {
    en: "Cash movement",
    es: "Movimiento de caja",
    he: "תנועת מזומנים"
  },
  "billing.sampleWeekly": {
    en: "Sample weekly activity.",
    es: "Actividad semanal de muestra.",
    he: "פעילות שבועית לדוגמה."
  },
  "billing.recentBankTransactions": {
    en: "Recent bank transactions",
    es: "Transacciones bancarias recientes",
    he: "תנועות בנק אחרונות"
  },
  "billing.importedFrom": {
    en: "Imported from connected bank or file upload.",
    es: "Importado del banco conectado o de un archivo cargado.",
    he: "יובא מהבנק המחובר או מקובץ שהועלה."
  },
  "billing.reviewTransactions": {
    en: "Review transactions",
    es: "Revisar transacciones",
    he: "בדיקת תנועות"
  },
  "billing.openBalances": {
    en: "Open balances",
    es: "Saldos abiertos",
    he: "יתרות פתוחות"
  },
  "billing.invoicesNeedPayment": {
    en: "Invoices that still need payment.",
    es: "Facturas que aún necesitan pago.",
    he: "חשבוניות שעדיין ממתינות לתשלום."
  },
  "billing.openEventBilling": {
    en: "Open event billing",
    es: "Abrir la facturación de eventos",
    he: "פתיחת חיוב האירוע"
  },

  "billing.transactions": {
    en: "Transactions",
    es: "Transacciones",
    he: "תנועות"
  },
  "billing.transactionCenter": {
    en: "Transaction Center",
    es: "Centro de transacciones",
    he: "מרכז התנועות"
  },
  "billing.eventCoreTransactions": {
    en: "Event Core Transactions",
    es: "Transacciones de Event Core",
    he: "תנועות Event Core"
  },
  "billing.transactionsBlurb": {
    en: "Review, match, update, and track event-related payments.",
    es: "Revisa, concilia, actualiza y sigue los pagos de los eventos.",
    he: "בדיקה, התאמה, עדכון ומעקב אחר תשלומי אירועים."
  },
  "billing.noTransactions": {
    en: "No transactions found",
    es: "No se encontraron transacciones",
    he: "לא נמצאו תנועות"
  },
  "billing.customer": { en: "Customer", es: "Cliente", he: "לקוח" },

  "billing.paidTransactions": {
    en: "Paid transactions",
    es: "Transacciones pagadas",
    he: "תנועות ששולמו"
  },
  "billing.importedOrRecorded": {
    en: "Imported or recorded",
    es: "Importadas o registradas",
    he: "יובאו או נרשמו"
  },
  "billing.allInvoiceRecords": {
    en: "All invoice records",
    es: "Todos los registros de facturas",
    he: "כל רשומות החשבוניות"
  },
  "billing.pendingTransactions": {
    en: "Pending transactions",
    es: "Transacciones pendientes",
    he: "תנועות ממתינות"
  },
  "billing.nextAction": {
    en: "Next action",
    es: "Próxima acción",
    he: "הפעולה הבאה"
  },
  "billing.invoiceAction": {
    en: "Invoice action",
    es: "Acción de factura",
    he: "פעולת חשבונית"
  },
  "billing.profitCheck": {
    en: "Profit check",
    es: "Comprobación de beneficio",
    he: "בדיקת רווח"
  },
  "billing.assignCardBatch": {
    en: "Assign card batch payout to the correct events or split it across events.",
    es: "Asigna el pago por lotes de tarjeta a los eventos correctos o divídelo entre varios.",
    he: "שייך את תשלום אצוות הכרטיסים לאירועים הנכונים או פצל אותו בין אירועים."
  },
  "billing.reviewPayroll": {
    en: "Review payroll and linen transactions before closing the week.",
    es: "Revisa las transacciones de nómina y mantelería antes de cerrar la semana.",
    he: "בדוק תנועות שכר ומצעים לפני סגירת השבוע."
  },
  "billing.oneInvoiceOpen": {
    en: "1 invoice has an open balance.",
    es: "1 factura tiene saldo pendiente.",
    he: "לחשבונית אחת יש יתרה פתוחה."
  },
  "billing.invoicesOpen": {
    en: "{count} invoices have an open balance.",
    es: "{count} facturas tienen saldo pendiente.",
    he: "ל-{count} חשבוניות יש יתרה פתוחה."
  },
  "billing.netRevenue": {
    en: "Net revenue",
    es: "Ingresos netos",
    he: "הכנסה נטו"
  },

  "billing.csvColumnsRequired": {
    en: "The CSV must contain date, description, amount, and optional currency columns.",
    es: "El CSV debe contener columnas de fecha, descripción, importe y, opcionalmente, moneda.",
    he: "קובץ ה-CSV חייב לכלול עמודות תאריך, תיאור, סכום ומטבע (אופציונלי)."
  },
  "billing.imported": {
    en: "{count} bank transactions imported.",
    es: "{count} transacciones bancarias importadas.",
    he: "יובאו {count} תנועות בנק."
  },
  "billing.importedWithSkippedOne": {
    en: "{count} bank transactions imported. 1 row was skipped because the date, description, or amount could not be read.",
    es: "{count} transacciones bancarias importadas. Se omitió 1 fila porque no se pudo leer la fecha, la descripción o el importe.",
    he: "יובאו {count} תנועות בנק. שורה אחת דולגה כי לא ניתן היה לקרוא את התאריך, התיאור או הסכום."
  },
  "billing.importedWithSkipped": {
    en: "{count} bank transactions imported. {skipped} rows were skipped because the date, description, or amount could not be read.",
    es: "{count} transacciones bancarias importadas. Se omitieron {skipped} filas porque no se pudo leer la fecha, la descripción o el importe.",
    he: "יובאו {count} תנועות בנק. {skipped} שורות דולגו כי לא ניתן היה לקרוא את התאריך, התיאור או הסכום."
  },
  "billing.importFailed": {
    en: "Unable to import bank file.",
    es: "No se pudo importar el archivo bancario.",
    he: "לא ניתן לייבא את קובץ הבנק."
  },
  "billing.enterInvoiceAmount": {
    en: "Enter an invoice amount.",
    es: "Introduce un importe de factura.",
    he: "הזן סכום חשבונית."
  },
  "billing.noViewPermission": {
    en: "You do not have permission to view billing. Contact an administrator if you need access.",
    es: "No tienes permiso para ver la facturación. Contacta a un administrador si necesitas acceso.",
    he: "אין לך הרשאה לצפות בחיוב. פנה למנהל אם נדרשת לך גישה."
  },

  "billing.invoiceFooterDefault": {
    en: "Thank you. Please submit payment according to the agreed terms.",
    es: "Gracias. Envía el pago según los términos acordados.",
    he: "תודה. נא לשלם בהתאם לתנאים שסוכמו."
  },
  "billing.settingsSaveFailed": {
    en: "Unable to save billing settings.",
    es: "No se pudo guardar la configuración de facturación.",
    he: "לא ניתן לשמור את הגדרות החיוב."
  },
  "billing.settingsSaved": {
    en: "Billing settings saved.",
    es: "Configuración de facturación guardada.",
    he: "הגדרות החיוב נשמרו."
  },
  "billing.saveSettings": {
    en: "Save settings",
    es: "Guardar configuración",
    he: "שמירת ההגדרות"
  },
  "billing.catEventDeposit": {
    en: "Event Deposit",
    es: "Depósito del evento",
    he: "מקדמה לאירוע"
  },
  "billing.catFinalPayment": {
    en: "Final Payment",
    es: "Pago final",
    he: "תשלום סופי"
  },
  "billing.catVendorCost": {
    en: "Vendor Cost",
    es: "Coste de proveedor",
    he: "עלות ספק"
  },
  "billing.catFoodPurchase": {
    en: "Food Purchase",
    es: "Compra de alimentos",
    he: "רכישת מזון"
  },
  "billing.catStaffPayroll": {
    en: "Staff Payroll",
    es: "Nómina del personal",
    he: "שכר הצוות"
  },
  "billing.catLinenRental": {
    en: "Linen Rental",
    es: "Alquiler de mantelería",
    he: "השכרת מצעים"
  },
  "billing.catEquipmentRental": {
    en: "Equipment Rental",
    es: "Alquiler de equipo",
    he: "השכרת ציוד"
  },
  "billing.catOfficeExpense": {
    en: "Office Expense",
    es: "Gasto de oficina",
    he: "הוצאת משרד"
  },
  "billing.expenseGeneral": {
    en: "Expense / General",
    es: "Gasto / General",
    he: "הוצאה / כללי"
  },
  "billing.supplies": {
    en: "Supplies & materials - COGS",
    es: "Suministros y materiales - COGS",
    he: "אספקה וחומרים - עלות המכר"
  },
  "billing.selectCustomerProject": {
    en: "Select a customer or project",
    es: "Selecciona un cliente o proyecto",
    he: "בחר לקוח או פרויקט"
  },

  "billing.noMatchingEvents": {
    en: "No matching events",
    es: "No hay eventos coincidentes",
    he: "אין אירועים תואמים"
  },
  "billing.noEventsYet": {
    en: "No events yet",
    es: "Aún no hay eventos",
    he: "אין עדיין אירועים"
  },
  "billing.noHall": { en: "No hall", es: "Sin salón", he: "ללא אולם" },
  "billing.noBalance": {
    en: "No balance",
    es: "Sin saldo",
    he: "אין יתרה"
  },
  "billing.invoiceRecords": {
    en: "{count} invoice records",
    es: "{count} registros de facturas",
    he: "{count} רשומות חשבונית"
  },
  "billing.recordedPayments": {
    en: "Recorded payments",
    es: "Pagos registrados",
    he: "תשלומים שנרשמו"
  },
  "billing.amountOutstanding": {
    en: "Amount outstanding",
    es: "Importe pendiente",
    he: "סכום פתוח"
  },
  "billing.updateInvoiceFailed": {
    en: "Unable to update invoice.",
    es: "No se pudo actualizar la factura.",
    he: "לא ניתן לעדכן את החשבונית."
  },
  "billing.stripeStartFailed": {
    en: "Unable to start Stripe Checkout.",
    es: "No se pudo iniciar Stripe Checkout.",
    he: "לא ניתן להתחיל את התשלום ב-Stripe."
  },
  "billing.stripeNoUrl": {
    en: "Stripe did not return a checkout URL.",
    es: "Stripe no devolvió una URL de pago.",
    he: "Stripe לא החזירה כתובת לתשלום."
  },
  "billing.enterClientName": {
    en: "Enter a client name.",
    es: "Introduce un nombre de cliente.",
    he: "הזן שם לקוח."
  },
  "billing.addLineItem": {
    en: "Add at least one line item.",
    es: "Agrega al menos un concepto.",
    he: "הוסף לפחות שורה אחת."
  },
  "billing.completeLineItems": {
    en: "Complete every line item with a valid description, quantity, and amount.",
    es: "Completa cada concepto con descripción, cantidad e importe válidos.",
    he: "מלא בכל שורה תיאור, כמות וסכום תקינים."
  },
  "billing.lineDescription": {
    en: "Line {number} description",
    es: "Descripción del concepto {number}",
    he: "תיאור שורה {number}"
  },
  "billing.lineQuantity": {
    en: "Line {number} quantity",
    es: "Cantidad del concepto {number}",
    he: "כמות שורה {number}"
  },
  "billing.lineAmount": {
    en: "Line {number} amount",
    es: "Importe del concepto {number}",
    he: "סכום שורה {number}"
  },
  "billing.removeLine": {
    en: "Remove line {number}",
    es: "Quitar el concepto {number}",
    he: "הסרת שורה {number}"
  },
  "billing.saveInvoice": {
    en: "Save invoice",
    es: "Guardar factura",
    he: "שמירת החשבונית"
  },
  "billing.noMatchingInvoices": {
    en: "No matching invoices",
    es: "No hay facturas coincidentes",
    he: "אין חשבוניות תואמות"
  },
  "billing.noInvoicesYet": {
    en: "No invoices yet",
    es: "Aún no hay facturas",
    he: "אין עדיין חשבוניות"
  },
  "billing.tryAnotherSearch": {
    en: "Try another search or status.",
    es: "Prueba otra búsqueda o estado.",
    he: "נסה חיפוש או סטטוס אחר."
  },
  "billing.createFirstInvoice": {
    en: "Create the first invoice from an event.",
    es: "Crea la primera factura a partir de un evento.",
    he: "צור את החשבונית הראשונה מאירוע."
  },

  "billing.uncategorized": {
    en: "Uncategorized",
    es: "Sin categoría",
    he: "ללא קטגוריה"
  },
  "billing.oneSplitLine": {
    en: "1 split line",
    es: "1 línea dividida",
    he: "שורת פיצול אחת"
  },
  "billing.unassigned": {
    en: "Unassigned",
    es: "Sin asignar",
    he: "לא משויך"
  },
  "billing.invoiceLabel": {
    en: "Invoice",
    es: "Factura",
    he: "חשבונית"
  },
  "billing.noInvoiceSelected": {
    en: "No invoice selected",
    es: "Ninguna factura seleccionada",
    he: "לא נבחרה חשבונית"
  },
  "billing.noFileAttached": {
    en: "No file attached",
    es: "Ningún archivo adjunto",
    he: "לא צורף קובץ"
  },
  "billing.assignBeforeMatching": {
    en: "Assign this transaction to an event before matching it.",
    es: "Asigna esta transacción a un evento antes de conciliarla.",
    he: "שייך את התנועה לאירוע לפני ההתאמה."
  },
  "billing.postFailed": {
    en: "Unable to post transaction.",
    es: "No se pudo registrar la transacción.",
    he: "לא ניתן לרשום את התנועה."
  },
  "billing.unassignedTransaction": {
    en: "Unassigned transaction",
    es: "Transacción sin asignar",
    he: "תנועה לא משויכת"
  },
  "billing.bankFeed": {
    en: "Bank feed",
    es: "Flujo bancario",
    he: "הזנת בנק"
  },
  "billing.notSplit": {
    en: "Not split",
    es: "Sin dividir",
    he: "לא מפוצל"
  },
  "billing.removeSplit": {
    en: "Remove split",
    es: "Quitar división",
    he: "הסרת הפיצול"
  },
  "billing.posting": {
    en: "Posting…",
    es: "Registrando…",
    he: "רושם…"
  },
  "billing.postTransaction": {
    en: "Post transaction",
    es: "Registrar transacción",
    he: "רישום התנועה"
  },
  "billing.enterPaymentAmount": {
    en: "Enter a payment amount.",
    es: "Introduce un importe de pago.",
    he: "הזן סכום תשלום."
  },
  "billing.enterAmountBetween": {
    en: "Enter an amount between {min} and {max}.",
    es: "Introduce un importe entre {min} y {max}.",
    he: "הזן סכום בין {min} ל-{max}."
  },
  "billing.recordPaymentFailed": {
    en: "Unable to record payment.",
    es: "No se pudo registrar el pago.",
    he: "לא ניתן לרשום את התשלום."
  },

  "billing.bankConnectFailed": {
    en: "Unable to start bank connection.",
    es: "No se pudo iniciar la conexión bancaria.",
    he: "לא ניתן להתחיל את חיבור הבנק."
  },
  "billing.plaidNoToken": {
    en: "Plaid link token was not returned.",
    es: "Plaid no devolvió un token de enlace.",
    he: "Plaid לא החזירה אסימון קישור."
  },
  "billing.plaidInitFailed": {
    en: "Plaid Link could not be initialized.",
    es: "No se pudo inicializar Plaid Link.",
    he: "לא ניתן היה לאתחל את Plaid Link."
  },
  "billing.plaidUnavailable": {
    en: "Plaid is not available in this browser session.",
    es: "Plaid no está disponible en esta sesión del navegador.",
    he: "Plaid אינה זמינה בהפעלת הדפדפן הזו."
  },
  "billing.bankSaveFailed": {
    en: "Unable to save the bank connection.",
    es: "No se pudo guardar la conexión bancaria.",
    he: "לא ניתן לשמור את חיבור הבנק."
  },
  "billing.bankConnected": {
    en: "Bank account connected for this organization.",
    es: "Cuenta bancaria conectada para esta organización.",
    he: "חשבון הבנק חובר לארגון הזה."
  },
  "billing.connectionIncomplete": {
    en: "Could not complete the connection.",
    es: "No se pudo completar la conexión.",
    he: "לא ניתן היה להשלים את החיבור."
  },
  "billing.connectionStartFailed": {
    en: "Could not start the connection flow.",
    es: "No se pudo iniciar el flujo de conexión.",
    he: "לא ניתן היה להתחיל את תהליך החיבור."
  },
  "billing.bookingId": {
    en: "Booking ID",
    es: "ID de reserva",
    he: "מזהה הזמנה"
  },
  "billing.transactionsExported": {
    en: "Transactions exported.",
    es: "Transacciones exportadas.",
    he: "התנועות יוצאו."
  },
  "billing.printViewOpened": {
    en: "Print view opened.",
    es: "Vista de impresión abierta.",
    he: "תצוגת ההדפסה נפתחה."
  },
  "billing.updateTransactionFailed": {
    en: "Unable to update transaction.",
    es: "No se pudo actualizar la transacción.",
    he: "לא ניתן לעדכן את התנועה."
  },
  "billing.transactionCancelled": {
    en: "Transaction cancelled.",
    es: "Transacción anulada.",
    he: "התנועה בוטלה."
  },
  "billing.transactionPosted": {
    en: "Transaction posted and marked as paid.",
    es: "Transacción registrada y marcada como pagada.",
    he: "התנועה נרשמה וסומנה כשולמה."
  },
  "billing.previewDisconnected": {
    en: "Bank connection preview disconnected.",
    es: "Vista previa de la conexión bancaria desconectada.",
    he: "תצוגת חיבור הבנק נותקה."
  },
  "billing.syncFailed": {
    en: "Unable to sync transactions.",
    es: "No se pudieron sincronizar las transacciones.",
    he: "לא ניתן לסנכרן את התנועות."
  },
  "billing.syncStarted": {
    en: "Bank transactions sync started for this organization.",
    es: "Se inició la sincronización de transacciones bancarias para esta organización.",
    he: "סנכרון תנועות הבנק החל עבור הארגון הזה."
  },
  "billing.allStatuses": {
    en: "All statuses",
    es: "Todos los estados",
    he: "כל הסטטוסים"
  },
  "billing.allTypes": {
    en: "All types",
    es: "Todos los tipos",
    he: "כל הסוגים"
  },
  "billing.selectedMarkedPaid": {
    en: "Selected transactions marked as paid.",
    es: "Transacciones seleccionadas marcadas como pagadas.",
    he: "התנועות שנבחרו סומנו כשולמו."
  },
  "billing.selectedMatched": {
    en: "Selected transactions matched.",
    es: "Transacciones seleccionadas conciliadas.",
    he: "התנועות שנבחרו הותאמו."
  },
  "billing.selectedCancelled": {
    en: "Selected transactions cancelled.",
    es: "Transacciones seleccionadas anuladas.",
    he: "התנועות שנבחרו בוטלו."
  },
  "billing.actionsForTransaction": {
    en: "Actions for transaction {id}",
    es: "Acciones para la transacción {id}",
    he: "פעולות עבור תנועה {id}"
  },

  "billing.eventPackage": {
    en: "Event package",
    es: "Paquete del evento",
    he: "חבילת האירוע"
  },
  "billing.createEventFirst": {
    en: "Create an event before creating an invoice.",
    es: "Crea un evento antes de crear una factura.",
    he: "צור אירוע לפני יצירת חשבונית."
  },
  "billing.amountGreaterThanZero": {
    en: "Enter an amount greater than zero.",
    es: "Introduce un importe mayor que cero.",
    he: "הזן סכום גדול מאפס."
  },
  "billing.createInvoiceFailed": {
    en: "Unable to create invoice.",
    es: "No se pudo crear la factura.",
    he: "לא ניתן ליצור את החשבונית."
  },
  "billing.creating": {
    en: "Creating…",
    es: "Creando…",
    he: "יוצר…"
  },

  "billing.businessCheckingConnected": {
    en: "Business checking connected",
    es: "Cuenta corriente de empresa conectada",
    he: "חשבון עסקי מחובר"
  },
  "billing.connectABank": {
    en: "Connect a bank account",
    es: "Conectar una cuenta bancaria",
    he: "חיבור חשבון בנק"
  },
  "billing.demoBankReady": {
    en: "Event Core demo bank •••• 1909 is ready to import and review transactions.",
    es: "El banco de demostración de Event Core •••• 1909 está listo para importar y revisar transacciones.",
    he: "בנק ההדגמה של Event Core •••• 1909 מוכן לייבוא ובדיקה של תנועות."
  },
  "billing.usePlaidHint": {
    en: "Use Plaid to securely import bank transactions into this billing workspace.",
    es: "Usa Plaid para importar de forma segura las transacciones bancarias a este espacio de facturación.",
    he: "השתמש ב-Plaid כדי לייבא תנועות בנק באופן מאובטח לסביבת החיוב הזו."
  },
  "billing.plaidStep1": {
    en: "The user chooses their bank and signs in through Plaid, not inside Event Core.",
    es: "El usuario elige su banco e inicia sesión a través de Plaid, no dentro de Event Core.",
    he: "המשתמש בוחר את הבנק ונכנס דרך Plaid, לא בתוך Event Core."
  },
  "billing.plaidStep2": {
    en: "Select the checking account to sync with the Billing transaction center.",
    es: "Selecciona la cuenta corriente que sincronizar con el centro de transacciones.",
    he: "בחר את חשבון העו״ש לסנכרון עם מרכז התנועות."
  },
  "billing.plaidStep3": {
    en: "Imported transactions appear here for matching, posting, and reporting.",
    es: "Las transacciones importadas aparecen aquí para conciliar, registrar e informar.",
    he: "תנועות שיובאו מופיעות כאן להתאמה, רישום ודיווח."
  },
  "billing.connecting": {
    en: "Connecting…",
    es: "Conectando…",
    he: "מתחבר…"
  },
  "billing.reconnectBank": {
    en: "Reconnect bank",
    es: "Reconectar banco",
    he: "חיבור מחדש לבנק"
  },
  "billing.continueToPlaid": {
    en: "Continue to Plaid",
    es: "Continuar a Plaid",
    he: "המשך ל-Plaid"
  },

  // `type` on a transaction row is the value the type filter compares against,
  // so it stays English; this is the wording shown for the same thing.
  "billing.refundLabel": {
    en: "Refund",
    es: "Reembolso",
    he: "החזר"
  },
  "billing.unassignedCustomer": {
    en: "Unassigned customer",
    es: "Cliente sin asignar",
    he: "לקוח לא משויך"
  },
  "billing.unassignedEvent": {
    en: "Unassigned event",
    es: "Evento sin asignar",
    he: "אירוע לא משויך"
  },
  "billing.eventPayment": {
    en: "Event payment",
    es: "Pago del evento",
    he: "תשלום אירוע"
  },
  "billing.notLinked": {
    en: "Not linked",
    es: "No vinculado",
    he: "לא מקושר"
  },
  "billing.noTransactionNote": {
    en: "No transaction note.",
    es: "Sin nota de transacción.",
    he: "אין הערת תנועה."
  },
  "billing.recordedWithStatus": {
    en: "Transaction recorded with status {status}.",
    es: "Transacción registrada con estado {status}.",
    he: "התנועה נרשמה עם סטטוס {status}."
  },
  "billing.transactionRecorded": {
    en: "Transaction recorded",
    es: "Transacción registrada",
    he: "התנועה נרשמה"
  },
  "billing.transactionId": {
    en: "Transaction ID",
    es: "ID de transacción",
    he: "מזהה תנועה"
  },
  "billing.idShort": { en: "ID", es: "ID", he: "מזהה" },
  "billing.paymentMethodColumn": {
    en: "Payment Method",
    es: "Método de pago",
    he: "אמצעי תשלום"
  },
  "billing.noTransactionsBody": {
    en: "Adjust your filters or create a new transaction to begin tracking payments.",
    es: "Ajusta los filtros o crea una nueva transacción para empezar a seguir los pagos.",
    he: "שנה את המסננים או צור תנועה חדשה כדי להתחיל לעקוב אחר תשלומים."
  },
  "billing.allowPopups": {
    en: "Allow popups to print transactions.",
    es: "Permite las ventanas emergentes para imprimir transacciones.",
    he: "אפשר חלונות קופצים כדי להדפיס תנועות."
  },
  "billing.venue": { en: "Venue", es: "Local", he: "מקום" },
  "billing.match": { en: "Match", es: "Conciliar", he: "התאמה" },
  "billing.markAsPaid": {
    en: "Mark as Paid",
    es: "Marcar como pagada",
    he: "סימון כשולם"
  },
  "billing.selectAllVisible": {
    en: "Select all visible transactions",
    es: "Seleccionar todas las transacciones visibles",
    he: "בחירת כל התנועות הגלויות"
  },
  "billing.sortTransactions": {
    en: "Sort transactions",
    es: "Ordenar transacciones",
    he: "מיון תנועות"
  },
  "billing.sortMobile": {
    en: "Sort mobile transactions",
    es: "Ordenar transacciones en móvil",
    he: "מיון תנועות בנייד"
  },
  "billing.filterMobile": {
    en: "Filter mobile transactions",
    es: "Filtrar transacciones en móvil",
    he: "סינון תנועות בנייד"
  },
  "billing.statusFilter": {
    en: "Status filter",
    es: "Filtro de estado",
    he: "מסנן סטטוס"
  },
  "billing.typeFilter": {
    en: "Transaction type filter",
    es: "Filtro de tipo de transacción",
    he: "מסנן סוג תנועה"
  },
  "billing.filterAll": {
    en: "Filter: All",
    es: "Filtro: todos",
    he: "מסנן: הכול"
  },
  "billing.filterByAll": {
    en: "Filter by: All",
    es: "Filtrar por: todos",
    he: "סינון לפי: הכול"
  },
  "billing.statusAll": {
    en: "Status: All",
    es: "Estado: todos",
    he: "סטטוס: הכול"
  },
  "billing.sortByDate": {
    en: "Sort by: Date",
    es: "Ordenar por: fecha",
    he: "מיון לפי: תאריך"
  },
  "billing.sortByAmount": {
    en: "Sort by: Amount",
    es: "Ordenar por: importe",
    he: "מיון לפי: סכום"
  },
  "billing.sortByCustomer": {
    en: "Sort by: Customer",
    es: "Ordenar por: cliente",
    he: "מיון לפי: לקוח"
  },
  "billing.sortByStatus": {
    en: "Sort by: Status",
    es: "Ordenar por: estado",
    he: "מיון לפי: סטטוס"
  },
  "billing.sortNewest": {
    en: "Sort: Newest",
    es: "Orden: más recientes",
    he: "מיון: החדשים ביותר"
  },
  "billing.sortOldest": {
    en: "Sort: Oldest",
    es: "Orden: más antiguos",
    he: "מיון: הישנים ביותר"
  },
  "billing.sortAmountHigh": {
    en: "Sort: Amount high",
    es: "Orden: importe mayor",
    he: "מיון: סכום גבוה"
  },
  "billing.sortAmountLow": {
    en: "Sort: Amount low",
    es: "Orden: importe menor",
    he: "מיון: סכום נמוך"
  },
  "billing.sortCustomer": {
    en: "Sort: Customer",
    es: "Orden: cliente",
    he: "מיון: לקוח"
  },

  "billing.statusPaid": { en: "Paid", es: "Pagado", he: "שולם" },
  // The two review chips carry their own count, so the number is a value
  // rather than a second node spliced in beside the word.
  "billing.pendingCount": {
    en: "Pending ({count})",
    es: "Pendientes ({count})",
    he: "ממתינות ({count})"
  },
  "billing.paidCount": {
    en: "Paid ({count})",
    es: "Pagadas ({count})",
    he: "שולמו ({count})"
  },
  "billing.noTransactionsHint": {
    en: "Adjust your filters or create a new transaction to begin tracking payments.",
    es: "Ajusta los filtros o crea una transacción nueva para empezar a seguir los pagos.",
    he: "שנו את הסינון או צרו תנועה חדשה כדי להתחיל לעקוב אחרי התשלומים."
  },
  "billing.statusPending": {
    en: "Pending",
    es: "Pendiente",
    he: "בהמתנה"
  },
  "billing.statusConfirmed": {
    en: "Confirmed",
    es: "Confirmado",
    he: "מאושר"
  },
  "billing.statusCancelled": {
    en: "Cancelled",
    es: "Cancelado",
    he: "בוטל"
  },
  "billing.statusRefunded": {
    en: "Refunded",
    es: "Reembolsado",
    he: "הוחזר"
  },
  "billing.statusDraft": { en: "Draft", es: "Borrador", he: "טיוטה" },
  "billing.statusSent": { en: "Sent", es: "Enviada", he: "נשלחה" },
  "billing.statusOverdue": {
    en: "Overdue",
    es: "Vencida",
    he: "באיחור"
  },
  "billing.statusPartiallyPaid": {
    en: "Partially Paid",
    es: "Pagada parcialmente",
    he: "שולמה חלקית"
  },
  "billing.statusNew": { en: "New", es: "Nueva", he: "חדשה" },

  "billing.invoices": {
    en: "Invoices",
    es: "Facturas",
    he: "חשבוניות"
  },
  "billing.invoicesBlurb": {
    en: "Draft, issue, and track payment.",
    es: "Redacta, emite y sigue el pago.",
    he: "יצירת טיוטה, הפקה ומעקב אחר תשלום."
  },
  "billing.allInvoices": {
    en: "All invoices",
    es: "Todas las facturas",
    he: "כל החשבוניות"
  },
  "billing.invoiceStatusFilter": {
    en: "Invoice status filter",
    es: "Filtro de estado de factura",
    he: "מסנן סטטוס חשבונית"
  },
  "billing.invoiceSearch": {
    en: "Invoice, client, status",
    es: "Factura, cliente, estado",
    he: "חשבונית, לקוח, סטטוס"
  },
  "billing.createInvoice": {
    en: "Create invoice",
    es: "Crear factura",
    he: "יצירת חשבונית"
  },
  "billing.selectInvoice": {
    en: "Select an invoice",
    es: "Selecciona una factura",
    he: "בחר חשבונית"
  },
  "billing.invoiceDetailsHere": {
    en: "Invoice details will appear here.",
    es: "Los detalles de la factura aparecerán aquí.",
    he: "פרטי החשבונית יופיעו כאן."
  },
  "billing.invoiceSummary": {
    en: "Invoice summary",
    es: "Resumen de la factura",
    he: "סיכום החשבונית"
  },
  "billing.lineItems": {
    en: "Line items",
    es: "Conceptos",
    he: "שורות"
  },
  "billing.lineItem": {
    en: "Line item",
    es: "Concepto",
    he: "שורה"
  },
  "billing.noLineItems": {
    en: "No line items recorded.",
    es: "No hay conceptos registrados.",
    he: "לא נרשמו שורות."
  },
  "billing.addItem": {
    en: "Add item",
    es: "Agregar concepto",
    he: "הוספת שורה"
  },
  "billing.statusHistory": {
    en: "Status history",
    es: "Historial de estados",
    he: "היסטוריית סטטוסים"
  },
  "billing.noLifecycleChanges": {
    en: "No lifecycle changes recorded yet.",
    es: "Aún no hay cambios de estado registrados.",
    he: "לא נרשמו עדיין שינויי מצב."
  },
  "billing.issued": { en: "Issued", es: "Emitida", he: "הופקה" },
  "billing.due": { en: "Due", es: "Vence", he: "לתשלום עד" },
  "billing.dueDate": {
    en: "Due date",
    es: "Fecha de vencimiento",
    he: "תאריך יעד"
  },
  "billing.balance": { en: "Balance", es: "Saldo", he: "יתרה" },
  "billing.openBalance": {
    en: "Open balance",
    es: "Saldo pendiente",
    he: "יתרה פתוחה"
  },
  "billing.amountDue": {
    en: "Amount due",
    es: "Importe a pagar",
    he: "סכום לתשלום"
  },
  "billing.payments": { en: "Payments", es: "Pagos", he: "תשלומים" },
  "billing.payment": { en: "Payment", es: "Pago", he: "תשלום" },
  "billing.recordPayment": {
    en: "Record payment",
    es: "Registrar pago",
    he: "רישום תשלום"
  },
  "billing.sendInvoice": {
    en: "Send invoice",
    es: "Enviar factura",
    he: "שליחת חשבונית"
  },
  "billing.cancelInvoice": {
    en: "Cancel invoice",
    es: "Anular factura",
    he: "ביטול חשבונית"
  },
  "billing.payWithStripe": {
    en: "Pay with Stripe",
    es: "Pagar con Stripe",
    he: "תשלום באמצעות Stripe"
  },
  "billing.closeInvoiceEditor": {
    en: "Close invoice editor",
    es: "Cerrar el editor de facturas",
    he: "סגירת עורך החשבוניות"
  },
  "billing.updateInvoiceBlurb": {
    en: "Update invoice details and line items.",
    es: "Actualiza los detalles y los conceptos de la factura.",
    he: "עדכון פרטי החשבונית והשורות שבה."
  },
  "billing.discountsRemain": {
    en: "Existing discounts and taxes remain applied.",
    es: "Los descuentos e impuestos existentes se mantienen.",
    he: "הנחות ומסים קיימים נשארים בתוקף."
  },
  "billing.closeNewInvoice": {
    en: "Close new invoice",
    es: "Cerrar la nueva factura",
    he: "סגירת החשבונית החדשה"
  },
  "billing.invoiceFromEvent": {
    en: "Create an invoice from an existing event.",
    es: "Crea una factura a partir de un evento existente.",
    he: "יצירת חשבונית מאירוע קיים."
  },
  "billing.noEventsAvailable": {
    en: "No events available",
    es: "No hay eventos disponibles",
    he: "אין אירועים זמינים"
  },

  "billing.eventBilling": {
    en: "Event Billing",
    es: "Facturación de eventos",
    he: "חיוב אירועים"
  },
  "billing.eventBillingSummary": {
    en: "Event billing summary",
    es: "Resumen de la facturación del evento",
    he: "סיכום חיוב האירוע"
  },
  "billing.eventBillingFilter": {
    en: "Event billing balance filter",
    es: "Filtro de saldo de facturación de eventos",
    he: "מסנן יתרת חיוב אירועים"
  },
  "billing.eventBillingAfterCreate": {
    en: "Event billing becomes available after an event is created.",
    es: "La facturación del evento está disponible tras crear un evento.",
    he: "חיוב האירוע יהיה זמין לאחר יצירת אירוע."
  },
  "billing.billingDetailsHere": {
    en: "Billing details will appear here.",
    es: "Los detalles de facturación aparecerán aquí.",
    he: "פרטי החיוב יופיעו כאן."
  },
  "billing.selectEvent": {
    en: "Select an event",
    es: "Selecciona un evento",
    he: "בחר אירוע"
  },
  "billing.openEventWorkspace": {
    en: "Open a specific event billing workspace.",
    es: "Abre el espacio de facturación de un evento concreto.",
    he: "פתיחת סביבת החיוב של אירוע מסוים."
  },
  "billing.allEvents": {
    en: "All events",
    es: "Todos los eventos",
    he: "כל האירועים"
  },
  "billing.eventSearch": {
    en: "Client, hall, date, status",
    es: "Cliente, salón, fecha, estado",
    he: "לקוח, אולם, תאריך, סטטוס"
  },

  "billing.reports": {
    en: "Billing reports",
    es: "Informes de facturación",
    he: "דוחות חיוב"
  },
  "billing.financialReporting": {
    en: "Financial reporting",
    es: "Informes financieros",
    he: "דיווח פיננסי"
  },
  "billing.reportsBlurb": {
    en: "Revenue, outstanding balances, refunds, and aging.",
    es: "Ingresos, saldos pendientes, reembolsos y antigüedad.",
    he: "הכנסות, יתרות פתוחות, החזרים וגיול."
  },
  "billing.aging": {
    en: "Accounts receivable aging",
    es: "Antigüedad de cuentas por cobrar",
    he: "גיול חובות לקוחות"
  },

  "billing.bankAndCategories": {
    en: "Bank and categories",
    es: "Banco y categorías",
    he: "בנק וקטגוריות"
  },
  "billing.bankBlurb": {
    en: "Company-level bank connections and transaction review rules.",
    es: "Conexiones bancarias de la empresa y reglas de revisión de transacciones.",
    he: "חיבורי בנק ברמת החברה וכללי בדיקת תנועות."
  },
  "billing.invoiceSettings": {
    en: "Invoice settings",
    es: "Configuración de facturas",
    he: "הגדרות חשבונית"
  },
  "billing.invoiceSettingsBlurb": {
    en: "Controls invoice PDF and email defaults.",
    es: "Controla los valores predeterminados del PDF y del correo de la factura.",
    he: "שולט בברירות המחדל של קובץ ה-PDF והדוא״ל של החשבונית."
  },
  "billing.businessName": {
    en: "Business Name",
    es: "Nombre comercial",
    he: "שם העסק"
  },
  "billing.invoiceFooter": {
    en: "Invoice Footer",
    es: "Pie de factura",
    he: "כותרת תחתונה של החשבונית"
  },
  "billing.paymentTerms": {
    en: "Payment Terms",
    es: "Condiciones de pago",
    he: "תנאי תשלום"
  },
  "billing.dueBeforeEvent": {
    en: "Due before event",
    es: "Vence antes del evento",
    he: "לתשלום לפני האירוע"
  },
  "billing.plaidFlow": {
    en: "Plaid connection flow",
    es: "Flujo de conexión de Plaid",
    he: "תהליך החיבור ל-Plaid"
  },
  "billing.plaidConnection": {
    en: "Plaid connection",
    es: "Conexión de Plaid",
    he: "חיבור Plaid"
  },
  "billing.plaidBankFeed": {
    en: "Plaid bank feed",
    es: "Flujo bancario de Plaid",
    he: "הזנת הבנק של Plaid"
  },
  "billing.closePlaid": {
    en: "Close Plaid connection",
    es: "Cerrar la conexión de Plaid",
    he: "סגירת החיבור ל-Plaid"
  },
  "billing.connectBank": {
    en: "Connect bank",
    es: "Conectar banco",
    he: "חיבור בנק"
  },
  "billing.connectBankAccount": {
    en: "Connect bank account",
    es: "Conectar cuenta bancaria",
    he: "חיבור חשבון בנק"
  },
  "billing.connected": {
    en: "Connected",
    es: "Conectado",
    he: "מחובר"
  },
  "billing.disconnect": {
    en: "Disconnect",
    es: "Desconectar",
    he: "ניתוק"
  },
  "billing.manage": { en: "Manage", es: "Gestionar", he: "ניהול" },
  "billing.syncNow": {
    en: "Sync now",
    es: "Sincronizar ahora",
    he: "סנכרון עכשיו"
  },
  "billing.linkBankBlurb": {
    en: "Link a business bank account so Event Core can import, review, match, and post transactions.",
    es: "Vincula una cuenta bancaria de empresa para que Event Core pueda importar, revisar, conciliar y registrar transacciones.",
    he: "חבר חשבון בנק עסקי כדי ש-Event Core תוכל לייבא, לבדוק, להתאים ולרשום תנועות."
  },
  "billing.bankTransaction": {
    en: "Bank transaction",
    es: "Transacción bancaria",
    he: "תנועת בנק"
  },
  "billing.manualEntry": {
    en: "Manual entry",
    es: "Entrada manual",
    he: "רישום ידני"
  },
  "billing.plaidWhoConnects": {
    en: "The authorized person from each organization or company (owner, admin, or billing manager) can connect that company's bank account.",
    es: "La persona autorizada de cada organización o empresa (propietario, administrador o responsable de facturación) puede conectar la cuenta bancaria de esa empresa.",
    he: "האדם המורשה בכל ארגון או חברה (בעלים, מנהל או אחראי חיוב) יכול לחבר את חשבון הבנק של אותה חברה."
  },
  "billing.plaidNoCredentials": {
    en: "Plaid securely handles the bank sign-in and approval process, and Event Core never stores the bank username or password.",
    es: "Plaid gestiona de forma segura el inicio de sesión y la aprobación del banco, y Event Core nunca almacena el usuario ni la contraseña bancarios.",
    he: "Plaid מטפלת באופן מאובטח בכניסה ובאישור מול הבנק, ו-Event Core לעולם אינה שומרת את שם המשתמש או הסיסמה של הבנק."
  },
  "billing.plaidSeparated": {
    en: "After approval, transactions appear only in that organization's Billing module and remain separated from other companies.",
    es: "Tras la aprobación, las transacciones aparecen solo en el módulo de facturación de esa organización y permanecen separadas de otras empresas.",
    he: "לאחר האישור, התנועות מופיעות רק במודול החיוב של אותו ארגון ונשארות מופרדות מחברות אחרות."
  },
  "billing.plaidStillNeeded": {
    en: "What we still need for live Plaid",
    es: "Lo que aún necesitamos para Plaid en vivo",
    he: "מה עוד נדרש עבור Plaid חי"
  },

  "billing.closeTransactionReview": {
    en: "Close transaction review",
    es: "Cerrar la revisión de la transacción",
    he: "סגירת בדיקת התנועה"
  },
  "billing.confirmPosting": {
    en: "Confirm how this bank activity should post in Event Core.",
    es: "Confirma cómo debe registrarse esta actividad bancaria en Event Core.",
    he: "אשר כיצד פעילות הבנק הזו תירשם ב-Event Core."
  },
  "billing.completeRequiredFields": {
    en: "Complete the required fields before posting this transaction.",
    es: "Completa los campos obligatorios antes de registrar esta transacción.",
    he: "מלא את שדות החובה לפני רישום התנועה."
  },
  "billing.postingDetails": {
    en: "Posting details",
    es: "Detalles del registro",
    he: "פרטי הרישום"
  },
  "billing.transactionCategory": {
    en: "Transaction category",
    es: "Categoría de la transacción",
    he: "קטגוריית התנועה"
  },
  "billing.reviewAction": {
    en: "Transaction review action",
    es: "Acción de revisión de la transacción",
    he: "פעולת בדיקת התנועה"
  },
  "billing.copyReference": {
    en: "Copy full transaction reference",
    es: "Copiar la referencia completa de la transacción",
    he: "העתקת אסמכתת התנועה המלאה"
  },
  "billing.needsReviewBadge": {
    en: "Needs review",
    es: "Requiere revisión",
    he: "דורש בדיקה"
  },
  "billing.reference": {
    en: "Reference",
    es: "Referencia",
    he: "אסמכתה"
  },
  "billing.referenceNumber": {
    en: "Reference number",
    es: "Número de referencia",
    he: "מספר אסמכתה"
  },
  "billing.source": { en: "Source", es: "Origen", he: "מקור" },
  "billing.method": { en: "Method", es: "Método", he: "אמצעי" },
  "billing.paymentMethod": {
    en: "Payment method",
    es: "Método de pago",
    he: "אמצעי תשלום"
  },
  "billing.closePaymentDialog": {
    en: "Close payment dialog",
    es: "Cerrar el diálogo de pago",
    he: "סגירת חלון התשלום"
  },
  "billing.methodCash": { en: "Cash", es: "Efectivo", he: "מזומן" },
  "billing.methodCard": { en: "Card", es: "Tarjeta", he: "כרטיס" },
  "billing.methodCheck": { en: "Check", es: "Cheque", he: "צ׳ק" },
  "billing.methodAch": { en: "ACH", es: "ACH", he: "ACH" },
  "billing.methodBankTransfer": {
    en: "Bank Transfer",
    es: "Transferencia bancaria",
    he: "העברה בנקאית"
  },
  "billing.methodManual": {
    en: "Manual",
    es: "Manual",
    he: "ידני"
  },

  "billing.backToTransactions": {
    en: "Back to transactions",
    es: "Volver a las transacciones",
    he: "חזרה לתנועות"
  },
  "billing.attachment": {
    en: "Attachment",
    es: "Adjunto",
    he: "קובץ מצורף"
  },
  "billing.billable": {
    en: "Billable",
    es: "Facturable",
    he: "בר-חיוב"
  },
  "billing.categorize": {
    en: "Categorize",
    es: "Categorizar",
    he: "סיווג"
  },
  "billing.categoryRequired": {
    en: "Category*",
    es: "Categoría*",
    he: "קטגוריה*"
  },
  "billing.typeRequired": {
    en: "Transaction type*",
    es: "Tipo de transacción*",
    he: "סוג תנועה*"
  },
  "billing.customerProject": {
    en: "Customer/Project",
    es: "Cliente/Proyecto",
    he: "לקוח/פרויקט"
  },
  "billing.fromTo": { en: "From/To", es: "De/Para", he: "מאת/אל" },
  "billing.fullBankDescription": {
    en: "Full bank description",
    es: "Descripción bancaria completa",
    he: "תיאור הבנק המלא"
  },
  "billing.memo": { en: "Memo", es: "Memo", he: "תזכורת" },
  "billing.post": { en: "Post", es: "Registrar", he: "רישום" },
  "billing.postAndNext": {
    en: "Post & next",
    es: "Registrar y siguiente",
    he: "רישום והבא"
  },
  "billing.splitTransaction": {
    en: "Split transaction",
    es: "Dividir transacción",
    he: "פיצול תנועה"
  },
  "billing.cancelTransaction": {
    en: "Cancel transaction",
    es: "Anular transacción",
    he: "ביטול תנועה"
  }
});
