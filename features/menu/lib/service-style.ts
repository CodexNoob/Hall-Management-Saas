import { countSchema, parseNumericInput } from "@/lib/validation/number";
import { z } from "zod";

/**
 * How a dish is served, and how much of it to cook.
 *
 * These live on `menu_item_services` - one row per dish per style - which is why
 * the Buffet and Plated tabs are views over the catalog rather than lists of
 * their own. A dish exists once; serving it two ways gives it two rules, not two
 * rows in the library.
 *
 * Note what is NOT a value here any more. "Library" and "Both" used to be
 * service styles on `menu_items.usage_type`; both are now set semantics. A dish
 * with no service rows is catalogued but not served, and a dish served either
 * way simply has two rows. That also frees `usage_type` to go back to the
 * meaning the master spec gives it - School, Simcha or Both - which is what the
 * hall and school filters need.
 *
 * Deliberately NOT here: price. That belongs to an `EventPackage` or an
 * `AddOn`, the two things a client actually buys. Putting a price on a service
 * style is what made buffet look like a second, redundant kind of package.
 *
 * Keep this module free of `server-only` and Prisma: the dialog imports it too.
 */
export const SERVICE_STYLES = ["Buffet", "Plated"] as const;

export type ServiceStyle = (typeof SERVICE_STYLES)[number];

export const serviceStyleSchema = z.enum(SERVICE_STYLES);

/** Which side of the business an item belongs to. The master spec's usage_type. */
export const BUSINESS_SEGMENTS = ["School", "Simcha", "Both"] as const;

export type BusinessSegment = (typeof BUSINESS_SEGMENTS)[number];

export const businessSegmentSchema = z.enum(BUSINESS_SEGMENTS);

export const DEFAULT_SEGMENT: BusinessSegment = "Both";

/** Food or drink. Was only ever implied by which id array an item landed in. */
export const MENU_ITEM_KINDS = ["Food", "Drink"] as const;

export type MenuItemKind = (typeof MENU_ITEM_KINDS)[number];

export const menuItemKindSchema = z.enum(MENU_ITEM_KINDS);

/**
 * Suggested counting units, kept short because they render inside a card.
 *
 * Suggestions, not the allowed set: the unit is free text, so a kitchen that
 * counts in pans, urns or half-hotels types its own word instead of picking the
 * nearest wrong one. These are what the dialog offers as a datalist, and what
 * the bulk import still picks from.
 */
export const COUNTING_UNITS = [
  "tray",
  "plate",
  "bowl",
  "portion",
  "piece",
  "roll",
  "set",
  "bottle"
] as const;

/**
 * Which of the event's head counts a rule divides.
 *
 * This is the piece the old `counting_rules` json had no way to express: it
 * carried "per 30 people" with no way to say *which* people, while the event
 * row carries seven separate counts. The spec's Kitchen Item Row names only
 * Couples and Portions; `TotalGuests` is Portions, and the rest map onto columns
 * that already exist.
 */
export const COUNT_BASES = [
  "TotalGuests",
  "Couples",
  "Men",
  "Ladies",
  "Boys",
  "Girls",
  "Kids",
  "Waiters",
  "Tables",
  "Event"
] as const;

export type CountBasis = (typeof COUNT_BASES)[number];

export const countBasisSchema = z.enum(COUNT_BASES);

/** What each basis is called in the dialog and on a card. */
export const COUNT_BASIS_LABELS: Record<CountBasis, string> = {
  TotalGuests: "guests",
  Couples: "couples",
  Men: "men",
  Ladies: "ladies",
  Boys: "boys",
  Girls: "girls",
  Kids: "kids",
  Waiters: "waiters",
  Tables: "tables",
  Event: "event"
};

/**
 * `Exact` is the one that matters: you always round trays up, and you never
 * round plates at all. A kitchen sheet printing "6.23 trays" is a kitchen sheet
 * nobody trusts, and one printing 7 plates for 6 guests wastes a plate.
 */
export const ROUNDING_MODES = ["Up", "Down", "Nearest", "Exact"] as const;

export type RoundingMode = (typeof ROUNDING_MODES)[number];

export const roundingModeSchema = z.enum(ROUNDING_MODES);

export const DEFAULT_ROUNDING: RoundingMode = "Up";

/**
 * The column is `Decimal(10, 3)` - ten digits, three of them after the point -
 * so half a tray is expressible and the bound below is what actually fits.
 */
const ruleQuantitySchema = z
  .number({ invalid_type_error: "Quantity must be a number." })
  .finite("Quantity must be a real number.")
  .multipleOf(0.001, "Quantity can have at most 3 decimal places.")
  .positive("Quantity must be greater than zero.")
  .max(9_999_999.999, "Quantity is too large.");

/**
 * The column is plain `TEXT` with no CHECK behind it, so the only bounds worth
 * enforcing are the ones a card can render: something non-blank, and short
 * enough not to wrap. Trimmed on the way in so " tray" and "tray" group as one
 * unit in `calculateMenuQuantity`, which keys its groups on this string.
 */
export const unitSchema = z
  .string({ invalid_type_error: "Unit must be text." })
  .trim()
  .min(1, "Unit is required.")
  .max(24, "Unit must be 24 characters or fewer.");

export const serviceRuleSchema = z.object({
  serviceStyle: serviceStyleSchema,
  quantity: ruleQuantitySchema,
  unit: unitSchema,
  per: countSchema({ min: 1, label: "Per" }),
  perBasis: countBasisSchema,
  rounding: roundingModeSchema,
  // `null` is "no floor", which is different from a floor of zero only in
  // intent - but the column is nullable and round-tripping it keeps an edit
  // from inventing a `0` the user never set.
  minimumUnits: countSchema({ min: 1, label: "Minimum" }).nullable()
});

export type MenuItemServiceRule = z.infer<typeof serviceRuleSchema>;

/** The rules as they arrive from `GET /api/menu`, before anything trusts them. */
const serviceRuleListSchema = z.array(serviceRuleSchema);

/**
 * Reads the service rows back.
 *
 * Same policy the `counting_rules` json needed and for a milder reason: the
 * columns are constrained now, but a build that does not yet know a value some
 * newer build wrote should degrade to "no rule" rather than throw inside a
 * render.
 */
export function readServiceRules(value: unknown): MenuItemServiceRule[] {
  const parsed = serviceRuleListSchema.safeParse(value);

  return parsed.success ? parsed.data : [];
}

/**
 * A dish serves a style iff it has a rule for it. No sentinel value, nothing to
 * keep in sync - which is the whole point of moving these into their own rows.
 */
export function servesStyle(
  services: MenuItemServiceRule[],
  style: ServiceStyle
) {
  return services.some((service) => service.serviceStyle === style);
}

export function findRuleForStyle(
  services: MenuItemServiceRule[],
  style: ServiceStyle
) {
  return services.find((service) => service.serviceStyle === style) ?? null;
}

export function formatServiceRule(rule: MenuItemServiceRule | null) {
  if (!rule) return "No counting rule set";

  const basis = COUNT_BASIS_LABELS[rule.perBasis];
  const base =
    rule.perBasis === "Event"
      ? `${rule.quantity} ${rule.unit} per event`
      : `${rule.quantity} ${rule.unit} per ${rule.per} ${basis}`;

  return rule.minimumUnits ? `${base}, min ${rule.minimumUnits}` : base;
}

/**
 * One style's rule as the dialog holds it: text, because that is what an
 * `<input>` gives back, plus the checkbox that says whether the dish is served
 * this way at all.
 */
export type ServiceRuleFormValues = {
  enabled: boolean;
  quantity: string;
  unit: string;
  per: string;
  perBasis: string;
  rounding: string;
  minimumUnits: string;
};

export type ServiceStyleFormValues = Record<ServiceStyle, ServiceRuleFormValues>;

const BUFFET_DEFAULTS: ServiceRuleFormValues = {
  enabled: false,
  quantity: "1",
  unit: "tray",
  per: "30",
  perBasis: "TotalGuests",
  rounding: "Up",
  minimumUnits: ""
};

const PLATED_DEFAULTS: ServiceRuleFormValues = {
  enabled: false,
  quantity: "1",
  unit: "plate",
  per: "1",
  perBasis: "TotalGuests",
  // A plate is one per head. Rounding it up would send out a plate for a guest
  // who is not there.
  rounding: "Exact",
  minimumUnits: ""
};

export const SERVICE_FORM_DEFAULTS: ServiceStyleFormValues = {
  Buffet: BUFFET_DEFAULTS,
  Plated: PLATED_DEFAULTS
};

/** Seeds the dialog from an item's stored rows, for an edit. */
export function readServiceStyleFormValues(
  services: MenuItemServiceRule[]
): ServiceStyleFormValues {
  const seed = (style: ServiceStyle): ServiceRuleFormValues => {
    const rule = findRuleForStyle(services, style);

    if (!rule) return SERVICE_FORM_DEFAULTS[style];

    return {
      enabled: true,
      quantity: String(rule.quantity),
      unit: rule.unit,
      per: String(rule.per),
      perBasis: rule.perBasis,
      rounding: rule.rounding,
      minimumUnits: rule.minimumUnits === null ? "" : String(rule.minimumUnits)
    };
  };

  return { Buffet: seed("Buffet"), Plated: seed("Plated") };
}

function parseRequiredCount(raw: string, label: string) {
  const parsed = parseNumericInput(raw, countSchema({ min: 1, label }));

  if (parsed.status === "valid") return parsed.value;

  throw new Error(
    parsed.status === "invalid"
      ? parsed.message
      : `${label} is required for a served item.`
  );
}

/**
 * Turns the dialog's text back into rules to store. An unchecked style produces
 * nothing, which is how an item goes back to being library-only.
 *
 * Throws rather than coercing, the same way the page's `readPrice` does: the
 * dialog renders what it catches, and a silent `0` here would tell the kitchen
 * to cook nothing.
 */
export function toServiceRules(
  values: ServiceStyleFormValues
): MenuItemServiceRule[] {
  return SERVICE_STYLES.flatMap((style) => {
    const entry = values[style];

    if (!entry.enabled) return [];

    const quantity = parseNumericInput(entry.quantity, ruleQuantitySchema);

    if (quantity.status !== "valid") {
      throw new Error(
        quantity.status === "invalid"
          ? quantity.message
          : "Quantity is required for a served item."
      );
    }

    // Free text now, so it needs the same explicit check the numbers get -
    // otherwise a blank unit surfaces as a raw ZodError from the parse below,
    // and the dialog renders whatever that error stringifies to.
    const unit = unitSchema.safeParse(entry.unit);

    if (!unit.success) {
      throw new Error(
        unit.error.issues[0]?.message ?? "Unit is required for a served item."
      );
    }

    // "per 1 event" is the shape a whole-event rule takes, so the Per input is
    // not asked for and must not be validated as if it were.
    const per =
      entry.perBasis === "Event" ? 1 : parseRequiredCount(entry.per, "Per");

    // Blank means no floor at all, which is the common case - only an explicit
    // number becomes a minimum.
    const minimumUnits =
      entry.minimumUnits.trim() === ""
        ? null
        : parseRequiredCount(entry.minimumUnits, "Minimum");

    return [
      serviceRuleSchema.parse({
        serviceStyle: style,
        quantity: quantity.value,
        unit: unit.data,
        per,
        perBasis: entry.perBasis,
        rounding: entry.rounding,
        minimumUnits
      })
    ];
  });
}
