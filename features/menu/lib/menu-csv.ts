/**
 * The spreadsheet an operator fills in, between their file and `menu_items`.
 *
 * One dish per line. The columns are positional, which is the whole reason the
 * bulk upload dialog opens on a guide rather than a file picker: nothing in a
 * CSV says which column is which, so a sheet with category and kashrut swapped
 * imports every dish wrong and reports nothing. `MENU_CSV_COLUMNS` below is the
 * single source of truth for that guide, for the downloadable template, and for
 * the parser - they cannot drift into disagreeing about the order.
 *
 * Rows are classified, never coerced: a line that cannot be read becomes an
 * `error` row carrying the reason, the same policy `parseNumericInput` follows
 * for a number that will not parse. Silently dropping it is what the billing
 * import does, and it is why an operator there cannot tell a skipped row from a
 * row they forgot to type.
 *
 * Keep free of `server-only` and Prisma: the dialog imports it.
 */

import { parseAllergens } from "@/features/menu/lib/allergens";
import {
  MENU_ITEM_KINDS,
  type MenuItemKind
} from "@/features/menu/lib/service-style";

/**
 * Matches `menuItemFieldsSchema.name`. Checked here rather than left to the
 * server because one over-long name would fail the whole transaction, and the
 * operator would be told only that the import failed.
 */
const MAX_NAME_LENGTH = 200;

/**
 * The cap the import endpoint enforces. Kept here so the dialog can refuse an
 * over-long file before uploading it rather than after.
 */
export const MAX_MENU_CSV_ROWS = 500;

/** The kashrut values the column accepts, mirroring `menuItemFieldsSchema`. */
export const KOSHER_TYPES = ["Milchig", "Fleishig", "Parve"] as const;

export type KosherType = (typeof KOSHER_TYPES)[number];

/**
 * The categories `NewLibraryItemDialog` offers, for the xlsx template's
 * dropdown to offer the same ones.
 *
 * A suggestion rather than a rule: the column is free text on purpose, and
 * `parseMenuCsv` stores whatever it is given. A hall with a "Kiddush" course
 * keeps it.
 */
export const MENU_CATEGORY_OPTIONS = [
  "Appetizer",
  "Soup",
  "Main",
  "Side",
  "Drink",
  "Dessert",
  "More"
] as const;

/**
 * What a hand-typed kashrut cell may say.
 *
 * The same three synonyms the `20260817140000_add_menu_item_services` migration
 * normalizes on the way in - an operator who wrote "dairy" in their old system
 * writes it here too, and rejecting it would teach nothing.
 */
const KOSHER_ALIASES: Record<string, KosherType> = {
  milchig: "Milchig",
  dairy: "Milchig",
  fleishig: "Fleishig",
  meat: "Fleishig",
  parve: "Parve",
  pareve: "Parve"
};

export type MenuCsvField =
  | "name"
  | "category"
  | "kosherType"
  | "allergens"
  | "notes"
  | "kind";

export type MenuCsvColumn = {
  /** The spreadsheet column the operator sees, so the guide can label it. */
  letter: string;
  header: string;
  field: MenuCsvField;
  required: boolean;
  /** One line in the guide, stating what the cell accepts. */
  help: string;
};

/**
 * The order. Changing it changes the guide, the template and the parser
 * together, which is the point of them all reading this array.
 */
export const MENU_CSV_COLUMNS = [
  {
    letter: "A",
    header: "Item Name",
    field: "name",
    required: true,
    help: "Required. The dish name, up to 200 characters."
  },
  {
    letter: "B",
    header: "Category",
    field: "category",
    required: false,
    help: "Appetizer, Soup, Main, Side, Drink, Dessert - or your own. Leave blank to file it under More."
  },
  {
    letter: "C",
    header: "Kashrut Type",
    field: "kosherType",
    required: false,
    help: "Parve, Fleishig or Milchig. Dairy and Meat are understood too."
  },
  {
    letter: "D",
    header: "Allergies",
    field: "allergens",
    required: false,
    help: "Several in one cell, separated by commas. Type them straight into the cell - saving as CSV adds the quotes for you."
  },
  {
    letter: "E",
    header: "Description",
    field: "notes",
    required: false,
    help: "Free text, for your own reference."
  },
  {
    letter: "F",
    header: "Food or Drink",
    field: "kind",
    required: false,
    help: "Food or Drink. Blank means Food."
  }
] as const satisfies readonly MenuCsvColumn[];

/**
 * The two rows the guide displays and the template ships with.
 *
 * The first one carries two allergens on purpose: it is the only cell in the
 * format whose own separator is the CSV delimiter, so the sample has to show
 * what a correct one looks like.
 */
export const MENU_CSV_SAMPLE_ROWS = [
  [
    "Gefilte Fish",
    "Appetizer",
    "Parve",
    "fish, eggs",
    "Served cold with horseradish",
    "Food"
  ],
  ["Grape Juice", "Drink", "Parve", "", "1L bottle", "Drink"]
] as const;

export type MenuCsvRowStatus = "ready" | "duplicate" | "error";

/**
 * One line of the file, read as far as it could be read.
 *
 * The fields are populated even on an `error` row so the review table can show
 * the operator what it made of the line next to why it was refused.
 */
export type MenuCsvRow = {
  /** 1-based line in the file, so a message can name the row they see. */
  line: number;
  name: string;
  category?: string;
  kosherType?: KosherType;
  allergens: string[];
  notes?: string;
  kind: MenuItemKind;
  status: MenuCsvRowStatus;
  /** Why the row is not ready. Absent when it is. */
  message?: string;
};

export type MenuCsvParseResult = {
  rows: MenuCsvRow[];
  readyCount: number;
  duplicateCount: number;
  errorCount: number;
  /**
   * Set when the file has a header row whose columns are not in the documented
   * order. The rows are still parsed positionally - this is the warning that
   * says the sheet, not the importer, is what needs fixing.
   */
  headerMismatch: string | null;
  /** Set when the file carries more lines than the endpoint will accept. */
  tooManyRows: boolean;
};

/**
 * A CSV reader that understands quotes, because this format needs one.
 *
 * The allergen column holds a comma-separated list inside a comma-separated
 * file, so `"fish, eggs"` is the normal case rather than an edge case, and the
 * `line.split(",")` in `features/billing/components/billing-page.tsx` would
 * turn it into two columns and shift every field after it. Also handles `""`
 * escapes, newlines inside quotes, CRLF, and the BOM Excel writes.
 */
export function parseCsv(text: string): string[][] {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let index = 0;

  const endField = () => {
    row.push(field);
    field = "";
  };

  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (index < source.length) {
    const char = source[index];

    if (inQuotes) {
      if (char === '"') {
        // A doubled quote is one literal quote; a lone one closes the field.
        if (source[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }

        inQuotes = false;
        index += 1;
        continue;
      }

      field += char;
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      index += 1;
      continue;
    }

    if (char === ",") {
      endField();
      index += 1;
      continue;
    }

    if (char === "\r") {
      endRow();
      index += source[index + 1] === "\n" ? 2 : 1;
      continue;
    }

    if (char === "\n") {
      endRow();
      index += 1;
      continue;
    }

    field += char;
    index += 1;
  }

  // Only if something was actually read for it: a file ending in a newline must
  // not produce a trailing empty row for the review table to complain about.
  if (field !== "" || row.length > 0) endRow();

  return rows;
}

/** A cell as a trimmed string, for a column the row may not reach at all. */
function readCell(row: readonly string[], index: number) {
  return (row[index] ?? "").trim();
}

/** Blank means "leave the column null", not "store an empty string". */
function readOptional(row: readonly string[], index: number) {
  return readCell(row, index) || undefined;
}

function isBlankRow(row: readonly string[]) {
  return row.every((cell) => cell.trim() === "");
}

const HEADER_LABELS = MENU_CSV_COLUMNS.map((column) =>
  column.header.toLowerCase()
);

/**
 * Whether the first line names columns rather than describing a dish.
 *
 * Two matches rather than one so a genuine dish called "Item Name" cannot make
 * its own row disappear, and so a misordered header is still recognised as a
 * header - which is what lets `readHeaderMismatch` warn about it.
 */
function isHeaderRow(row: readonly string[]) {
  const matches = row.filter((cell) =>
    HEADER_LABELS.includes(cell.trim().toLowerCase())
  );

  return matches.length >= 2;
}

/**
 * The check the whole feature exists for.
 *
 * A header row is proof of what the operator *believes* the order is. When that
 * disagrees with the documented order, every row is about to import into the
 * wrong columns, and nothing downstream would notice - a category reading
 * "Parve" is not a validation error, just a wrong menu.
 */
function readHeaderMismatch(row: readonly string[]): string | null {
  const misplaced = MENU_CSV_COLUMNS.filter(
    (column, index) =>
      readCell(row, index).toLowerCase() !== column.header.toLowerCase()
  );

  if (misplaced.length === 0) return null;

  const expected = MENU_CSV_COLUMNS.map(
    (column) => `${column.letter}: ${column.header}`
  ).join(", ");

  return `The header row does not match the expected order. Columns should be ${expected}. Every row will be read by position, so reorder the sheet before importing.`;
}

function readKosherType(raw: string) {
  if (!raw) return { ok: true as const, value: undefined };

  const match = KOSHER_ALIASES[raw.toLowerCase()];

  if (!match) {
    return {
      ok: false as const,
      message: `Kashrut type "${raw}" is not one of ${KOSHER_TYPES.join(", ")}.`
    };
  }

  return { ok: true as const, value: match };
}

function readKind(raw: string, fallback: MenuItemKind) {
  if (!raw) return { ok: true as const, value: fallback };

  const match = MENU_ITEM_KINDS.find(
    (kind) => kind.toLowerCase() === raw.toLowerCase()
  );

  if (!match) {
    return {
      ok: false as const,
      message: `"${raw}" is not ${MENU_ITEM_KINDS.join(" or ")}.`
    };
  }

  return { ok: true as const, value: match };
}

/**
 * Reads the file into rows the review step can render and the import can send.
 *
 * `existingNames` are the dishes already in the catalog. `menu_items` has no
 * unique index on name, so a second upload of the same sheet would quietly
 * double the menu; matching here is what lets the dialog offer to skip them.
 *
 * `defaultKind` is what a blank "Food or Drink" cell means, so an import started
 * from the Drink Menu tab produces drinks - the same reasoning that gives the
 * dialog its `defaultServiceStyle`. A cell that names a kind still wins.
 */
export function parseMenuCsv(
  text: string,
  {
    existingNames = [],
    defaultKind = "Food"
  }: { existingNames?: readonly string[]; defaultKind?: MenuItemKind } = {}
): MenuCsvParseResult {
  const table = parseCsv(text).filter((row) => !isBlankRow(row));
  const headerPresent = table.length > 0 && isHeaderRow(table[0]);
  const headerMismatch = headerPresent ? readHeaderMismatch(table[0]) : null;
  // A file may legitimately arrive without headers, so the header is skipped
  // when it is there rather than required.
  const dataRows = headerPresent ? table.slice(1) : table;
  const headerOffset = headerPresent ? 2 : 1;

  const takenNames = new Set(
    existingNames.map((name) => name.trim().toLowerCase())
  );
  // Names claimed earlier in this same file, so a sheet that repeats a dish
  // reports the second one rather than creating it twice.
  const seenInFile = new Set<string>();

  const rows = dataRows
    .slice(0, MAX_MENU_CSV_ROWS)
    .map((row, index): MenuCsvRow => {
      const line = index + headerOffset;
      const name = readCell(row, 0);
      const kosher = readKosherType(readCell(row, 2));
      const kind = readKind(readCell(row, 5), defaultKind);

      const parsed: MenuCsvRow = {
        line,
        name,
        category: readOptional(row, 1),
        kosherType: kosher.ok ? kosher.value : undefined,
        allergens: parseAllergens(readCell(row, 3)),
        notes: readOptional(row, 4),
        kind: kind.ok ? kind.value : "Food",
        status: "ready"
      };

      const fail = (message: string): MenuCsvRow => ({
        ...parsed,
        status: "error",
        message
      });

      if (!name) return fail("Item name is empty.");
      if (name.length > MAX_NAME_LENGTH) {
        return fail(`Item name is longer than ${MAX_NAME_LENGTH} characters.`);
      }
      if (!kosher.ok) return fail(kosher.message);
      if (!kind.ok) return fail(kind.message);

      const key = name.toLowerCase();

      if (takenNames.has(key)) {
        return {
          ...parsed,
          status: "duplicate",
          message: "Already in your menu."
        };
      }

      if (seenInFile.has(key)) {
        return {
          ...parsed,
          status: "duplicate",
          message: "Repeated earlier in this file."
        };
      }

      seenInFile.add(key);

      return parsed;
    });

  const countOf = (status: MenuCsvRowStatus) =>
    rows.filter((row) => row.status === status).length;

  return {
    rows,
    readyCount: countOf("ready"),
    duplicateCount: countOf("duplicate"),
    errorCount: countOf("error"),
    headerMismatch,
    tooManyRows: dataRows.length > MAX_MENU_CSV_ROWS
  };
}

/** Quotes a value only when it would otherwise change the shape of the row. */
function escapeCsvValue(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function toCsv(rows: readonly (readonly string[])[]) {
  return rows.map((row) => row.map(escapeCsvValue).join(",")).join("\r\n");
}

/**
 * The file behind "Download template".
 *
 * Handing over a correct sheet is worth more than the guide beside it: filling
 * rows into an existing header cannot get the order wrong, while copying a
 * layout out of a picture can.
 */
export function buildMenuCsvTemplate() {
  return toCsv([
    MENU_CSV_COLUMNS.map((column) => column.header),
    ...MENU_CSV_SAMPLE_ROWS
  ]);
}
