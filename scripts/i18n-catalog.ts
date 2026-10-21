/**
 * The message catalog, out to a spreadsheet and back.
 *
 * The Spanish and Hebrew columns were written alongside the English rather than
 * by a native speaker, and they are in front of customers. Reviewing 2,500
 * entries means reading them in the order they appear on screen, which is not
 * something anyone should have to do inside nineteen TypeScript files - and a
 * reviewer who is fluent in Spanish is usually not fluent in `defineMessages`.
 *
 * So: `export` writes one row per key with all three languages side by side,
 * and `import` reads a corrected sheet back and rewrites the namespace files in
 * place. The key column is the join, so rows may be reordered, filtered or
 * split across sheets and still apply.
 *
 *   npm run i18n:export      # writes translations.csv
 *   npm run i18n:import      # reads it back
 *
 * `import` only ever replaces the text of an existing key. It will not add a
 * key, remove one, or touch the English - those are code changes, and a
 * spreadsheet is the wrong place to make them. Anything it refuses is listed
 * rather than skipped silently.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const NAMESPACE_DIR = path.join(ROOT, "lib", "i18n", "namespaces");
const COLUMNS = ["key", "english", "spanish", "hebrew"] as const;
/** Where a sheet goes when nobody names one. Git-ignored - it is a work file. */
const DEFAULT_FILE = "translations.csv";

type Row = { key: string; en: string; es: string; he: string };

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

/** A whole CSV file into rows of cells, quotes and embedded newlines included. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (quoted) {
      if (character !== '"') {
        cell += character;
        continue;
      }

      if (text[index + 1] === '"') {
        cell += '"';
        index += 1;
        continue;
      }

      quoted = false;
      continue;
    }

    if (character === '"') {
      quoted = true;
      continue;
    }

    if (character === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (character === "\r") continue;

    if (character === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += character;
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((entry) => entry.some((value) => value !== ""));
}

function namespaceFiles() {
  return readdirSync(NAMESPACE_DIR)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => path.join(NAMESPACE_DIR, name));
}

/**
 * Entries read straight out of the source rather than by importing the module.
 *
 * Importing would give the values but not their position in the file, and a
 * rewrite has to put the corrected text back exactly where it came from -
 * between the same comments, in the same order.
 */
/**
 * One pattern for both layouts.
 *
 * `\s` matches newlines, so a pattern written for the one-line form matches the
 * block form too - which is how the first version of this counted all 2,500
 * keys twice. The rewrite below tells them apart by looking for a newline in
 * the matched text rather than by having a second regex, so the two can never
 * drift into overlapping again.
 */
const ENTRY =
  /^([^\S\n]*)("(?:[^"\\]|\\.)*"):\s*\{\s*en:\s*("(?:[^"\\]|\\.)*"),\s*es:\s*("(?:[^"\\]|\\.)*"),\s*he:\s*("(?:[^"\\]|\\.)*")\s*\}/gm;

function readLiteral(value: string): string {
  return JSON.parse(value) as string;
}

function writeLiteral(value: string): string {
  return JSON.stringify(value);
}

function collect(): Row[] {
  const rows: Row[] = [];

  for (const file of namespaceFiles()) {
    const source = readFileSync(file, "utf8");

    for (const match of source.matchAll(ENTRY)) {
      rows.push({
        key: readLiteral(match[2]),
        en: readLiteral(match[3]),
        es: readLiteral(match[4]),
        he: readLiteral(match[5])
      });
    }
  }

  return rows.sort((left, right) => left.key.localeCompare(right.key));
}

function exportCatalog(target: string) {
  const rows = collect();
  const body = [
    COLUMNS.join(","),
    ...rows.map((row) =>
      [row.key, row.en, row.es, row.he].map(csvCell).join(",")
    )
  ].join("\n");

  // A BOM, because the reviewer is opening this in Excel and without one it
  // reads the Hebrew column as mojibake.
  writeFileSync(target, `﻿${body}\n`, "utf8");
  console.log(`Wrote ${rows.length} keys to ${target}`);
}

function importCatalog(source: string) {
  if (!existsSync(source)) {
    throw new Error(
      `${source} does not exist. Run \`npm run i18n:export\` first, edit the ` +
        `sheet, then import it back.`
    );
  }

  const text = readFileSync(source, "utf8").replace(/^﻿/, "");
  const [header, ...rows] = parseCsv(text);

  if (header?.[0]?.trim().toLowerCase() !== "key") {
    throw new Error(
      `${source} does not start with a "key" column. Export a fresh sheet and edit that.`
    );
  }

  const corrections = new Map<string, { es: string; he: string }>();

  for (const row of rows) {
    const [key, , es, he] = row;
    if (key) corrections.set(key, { es: es ?? "", he: he ?? "" });
  }

  const known = new Set(collect().map((row) => row.key));
  const unknown = [...corrections.keys()].filter((key) => !known.has(key));
  let changed = 0;

  for (const file of namespaceFiles()) {
    const before = readFileSync(file, "utf8");
    // The English is deliberately untouched: it is the source text, and
    // changing it is a code change that has to go through review like any
    // other.
    const after = before.replace(
      ENTRY,
      (whole: string, indent: string, key: string, en: string, es: string, he: string) => {
        const correction = corrections.get(readLiteral(key));

        if (!correction) return whole;

        // A blank cell means "leave this one alone", not "make it empty": a
        // reviewer working through 2,500 rows fills in the ones they have an
        // opinion about.
        const nextEs = correction.es || readLiteral(es);
        const nextHe = correction.he || readLiteral(he);

        if (nextEs === readLiteral(es) && nextHe === readLiteral(he)) {
          return whole;
        }

        changed += 1;

        // Written back in the layout it was found in, so a correction to one
        // key does not reformat the file around it.
        if (!whole.includes("\n")) {
          return `${indent}${key}: { en: ${en}, es: ${writeLiteral(nextEs)}, he: ${writeLiteral(nextHe)} }`;
        }

        const inner = `${indent}  `;

        return `${indent}${key}: {\n${inner}en: ${en},\n${inner}es: ${writeLiteral(nextEs)},\n${inner}he: ${writeLiteral(nextHe)}\n${indent}}`;
      }
    );

    if (after !== before) writeFileSync(file, after, "utf8");
  }

  console.log(`Updated ${changed} key(s).`);

  if (unknown.length) {
    // Named rather than skipped quietly: a key the sheet carries and the code
    // does not is almost always a rename the reviewer has not been told about,
    // and their correction would otherwise vanish.
    console.warn(
      `\n${unknown.length} key(s) in the sheet are not in the catalog and were ignored:`
    );
    for (const key of unknown) console.warn(`  ${key}`);
  }
}

const [mode, file] = process.argv.slice(2);

if (mode !== "export" && mode !== "import") {
  console.error(
    "Usage: i18n-catalog.ts export|import [file.csv]\n" +
      "  npm run i18n:export\n" +
      "  npm run i18n:import\n" +
      "\n" +
      `Both default to ${DEFAULT_FILE}. To use another name, npm needs the\n` +
      "separator before the argument, or it swallows it:\n" +
      "  npm run i18n:export -- some-other-name.csv"
  );
  process.exit(1);
}

/**
 * Defaulted rather than required.
 *
 * `npm run` eats a bare argument unless it is preceded by `--`, so asking for a
 * filename meant the obvious command failed with a message about a filename
 * rather than about the separator. The common case is one sheet going out and
 * the same sheet coming back, so it has a name of its own and the argument is
 * for when it does not.
 */
if (mode === "export") exportCatalog(file ?? DEFAULT_FILE);
else importCatalog(file ?? DEFAULT_FILE);
