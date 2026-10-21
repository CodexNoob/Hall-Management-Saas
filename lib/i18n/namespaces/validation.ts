import { defineMessages } from "@/lib/i18n/types";

/**
 * What a form says when a number is wrong.
 *
 * These are the sentence frames `lib/validation/number.ts` builds its Zod
 * messages from. That module is imported by route handlers as well as by
 * forms, and the server has no locale to translate into - so the schema
 * factories take the translator as an option and fall back to the English
 * below when nobody passes one. A client form passes it; a route handler does
 * not, and its message goes into the API response in English exactly as before.
 *
 * `{label}` is the field's own name, which the caller has usually already
 * translated.
 */
export const validationMessages = defineMessages({
  "validation.thisField": {
    en: "This field",
    es: "Este campo",
    he: "השדה הזה"
  },
  "validation.amount": { en: "Amount", es: "Importe", he: "סכום" },
  "validation.value": { en: "Value", es: "Valor", he: "ערך" },
  "validation.quantity": { en: "Quantity", es: "Cantidad", he: "כמות" },

  "validation.mustBeNumber": {
    en: "{label} must be a number.",
    es: "{label} debe ser un número.",
    he: "{label} חייב להיות מספר."
  },
  "validation.mustBeWholeNumber": {
    en: "{label} must be a whole number.",
    es: "{label} debe ser un número entero.",
    he: "{label} חייב להיות מספר שלם."
  },
  "validation.mustBeWholeCents": {
    en: "{label} must be a whole number of cents.",
    es: "{label} debe ser un número entero de céntimos.",
    he: "{label} חייב להיות מספר שלם של סנטים."
  },
  "validation.mustBeRealNumber": {
    en: "{label} must be a real number.",
    es: "{label} debe ser un número real.",
    he: "{label} חייב להיות מספר ממשי."
  },
  "validation.atLeast": {
    en: "{label} must be at least {min}.",
    es: "{label} debe ser al menos {min}.",
    he: "{label} חייב להיות לפחות {min}."
  },
  "validation.atMost": {
    en: "{label} must be {max} or less.",
    es: "{label} debe ser {max} o menos.",
    he: "{label} חייב להיות {max} או פחות."
  },
  "validation.atMostTwoDecimals": {
    en: "{label} can have at most 2 decimal places.",
    es: "{label} puede tener como máximo 2 decimales.",
    he: "ל{label} מותרות לכל היותר 2 ספרות אחרי הנקודה."
  },
  "validation.atMostThreeDecimals": {
    en: "{label} can have at most 3 decimal places.",
    es: "{label} puede tener como máximo 3 decimales.",
    he: "ל{label} מותרות לכל היותר 3 ספרות אחרי הנקודה."
  },
  "validation.greaterThanZero": {
    en: "{label} must be greater than zero.",
    es: "{label} debe ser mayor que cero.",
    he: "{label} חייב להיות גדול מאפס."
  },

  // The phone field. `{label}` is the field's own name, already translated;
  // `{region}` is a country name, which `Intl.DisplayNames` renders.
  "validation.phonePunctuation": {
    en: "{label} must contain only digits and phone punctuation.",
    es: "{label} solo puede contener dígitos y signos de puntuación telefónicos.",
    he: "{label} יכול להכיל ספרות וסימני פיסוק טלפוניים בלבד."
  },
  "validation.enterValidPhone": {
    en: "Enter a valid {label}.",
    es: "Introduce un {label} válido.",
    he: "הזן {label} תקין."
  },
  "validation.notValidRegionPhone": {
    en: "That is not a valid {region} phone number.",
    es: "Ese no es un número de teléfono válido de {region}.",
    he: "זהו אינו מספר טלפון תקין של {region}."
  },

  "validation.enterNumber": {
    en: "Enter a number.",
    es: "Introduce un número.",
    he: "הזן מספר."
  },
  "validation.enterValidNumber": {
    en: "Enter a valid number.",
    es: "Introduce un número válido.",
    he: "הזן מספר תקין."
  }
});
