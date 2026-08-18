import { describe, expect, it } from "vitest";
import {
  MENU_CSV_COLUMNS,
  MAX_MENU_CSV_ROWS,
  buildMenuCsvTemplate,
  parseCsv,
  parseMenuCsv
} from "@/features/menu/lib/menu-csv";

const HEADER = MENU_CSV_COLUMNS.map((column) => column.header).join(",");

/** A file with the documented header and whatever rows the test needs. */
function sheet(...rows: string[]) {
  return [HEADER, ...rows].join("\n");
}

describe("parseCsv", () => {
  it("keeps a comma inside a quoted field in the same cell", () => {
    expect(parseCsv('Gefilte,Appetizer,"fish, eggs"')).toEqual([
      ["Gefilte", "Appetizer", "fish, eggs"]
    ]);
  });

  it("reads a doubled quote as one literal quote", () => {
    expect(parseCsv('"He said ""hi""",b')).toEqual([['He said "hi"', "b"]]);
  });

  it("keeps a newline inside a quoted field in the same cell", () => {
    expect(parseCsv('"line one\nline two",b')).toEqual([
      ["line one\nline two", "b"]
    ]);
  });

  it("reads CRLF, lone LF and lone CR as row breaks", () => {
    expect(parseCsv("a,b\r\nc,d\ne,f\rg,h")).toEqual([
      ["a", "b"],
      ["c", "d"],
      ["e", "f"],
      ["g", "h"]
    ]);
  });

  it("strips the byte order mark Excel writes", () => {
    expect(parseCsv("﻿Item Name,Category")).toEqual([
      ["Item Name", "Category"]
    ]);
  });

  it("does not invent a trailing row for a file ending in a newline", () => {
    expect(parseCsv("a,b\r\n")).toEqual([["a", "b"]]);
  });

  it("keeps empty cells rather than dropping them", () => {
    expect(parseCsv('a,,"",d')).toEqual([["a", "", "", "d"]]);
  });
});

describe("parseMenuCsv", () => {
  it("reads a full row into the columns the item schema expects", () => {
    const result = parseMenuCsv(
      sheet('Gefilte Fish,Appetizer,Parve,"fish, eggs",Served cold,Food')
    );

    expect(result.rows).toEqual([
      {
        line: 2,
        name: "Gefilte Fish",
        category: "Appetizer",
        kosherType: "Parve",
        // The assertion the naive split would fail: two tags, not one cell
        // spilling into the next column.
        allergens: ["fish", "eggs"],
        notes: "Served cold",
        kind: "Food",
        status: "ready"
      }
    ]);
    expect(result.readyCount).toBe(1);
    expect(result.headerMismatch).toBeNull();
  });

  it("leaves optional blanks undefined rather than empty strings", () => {
    const [row] = parseMenuCsv(sheet("Plain Rice,,,,,")).rows;

    expect(row).toMatchObject({
      name: "Plain Rice",
      category: undefined,
      kosherType: undefined,
      allergens: [],
      notes: undefined,
      // Blank means Food, which is the column's documented default.
      kind: "Food",
      status: "ready"
    });
  });

  it("reads a file with no header row, starting at line 1", () => {
    const result = parseMenuCsv("Roast Chicken,Main,Fleishig,,,Food");

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ line: 1, name: "Roast Chicken" });
  });

  it("does not treat a dish row as a header", () => {
    const result = parseMenuCsv("Item Name,Main,Fleishig,,,Food");

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      name: "Item Name",
      status: "ready"
    });
  });

  it("ignores blank lines anywhere in the file", () => {
    const result = parseMenuCsv(sheet("Soup,Soup,Parve,,,Food", "", "   ", ""));

    expect(result.rows).toHaveLength(1);
    expect(result.readyCount).toBe(1);
  });

  describe("kashrut", () => {
    it.each([
      ["Parve", "Parve"],
      ["parve", "Parve"],
      ["PAREVE", "Parve"],
      ["dairy", "Milchig"],
      ["Meat", "Fleishig"],
      ["fleishig", "Fleishig"]
    ])("reads %s as %s", (input, expected) => {
      const [row] = parseMenuCsv(sheet(`Dish,Main,${input},,,Food`)).rows;

      expect(row).toMatchObject({ kosherType: expected, status: "ready" });
    });

    it("refuses a value it does not recognise instead of guessing", () => {
      const [row] = parseMenuCsv(sheet("Dish,Main,Halal,,,Food")).rows;

      expect(row.status).toBe("error");
      expect(row.message).toBe(
        'Kashrut type "Halal" is not one of Milchig, Fleishig, Parve.'
      );
    });
  });

  describe("rows it refuses", () => {
    it("names the row with no item name", () => {
      const result = parseMenuCsv(sheet(",Main,Parve,,,Food"));

      expect(result.rows[0]).toMatchObject({
        line: 2,
        status: "error",
        message: "Item name is empty."
      });
      expect(result.errorCount).toBe(1);
      expect(result.readyCount).toBe(0);
    });

    it("refuses a name the item schema would reject for length", () => {
      const [row] = parseMenuCsv(sheet(`${"a".repeat(201)},Main,,,,`)).rows;

      expect(row.status).toBe("error");
      expect(row.message).toBe("Item name is longer than 200 characters.");
    });

    it("refuses a kind that is neither Food nor Drink", () => {
      const [row] = parseMenuCsv(sheet("Dish,Main,Parve,,,Dessert")).rows;

      expect(row.status).toBe("error");
      expect(row.message).toBe('"Dessert" is not Food or Drink.');
    });

    it("keeps what it could read on a refused row, for the review table", () => {
      const [row] = parseMenuCsv(sheet("Dish,Main,Halal,nuts,Notes,Food")).rows;

      expect(row).toMatchObject({
        name: "Dish",
        category: "Main",
        allergens: ["nuts"],
        notes: "Notes",
        status: "error"
      });
    });
  });

  describe("duplicates", () => {
    it("flags a name already in the catalog, case-insensitively", () => {
      const result = parseMenuCsv(sheet("chicken soup,Soup,Fleishig,,,Food"), {
        existingNames: ["Chicken Soup"]
      });

      expect(result.rows[0]).toMatchObject({
        status: "duplicate",
        message: "Already in your menu."
      });
      expect(result.duplicateCount).toBe(1);
      expect(result.readyCount).toBe(0);
    });

    it("flags the second copy of a name repeated within one file", () => {
      const result = parseMenuCsv(
        sheet("Kugel,Side,Parve,,,Food", "Kugel,Side,Parve,,,Food")
      );

      expect(result.rows[0].status).toBe("ready");
      expect(result.rows[1]).toMatchObject({
        status: "duplicate",
        message: "Repeated earlier in this file."
      });
    });

    it("does not flag a distinct name", () => {
      const result = parseMenuCsv(sheet("Kugel,Side,Parve,,,Food"), {
        existingNames: ["Chicken Soup"]
      });

      expect(result.readyCount).toBe(1);
    });
  });

  describe("header order", () => {
    it("warns when a header row is not in the documented order", () => {
      const swapped = parseMenuCsv(
        [
          "Item Name,Kashrut Type,Category,Allergies,Description,Food or Drink",
          "Dish,Parve,Main,,,Food"
        ].join("\n")
      );

      expect(swapped.headerMismatch).toContain(
        "does not match the expected order"
      );
      // Still parsed positionally, which is exactly why the warning matters:
      // nothing else here would notice a category reading "Parve".
      expect(swapped.rows[0]).toMatchObject({ category: "Parve" });
    });

    it("says nothing when the order is right", () => {
      expect(
        parseMenuCsv(sheet("Dish,Main,Parve,,,Food")).headerMismatch
      ).toBeNull();
    });
  });

  describe("size", () => {
    it("reports a file longer than the import cap and keeps the first rows", () => {
      const rows = Array.from(
        { length: MAX_MENU_CSV_ROWS + 5 },
        (_unused, index) => `Dish ${index},Main,Parve,,,Food`
      );
      const result = parseMenuCsv(sheet(...rows));

      expect(result.tooManyRows).toBe(true);
      expect(result.rows).toHaveLength(MAX_MENU_CSV_ROWS);
    });

    it("does not complain about a file within the cap", () => {
      expect(parseMenuCsv(sheet("Dish,Main,Parve,,,Food")).tooManyRows).toBe(
        false
      );
    });
  });
});

describe("buildMenuCsvTemplate", () => {
  it("round-trips through the parser it is a template for", () => {
    const result = parseMenuCsv(buildMenuCsvTemplate());

    expect(result.headerMismatch).toBeNull();
    expect(result.errorCount).toBe(0);
    expect(result.rows).toHaveLength(2);
    // The sample carries the multi-allergen cell the guide teaches, so this
    // also proves the template quotes it correctly.
    expect(result.rows[0]).toMatchObject({
      name: "Gefilte Fish",
      allergens: ["fish", "eggs"],
      kosherType: "Parve"
    });
    expect(result.rows[1]).toMatchObject({ kind: "Drink" });
  });
});
