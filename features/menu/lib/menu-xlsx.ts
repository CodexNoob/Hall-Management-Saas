/**
 * The same template as `buildMenuCsvTemplate`, as a real spreadsheet.
 *
 * A CSV cannot carry a dropdown, so the CSV template can only *describe* what
 * the Kashrut Type and Food or Drink columns accept - and a typo in either is
 * an error the operator does not see until the review step tells them about
 * row 47. This one ships the accepted values as Excel data validation, so the
 * closed columns are picked rather than typed.
 *
 * Both templates read `MENU_CSV_COLUMNS` for their order and the same sample
 * rows for their contents, so the two downloads cannot describe different
 * sheets. What the parser accepts is still the CSV contract: this file is
 * filled in, then saved as CSV, which is why the values below are the ones
 * `parseMenuCsv` already understands.
 *
 * Written by hand rather than with a spreadsheet library: the whole workbook is
 * six small XML parts, and `buildZip` is what puts them in a container.
 *
 * Keep free of `server-only` and Prisma: the dialog imports it.
 */

import {
  KOSHER_TYPES,
  MAX_MENU_CSV_ROWS,
  MENU_CATEGORY_OPTIONS,
  MENU_CSV_COLUMNS,
  MENU_CSV_SAMPLE_ROWS
} from "@/features/menu/lib/menu-csv";
import { MENU_ITEM_KINDS } from "@/features/menu/lib/service-style";
import { buildZip } from "@/lib/utilities/zip";

/** What a browser must be told the blob is, or Excel is not offered to open it. */
export const MENU_XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const SHEET_NAME = "Menu items";

/**
 * The last row a dropdown reaches. One past the import cap, because row 1 is
 * the header - a sheet filled to the cap has its last dish on row 501.
 */
const LAST_VALIDATED_ROW = MAX_MENU_CSV_ROWS + 1;

/** Roughly the width each column's content wants, in characters. */
const COLUMN_WIDTHS = [30, 18, 16, 26, 40, 16];

/**
 * A column the operator picks from rather than types into.
 *
 * `strict` is the difference between a closed set and a suggestion. Kashrut and
 * kind are closed - the parser refuses anything else, so refusing it in the
 * sheet turns a failed import row into a dropdown the operator cannot get
 * wrong. Category is free text by design ("or your own"), so its list is
 * offered without being enforced.
 */
type ColumnValidation = {
  field: (typeof MENU_CSV_COLUMNS)[number]["field"];
  values: readonly string[];
  strict: boolean;
  prompt: string;
};

const VALIDATIONS: readonly ColumnValidation[] = [
  {
    field: "category",
    values: MENU_CATEGORY_OPTIONS,
    strict: false,
    prompt: "Pick one, type your own, or leave it blank for More."
  },
  {
    field: "kosherType",
    values: KOSHER_TYPES,
    strict: true,
    prompt: "Pick one, or leave it blank."
  },
  {
    field: "kind",
    values: MENU_ITEM_KINDS,
    strict: true,
    prompt: "Pick one. Blank means Food."
  }
];

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const XML_DECLARATION =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

/** Style 1 is the bold, shaded header; style 0 is everything else. */
const HEADER_STYLE = 1;

function cellXml(reference: string, value: string, style: number) {
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

/** Empty cells are left out entirely rather than written as blanks. */
function rowXml(number: number, values: readonly string[], style: number) {
  const cells = values
    .map((value, index) =>
      value
        ? cellXml(`${MENU_CSV_COLUMNS[index].letter}${number}`, value, style)
        : ""
    )
    .join("");

  return `<row r="${number}">${cells}</row>`;
}

function validationXml({ field, prompt, strict, values }: ColumnValidation) {
  const column = MENU_CSV_COLUMNS.find((entry) => entry.field === field);

  if (!column) throw new Error(`No template column for "${field}".`);

  const range = `${column.letter}2:${column.letter}${LAST_VALIDATED_ROW}`;
  const list = escapeXml(values.join(","));

  return (
    `<dataValidation type="list" allowBlank="1" showInputMessage="1"` +
    ` showErrorMessage="${strict ? 1 : 0}" errorStyle="stop"` +
    ` errorTitle="${escapeXml(column.header)}"` +
    ` error="${escapeXml(`Choose one of: ${values.join(", ")}.`)}"` +
    ` promptTitle="${escapeXml(column.header)}"` +
    ` prompt="${escapeXml(prompt)}" sqref="${range}">` +
    `<formula1>"${list}"</formula1></dataValidation>`
  );
}

function sheetXml() {
  const headers = MENU_CSV_COLUMNS.map((column) => column.header);
  const rows = [
    rowXml(1, headers, HEADER_STYLE),
    ...MENU_CSV_SAMPLE_ROWS.map((row, index) => rowXml(index + 2, row, 0))
  ].join("");

  const columns = COLUMN_WIDTHS.map(
    (width, index) =>
      `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`
  ).join("");

  const lastLetter = MENU_CSV_COLUMNS[MENU_CSV_COLUMNS.length - 1].letter;
  const validations = VALIDATIONS.map(validationXml).join("");

  return (
    `${XML_DECLARATION}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    // The cells that hold something, not the rows the dropdowns reach - a
    // dimension of 501 rows would open the file scrolled over empty space.
    `<dimension ref="A1:${lastLetter}${MENU_CSV_SAMPLE_ROWS.length + 1}"/>` +
    // The header stays put while the operator types their hundredth dish.
    `<sheetViews><sheetView tabSelected="1" workbookViewId="0">` +
    `<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>` +
    `</sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>` +
    `<cols>${columns}</cols>` +
    `<sheetData>${rows}</sheetData>` +
    // Must follow sheetData: the schema fixes the order of these elements.
    `<dataValidations count="${VALIDATIONS.length}">${validations}</dataValidations>` +
    `</worksheet>`
  );
}

const CONTENT_TYPES_XML =
  `${XML_DECLARATION}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
  `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
  `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
  `</Types>`;

const ROOT_RELS_XML =
  `${XML_DECLARATION}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
  `</Relationships>`;

const WORKBOOK_XML =
  `${XML_DECLARATION}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"` +
  ` xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
  `<sheets><sheet name="${SHEET_NAME}" sheetId="1" r:id="rId1"/></sheets>` +
  `</workbook>`;

const WORKBOOK_RELS_XML =
  `${XML_DECLARATION}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
  `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
  `</Relationships>`;

/**
 * The smallest stylesheet Excel accepts, plus the one style this sheet uses.
 *
 * The unused first fills and the empty border are not filler: the format
 * numbers styles by position, and a reader that finds fewer than it expects at
 * index 0 and 1 repairs the file rather than opening it.
 */
const STYLES_XML =
  `${XML_DECLARATION}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<fonts count="2">` +
  `<font><sz val="11"/><name val="Calibri"/></font>` +
  `<font><b/><sz val="11"/><name val="Calibri"/></font>` +
  `</fonts>` +
  `<fills count="3">` +
  `<fill><patternFill patternType="none"/></fill>` +
  `<fill><patternFill patternType="gray125"/></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFE4E8EE"/><bgColor indexed="64"/></patternFill></fill>` +
  `</fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="2">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>` +
  `</cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`;

/**
 * The file behind "Download template xlsx".
 *
 * Returns the bytes rather than a `Blob`, so the unit test can open it without
 * a DOM and the caller decides what to do with it.
 */
export function buildMenuXlsxTemplate() {
  const encoder = new TextEncoder();
  const parts: Array<[string, string]> = [
    ["[Content_Types].xml", CONTENT_TYPES_XML],
    ["_rels/.rels", ROOT_RELS_XML],
    ["xl/workbook.xml", WORKBOOK_XML],
    ["xl/_rels/workbook.xml.rels", WORKBOOK_RELS_XML],
    ["xl/styles.xml", STYLES_XML],
    ["xl/worksheets/sheet1.xml", sheetXml()]
  ];

  return buildZip(
    parts.map(([path, xml]) => ({ path, data: encoder.encode(xml) }))
  );
}
