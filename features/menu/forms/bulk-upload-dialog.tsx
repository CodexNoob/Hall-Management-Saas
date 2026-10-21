"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent
} from "react";
import {
  MENU_CSV_COLUMNS,
  MENU_CSV_SAMPLE_ROWS,
  MAX_MENU_CSV_ROWS,
  buildMenuCsvTemplate,
  parseMenuCsv,
  type MenuCsvParseResult,
  type MenuCsvRow
} from "@/features/menu/lib/menu-csv";
import {
  MENU_XLSX_MIME,
  buildMenuXlsxTemplate
} from "@/features/menu/lib/menu-xlsx";
import {
  COUNT_BASES,
  COUNT_BASIS_KEYS,
  COUNTING_UNITS,
  DEFAULT_SEGMENT,
  ROUNDING_MODES,
  ROUNDING_MODE_KEYS,
  serviceFormDefaults,
  toServiceRules,
  type MenuItemKind,
  type ServiceRuleFormValues,
  type ServiceStyle,
  type ServiceStyleFormValues
} from "@/features/menu/lib/service-style";
import {
  importMenuItems,
  type MenuItemImportInput
} from "@/features/menu/services/menu-items";
import { useAppLanguage } from "@/components/providers/app-language-provider";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * A file bigger than this is not a menu. Checked before reading rather than
 * after, so a stray video does not get pulled into memory to be rejected.
 */
const MAX_FILE_BYTES = 1024 * 1024;

/**
 * The import applies ONE rule to every row, and a sheet mixes food and drink -
 * each row carries its own kind, but the rule above them does not. So it anchors
 * on the food vocabulary rather than picking a kind it cannot know here; a
 * drink imported this way is corrected by editing it, the same as any other
 * per-row detail the sheet does not carry.
 */
const IMPORT_RULE_DEFAULTS = serviceFormDefaults("Food");

type Step = "format" | "upload" | "review";

const STEPS: Array<{ id: Step; titleKey: MessageKey }> = [
  { id: "format", titleKey: "menu.stepSetUpSheet" },
  { id: "upload", titleKey: "menu.stepChooseFile" },
  { id: "review", titleKey: "menu.stepReview" }
];

type BulkUploadDialogProps = {
  open: boolean;
  onClose: () => void;
  /**
   * Awaited before the dialog reports success, so the grid has already
   * refetched by the time the operator is told how many items were created.
   */
  onImported: (count: number) => void | Promise<void>;
  /**
   * Set when the dialog was opened from a service tab, exactly as
   * `NewLibraryItemDialog` uses it: an import started from Buffet Menu should
   * produce buffet items, not a library nobody asked for.
   */
  defaultServiceStyle?: ServiceStyle;
  /**
   * What a blank "Food or Drink" column means, for the same reason as above: an
   * import started from Drink Menu should produce drinks, not a food library
   * the operator then has to reclassify row by row.
   */
  defaultKind?: MenuItemKind;
  /** The catalog as it stands, so the review step can flag repeats. */
  existingNames: string[];
};

const controlClass =
  "h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm text-[#17202a] outline-none transition focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15";

const cellClass = "border-b border-r border-[#d8dde5] px-2 py-1.5 align-top";

function UploadIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M12 16V4m0 0L8 8m4-4 4 4" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </svg>
  );
}

/**
 * The client asked for "step by step with visuals", and this is the visual: a
 * sheet that looks like the one they are about to build, column letters and
 * all.
 *
 * Rendered from `MENU_CSV_COLUMNS` rather than drawn as a screenshot, so the
 * picture cannot drift from what the parser accepts - a stale screenshot of a
 * column order is worse than no picture, because it is believed.
 */
function SampleSheet() {
  return (
    <div className="overflow-x-auto rounded-lg border border-[#b9c2cf]">
      <table className="w-full min-w-160 border-collapse text-left text-xs">
        <thead>
          <tr className="bg-[#e4e8ee]">
            <th
              className={`${cellClass} w-7 text-center text-[10px] font-black text-[#8a94a3]`}
            />
            {MENU_CSV_COLUMNS.map((column) => (
              <th
                className={`${cellClass} text-center text-[10px] font-black text-[#8a94a3]`}
                key={column.letter}
                scope="col"
              >
                {column.letter}
              </th>
            ))}
          </tr>
          <tr className="bg-[#f5f6f8]">
            <td
              className={`${cellClass} text-center text-[10px] font-black text-[#8a94a3]`}
            >
              1
            </td>
            {MENU_CSV_COLUMNS.map((column) => (
              <td
                className={`${cellClass} font-black text-[#17202a]`}
                key={column.header}
              >
                {column.header}
                {column.required ? (
                  <span aria-hidden="true" className="text-[#b42318]">
                    {" *"}
                  </span>
                ) : null}
              </td>
            ))}
          </tr>
        </thead>
        <tbody>
          {MENU_CSV_SAMPLE_ROWS.map((row, rowIndex) => (
            <tr className="bg-white" key={row[0]}>
              <td
                className={`${cellClass} bg-[#f5f6f8] text-center text-[10px] font-black text-[#8a94a3]`}
              >
                {rowIndex + 2}
              </td>
              {MENU_CSV_COLUMNS.map((column, columnIndex) => (
                <td
                  className={`${cellClass} text-[#17202a]`}
                  key={column.letter}
                >
                  {row[columnIndex] || (
                    <span className="text-[#b9c2cf]">—</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ROW_TONES: Record<MenuCsvRow["status"], string> = {
  ready: "bg-[#e8f3ec] text-[#1c6b3f]",
  duplicate: "bg-[#fdf2dc] text-[#8a5a06]",
  error: "bg-[#fdeceb] text-[#b42318]"
};

const ROW_LABELS: Record<MenuCsvRow["status"], MessageKey> = {
  ready: "menu.willImport",
  duplicate: "menu.rowDuplicate",
  error: "menu.rowProblem"
};

function ReviewTable({ rows }: { rows: MenuCsvRow[] }) {
  const { t } = useAppLanguage();

  return (
    <div className="max-h-64 overflow-auto rounded-lg border border-[#d8dde5]">
      <table className="w-full min-w-140 border-collapse text-left text-xs">
        <thead className="sticky top-0 bg-[#f5f6f8]">
          <tr>
            {(
              [
                "menu.colLine",
                "menu.itemName",
                "menu.colCategory",
                "menu.colKashrut",
                "menu.allergies",
                "common.status"
              ] satisfies MessageKey[]
            ).map((heading) => (
              <th
                className="border-b border-[#d8dde5] px-2 py-1.5 font-black text-[#64748b]"
                key={heading}
                scope="col"
              >
                {t(heading)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="bg-white" key={row.line}>
              <td className="border-b border-[#d8dde5] px-2 py-1.5 text-[#8a94a3]">
                {row.line}
              </td>
              <td className="border-b border-[#d8dde5] px-2 py-1.5 font-bold text-[#17202a]">
                {row.name || <span className="text-[#b9c2cf]">—</span>}
              </td>
              <td className="border-b border-[#d8dde5] px-2 py-1.5 text-[#617086]">
                {row.category ?? "—"}
              </td>
              <td className="border-b border-[#d8dde5] px-2 py-1.5 text-[#617086]">
                {row.kosherType ?? "—"}
              </td>
              <td className="border-b border-[#d8dde5] px-2 py-1.5 text-[#617086]">
                {row.allergens.join(", ") || "—"}
              </td>
              <td className="border-b border-[#d8dde5] px-2 py-1.5">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-black ${ROW_TONES[row.status]}`}
                >
                  {t(ROW_LABELS[row.status])}
                </span>
                {row.message ? (
                  <span className="ml-2 text-[11px] text-[#617086]">
                    {row.message}
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The counting rule the whole file is imported with.
 *
 * The same fields as the "Served as" block in `NewLibraryItemDialog`, asked
 * once instead of per dish: a CSV that carried seven rule columns per row would
 * be a sheet nobody fills in correctly, and a buffet import that set no rule at
 * all would put every dish on a tab that cannot cook it.
 */
function ServiceRuleFields({
  style,
  values,
  onChange
}: {
  style: ServiceStyle;
  values: ServiceRuleFormValues;
  onChange: (patch: Partial<ServiceRuleFormValues>) => void;
}) {
  const { t } = useAppLanguage();

  return (
    <fieldset className="rounded-lg border border-[#d8dde5] p-2">
      <legend className="px-1 text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b]">
        Serve every imported item as {style}
      </legend>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <input
          aria-label={t("menu.quantityFor", { label: style })}
          className={`${controlClass} w-20`}
          inputMode="decimal"
          onChange={(event) => onChange({ quantity: event.target.value })}
          required
          value={values.quantity}
        />
        <select
          aria-label={t("menu.unitFor", { label: style })}
          className={`${controlClass} w-28`}
          onChange={(event) => onChange({ unit: event.target.value })}
          value={values.unit}
        >
          {COUNTING_UNITS.map((unit) => (
            <option key={unit}>{unit}</option>
          ))}
        </select>
        <span className="text-xs font-black text-[#6a7483]">{t("menu.per")}</span>
        {/* A whole-event rule divides nothing, so the count is not asked for -
            the same branch the single-item dialog makes. */}
        {values.perBasis === "Event" ? null : (
          <input
            aria-label={t("menu.perQuantity", { label: style })}
            className={`${controlClass} w-20`}
            inputMode="numeric"
            onChange={(event) => onChange({ per: event.target.value })}
            required
            value={values.per}
          />
        )}
        <select
          aria-label={t("menu.perBasis", { label: style })}
          className={`${controlClass} w-32`}
          onChange={(event) => onChange({ perBasis: event.target.value })}
          value={values.perBasis}
        >
          {COUNT_BASES.map((basis) => (
            <option key={basis} value={basis}>
              {t(COUNT_BASIS_KEYS[basis])}
            </option>
          ))}
        </select>
        <select
          aria-label={t("menu.roundingFor", { label: style })}
          className={`${controlClass} w-32`}
          onChange={(event) => onChange({ rounding: event.target.value })}
          value={values.rounding}
        >
          {ROUNDING_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {t(ROUNDING_MODE_KEYS[mode])}
            </option>
          ))}
        </select>
        <input
          aria-label={t("menu.minimumFor", { label: style })}
          className={`${controlClass} w-28`}
          inputMode="numeric"
          onChange={(event) => onChange({ minimumUnits: event.target.value })}
          placeholder={t("menu.minOpt")}
          value={values.minimumUnits}
        />
      </div>
      <p className="mt-1.5 text-[10px] font-bold text-[#6a7483]">
        {t("menu.ruleAppliesToAll")}
      </p>
    </fieldset>
  );
}

export function BulkUploadDialog({
  defaultKind,
  defaultServiceStyle,
  existingNames,
  onClose,
  onImported,
  open
}: BulkUploadDialogProps) {
  const { t } = useAppLanguage();
  const titleId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Tracks the closed -> open edge, so a parent re-render cannot throw away a
  // file the operator already picked. Same guard as `NewLibraryItemDialog`.
  const wasOpenRef = useRef(false);
  const [step, setStep] = useState<Step>("format");
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<MenuCsvParseResult | null>(null);
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const [serviceValues, setServiceValues] = useState<ServiceRuleFormValues>(
    IMPORT_RULE_DEFAULTS.Buffet
  );
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  const reset = useCallback(() => {
    setStep("format");
    setFileName("");
    setResult(null);
    setIncludeDuplicates(false);
    setServiceValues(
      defaultServiceStyle
        ? IMPORT_RULE_DEFAULTS[defaultServiceStyle]
        : IMPORT_RULE_DEFAULTS.Buffet
    );
    setIsImporting(false);
    setError(null);
    setImportedCount(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [defaultServiceStyle]);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }

    if (!wasOpenRef.current) {
      wasOpenRef.current = true;
      reset();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open, reset]);

  if (!open) return null;

  const closeAndReset = () => {
    reset();
    onClose();
  };

  const download = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadCsvTemplate = () => {
    download(
      new Blob([buildMenuCsvTemplate()], { type: "text/csv;charset=utf-8;" }),
      "event-core-menu-template.csv"
    );
  };

  /**
   * The same sheet with the closed columns as dropdowns, built in the browser -
   * a static file in `public/` would be one more copy of the column order to
   * keep in step with the parser, and this one cannot drift.
   */
  const downloadXlsxTemplate = () => {
    download(
      new Blob([buildMenuXlsxTemplate()], { type: MENU_XLSX_MIME }),
      "event-core-menu-template.xlsx"
    );
  };

  const readFile = async (file: File) => {
    setError(null);

    if (file.size > MAX_FILE_BYTES) {
      setError(
        t("menu.fileTooLarge")
      );
      return;
    }

    try {
      const parsed = parseMenuCsv(await file.text(), {
        t,
        defaultKind,
        existingNames
      });

      setFileName(file.name);
      setResult(parsed);
      setStep("review");
    } catch {
      setError(t("menu.fileUnreadable"));
    }
  };

  const importable = result
    ? result.rows.filter(
        (row) =>
          row.status === "ready" ||
          (includeDuplicates && row.status === "duplicate")
      )
    : [];

  const handleSubmit = async (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    if (isImporting || importable.length === 0) return;

    setIsImporting(true);
    setError(null);

    try {
      // Parsed before anything is sent, and it throws rather than coercing -
      // a silent zero here would tell the kitchen to cook nothing for every
      // dish in the file at once.
      const services = defaultServiceStyle
        ? toServiceRules({
            ...IMPORT_RULE_DEFAULTS,
            [defaultServiceStyle]: { ...serviceValues, enabled: true }
          } as ServiceStyleFormValues)
        : [];

      const items: MenuItemImportInput[] = importable.map((row) => ({
        name: row.name,
        category: row.category,
        // The business segment, not the service style - the same value
        // `saveLibraryItem` sets, because the CSV has no column for it.
        usageType: DEFAULT_SEGMENT,
        kind: row.kind,
        kosherType: row.kosherType,
        allergens: row.allergens,
        notes: row.notes,
        services
      }));

      const imported = await importMenuItems(items);

      // Awaited before the count is shown, so the grid behind the dialog is
      // already holding the rows the message claims.
      await onImported(imported);
      setImportedCount(imported);
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : t("menu.importFailed")
      );
    } finally {
      setIsImporting(false);
    }
  };

  const stepIndex = STEPS.findIndex((entry) => entry.id === step);

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-[#17202a]/30 p-3 sm:p-5"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.currentTarget === mouseEvent.target) closeAndReset();
      }}
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="flex max-h-[calc(100dvh-24px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-2xl shadow-[#17202a]/20"
        role="dialog"
      >
        <header className="flex items-center justify-between gap-4 border-b border-[#d8dde5] px-4 py-3">
          <div className="flex items-center gap-3">
            <UploadIcon />
            <h2 className="text-base font-black text-[#17202a]" id={titleId}>
              {t("menu.bulkUploadItems")}
            </h2>
          </div>
          <button
            aria-label={t("menu.closeBulkUpload")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#17202a] hover:bg-[#eef4fa]"
            onClick={closeAndReset}
            type="button"
          >
            <svg
              aria-hidden="true"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                d="M5 5 19 19M19 5 5 19"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2.25"
              />
            </svg>
          </button>
        </header>

        {importedCount === null ? (
          <nav
            aria-label={t("menu.bulkUploadSteps")}
            className="flex shrink-0 flex-wrap gap-2 border-b border-[#d8dde5] bg-[#fbfcfd] px-4 py-2"
          >
            {STEPS.map((entry, index) => (
              <span
                className={`inline-flex items-center gap-1.5 text-[11px] font-black ${
                  index === stepIndex
                    ? "text-[#1f4d73]"
                    : index < stepIndex
                      ? "text-[#617086]"
                      : "text-[#b9c2cf]"
                }`}
                key={entry.id}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                    index <= stepIndex
                      ? "bg-[#1f4d73] text-white"
                      : "bg-[#e4e8ee] text-[#8a94a3]"
                  }`}
                >
                  {index + 1}
                </span>
                {t(entry.titleKey)}
              </span>
            ))}
          </nav>
        ) : null}

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {importedCount !== null ? (
              <div className="grid gap-2 py-4 text-center">
                <p className="text-2xl font-black text-[#17202a]">
                  {importedCount} {importedCount === 1 ? "item" : "items"}{" "}
                  imported
                </p>
                <p className="text-sm text-[#617086]">
                  {t("menu.picturesPerItem")}
                </p>
              </div>
            ) : null}

            {importedCount === null && step === "format" ? (
              <div className="grid gap-3">
                <p className="text-sm text-[#617086]">
                  {t("menu.columnsByPosition")}
                </p>

                <SampleSheet />

                <dl className="grid gap-1.5">
                  {MENU_CSV_COLUMNS.map((column) => (
                    <div className="flex gap-2 text-xs" key={column.letter}>
                      <dt className="w-32 shrink-0 font-black text-[#17202a]">
                        {column.letter} — {column.header}
                      </dt>
                      <dd className="text-[#617086]">{t(column.helpKey)}</dd>
                    </div>
                  ))}
                </dl>

                <div className="rounded-lg bg-[#eef4fa] px-3 py-2">
                  <p className="text-xs font-black text-[#1f4d73]">
                    {t("menu.savingFromExcel")}
                  </p>
                  <ol className="mt-1 grid list-decimal gap-0.5 pl-4 text-xs text-[#17202a]">
                    <li>{t("menu.headingsInRow1")}</li>
                    <li>{t("menu.oneDishPerRow")}</li>
                    <li>
                      {t("menu.saveAsCsvStep")}
                    </li>
                  </ol>
                </div>

                <p className="text-xs text-[#617086]">
                  {t("menu.picturesNotInFile", { max: MAX_MENU_CSV_ROWS })}
                </p>

                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-lg border border-[#b9c2cf] bg-white px-4 py-2 text-xs font-black text-[#17202a] hover:bg-[#eef4fa]"
                    onClick={downloadCsvTemplate}
                    type="button"
                  >
                    {t("menu.downloadTemplateCsv")}
                  </button>
                  <button
                    className="rounded-lg border border-[#1f4d73] bg-white px-4 py-2 text-xs font-black text-[#1f4d73] hover:bg-[#eef4fa]"
                    onClick={downloadXlsxTemplate}
                    type="button"
                  >
                    {t("menu.downloadTemplateXlsx")}
                  </button>
                </div>

                <p className="text-xs text-[#617086]">
                  {t("menu.xlsxHint")}
                </p>
              </div>
            ) : null}

            {importedCount === null && step === "upload" ? (
              <div className="grid gap-3">
                <p className="text-sm text-[#617086]">
                  {t("menu.chooseSavedCsv")}
                </p>
                <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b]">
                  {t("menu.csvFile")}
                  <input
                    accept=".csv,text/csv"
                    className="mt-1 block h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-2 py-1 text-sm font-medium normal-case tracking-normal text-[#17202a] file:mr-2 file:rounded-sm file:border file:border-[#8a94a3] file:bg-[#f5f6f8] file:px-2 file:py-0.5"
                    name="menuCsv"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void readFile(file);
                    }}
                    ref={fileInputRef}
                    type="file"
                  />
                </label>
              </div>
            ) : null}

            {importedCount === null && step === "review" && result ? (
              <div className="grid gap-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <p className="text-sm font-black text-[#17202a]">
                    {fileName}
                  </p>
                  <p className="text-xs text-[#617086]">
                    {result.readyCount} ready · {result.duplicateCount} already
                    in your menu · {result.errorCount}{" "}
                    {result.errorCount === 1 ? "problem" : "problems"}
                  </p>
                </div>

                {result.headerMismatch ? (
                  <p
                    className="rounded-lg bg-[#fdeceb] px-3 py-2 text-xs font-bold text-[#b42318]"
                    role="alert"
                  >
                    {result.headerMismatch}
                  </p>
                ) : null}

                {result.tooManyRows ? (
                  <p className="rounded-lg bg-[#fdf2dc] px-3 py-2 text-xs font-bold text-[#8a5a06]">
                    Only the first {MAX_MENU_CSV_ROWS} rows are shown. Split the
                    sheet and upload the rest separately.
                  </p>
                ) : null}

                <ReviewTable rows={result.rows} />

                {result.duplicateCount > 0 ? (
                  <label className="flex items-center gap-2 text-xs font-bold text-[#17202a]">
                    <input
                      checked={includeDuplicates}
                      className="h-4 w-4"
                      name="includeDuplicates"
                      onChange={(event) =>
                        setIncludeDuplicates(event.target.checked)
                      }
                      type="checkbox"
                    />
                    Import the {result.duplicateCount} duplicate{" "}
                    {result.duplicateCount === 1 ? "row" : "rows"} anyway
                  </label>
                ) : null}

                {defaultServiceStyle ? (
                  <ServiceRuleFields
                    onChange={(patch) =>
                      setServiceValues((current) => ({ ...current, ...patch }))
                    }
                    style={defaultServiceStyle}
                    values={serviceValues}
                  />
                ) : (
                  <p className="text-xs text-[#617086]">
                    {t("menu.addedToLibrary")}
                  </p>
                )}
              </div>
            ) : null}
          </div>

          <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[#d8dde5] bg-[#fbfcfd] px-4 py-3">
            {error ? (
              <p
                className="mr-auto text-xs font-bold text-[#b42318]"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            {importedCount === null && step !== "format" ? (
              <button
                className="mr-auto h-9 rounded-lg border border-[#b9c2cf] bg-white px-4 text-xs font-black text-[#17202a] hover:bg-[#eef4fa]"
                disabled={isImporting}
                onClick={() => {
                  setError(null);
                  setStep(step === "review" ? "upload" : "format");
                }}
                type="button"
              >
                {t("menu.back")}
              </button>
            ) : null}

            <button
              className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-4 text-xs font-black text-[#17202a] hover:bg-[#eef4fa]"
              onClick={closeAndReset}
              type="button"
            >
              {importedCount === null ? "Cancel" : "Close"}
            </button>

            {importedCount === null && step === "format" ? (
              <button
                className="h-9 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white shadow-sm hover:bg-[#15344f]"
                onClick={() => setStep("upload")}
                type="button"
              >
                {t("menu.sheetReady")}
              </button>
            ) : null}

            {importedCount === null && step === "review" ? (
              <button
                className="h-9 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white shadow-sm hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isImporting || importable.length === 0}
                type="submit"
              >
                {isImporting
                  ? t("menu.importing")
                  : t(
                      importable.length === 1
                        ? "menu.importItemCount"
                        : "menu.importItemCountPlural",
                      { count: importable.length }
                    )}
              </button>
            ) : null}
          </footer>
        </form>
      </section>
    </div>
  );
}
