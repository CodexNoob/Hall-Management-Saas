import { crc32 } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  KOSHER_TYPES,
  MAX_MENU_CSV_ROWS,
  MENU_CATEGORY_OPTIONS,
  MENU_CSV_COLUMNS,
  MENU_CSV_SAMPLE_ROWS
} from "@/features/menu/lib/menu-csv";
import { buildMenuXlsxTemplate } from "@/features/menu/lib/menu-xlsx";

/**
 * Reads the archive the way a spreadsheet does: through the central directory,
 * following each entry's recorded offset rather than walking the file front to
 * back. A writer that misreports an offset or a size produces something a
 * front-to-back reader still recovers and Excel still refuses, so the test
 * takes the route Excel takes.
 *
 * Stored entries only, which is all `buildZip` writes.
 */
function readZip(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  let end = bytes.length - 22;

  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end -= 1;

  expect(end, "no end-of-central-directory record").toBeGreaterThanOrEqual(0);

  const count = view.getUint16(end + 10, true);
  const directorySize = view.getUint32(end + 12, true);
  const directoryOffset = view.getUint32(end + 16, true);

  expect(directoryOffset + directorySize).toBe(end);

  const parts = new Map<string, string>();
  let cursor = directoryOffset;

  for (let index = 0; index < count; index += 1) {
    expect(view.getUint32(cursor, true)).toBe(0x02014b50);

    const method = view.getUint16(cursor + 10, true);
    const declaredCrc = view.getUint32(cursor + 16, true);
    const size = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = decoder.decode(
      bytes.subarray(cursor + 46, cursor + 46 + nameLength)
    );

    expect(method, `${name} is not stored`).toBe(0);
    expect(view.getUint32(localOffset, true)).toBe(0x04034b50);

    const start =
      localOffset +
      30 +
      view.getUint16(localOffset + 26, true) +
      view.getUint16(localOffset + 28, true);
    const data = bytes.subarray(start, start + size);

    // The check a reader makes before trusting the bytes at all.
    expect(crc32(data), `${name} checksum`).toBe(declaredCrc);

    parts.set(name, decoder.decode(data));
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return parts;
}

const parts = readZip(buildMenuXlsxTemplate());
const sheet = parts.get("xl/worksheets/sheet1.xml") ?? "";

/** The value a dropdown on the given column offers, as one attribute string. */
function validationFor(letter: string) {
  const match = sheet.match(
    new RegExp(
      `<dataValidation [^>]*sqref="${letter}2:${letter}\\d+"[^>]*>.*?</dataValidation>`
    )
  );

  return match?.[0] ?? "";
}

describe("buildMenuXlsxTemplate", () => {
  it("packages the parts a spreadsheet reader looks for", () => {
    expect([...parts.keys()].sort()).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/workbook.xml",
      "xl/worksheets/sheet1.xml"
    ]);
  });

  it("writes every part as well-formed XML", () => {
    for (const [name, xml] of parts) {
      const parsed = new DOMParser().parseFromString(xml, "application/xml");

      expect(
        parsed.querySelector("parsererror"),
        `${name} is not well-formed`
      ).toBeNull();
    }
  });

  it("carries the documented header row in the documented order", () => {
    const headers = [
      ...sheet.matchAll(/<c r="([A-F])1"[^>]*><is><t[^>]*>([^<]*)</g)
    ].map((match) => [match[1], match[2]]);

    expect(headers).toEqual(
      MENU_CSV_COLUMNS.map((column) => [column.letter, column.header])
    );
  });

  it("ships the same sample rows the guide and the CSV template show", () => {
    for (const row of MENU_CSV_SAMPLE_ROWS) {
      for (const value of row) {
        if (value) expect(sheet).toContain(`>${value}<`);
      }
    }
  });

  it("offers the kashrut values as a dropdown the sheet enforces", () => {
    const validation = validationFor("C");

    expect(validation).toContain(
      `<formula1>"${KOSHER_TYPES.join(",")}"</formula1>`
    );
    // A closed column: the parser refuses anything else, so the sheet does too.
    expect(validation).toContain('showErrorMessage="1"');
    // Blank stays legal - the column is optional.
    expect(validation).toContain('allowBlank="1"');
  });

  it("offers Food and Drink as a dropdown the sheet enforces", () => {
    const validation = validationFor("F");

    expect(validation).toContain('<formula1>"Food,Drink"</formula1>');
    expect(validation).toContain('showErrorMessage="1"');
  });

  it("suggests categories without refusing a hall's own", () => {
    const validation = validationFor("B");

    expect(validation).toContain(
      `<formula1>"${MENU_CATEGORY_OPTIONS.join(",")}"</formula1>`
    );
    // The column is free text by design, so the list must not be a gate.
    expect(validation).toContain('showErrorMessage="0"');
  });

  it("reaches every row the import will accept", () => {
    for (const letter of ["B", "C", "F"]) {
      expect(validationFor(letter)).toContain(
        `sqref="${letter}2:${letter}${MAX_MENU_CSV_ROWS + 1}"`
      );
    }
  });
});
