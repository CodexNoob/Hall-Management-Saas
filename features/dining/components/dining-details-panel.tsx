"use client";

import { CompactSelect } from "@/components/ui/compact-select";
import { LiveNumberField } from "@/components/ui/number-field";
import { countSchema } from "@/lib/validation/number";
import { FieldLabel, Panel } from "@/components/ui/panel";
import { SeatingRow } from "@/features/dining/components/dining-seating-row";
import {
  MAX_SEATS_PER_TABLE,
  MIN_SEATS_PER_TABLE,
  tableclothOptions,
  type DiningForm,
  type DiningTableData,
  type TableSide
} from "@/features/dining/components/dining-shared";
import { useAppLanguage } from "@/components/providers/app-language-provider";

type SeatTotals = Record<TableSide, number>;

type DiningDetailsPanelProps = {
  checkMessage: string;
  diningError: string | null;
  form: DiningForm;
  hasPresetCoordinates: boolean;
  isSaving: boolean;
  menRequired: number;
  seatsPerTable: number;
  seatTotals: SeatTotals;
  selectedTable: DiningTableData | null;
  selectedTableId: string | null;
  womenRequired: number;
  onAddRequiredTables: () => void;
  onAutoLayoutTables: () => void;
  onSeatsPerTableChange: (seats: number) => void;
  onSetCheckMessage: (message: string) => void;
  onSetTables: (updater: (current: DiningTableData[]) => DiningTableData[]) => void;
  onUpdateForm: <K extends keyof DiningForm>(
    field: K,
    value: DiningForm[K]
  ) => void;
};

export function DiningDetailsPanel({
  checkMessage,
  diningError,
  form,
  hasPresetCoordinates,
  isSaving,
  menRequired,
  seatsPerTable,
  seatTotals,
  selectedTable,
  selectedTableId,
  womenRequired,
  onAddRequiredTables,
  onAutoLayoutTables,
  onSeatsPerTableChange,
  onSetCheckMessage,
  onSetTables,
  onUpdateForm
}: DiningDetailsPanelProps) {
  const { t } = useAppLanguage();
  return (
    <Panel className="min-w-0 lg:col-span-2 xl:col-span-1">
      <header className="border-b border-[#d8dde5] px-3 py-2">
        <h2 className="text-sm font-black">{t("dining.details")}</h2>
        <p className="mt-1 text-xs text-[#617086]">
          {t("dining.detailsBlurb")}
        </p>
      </header>
      <div className="space-y-3 p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="count-type">{t("dining.countType")}</FieldLabel>
            <CompactSelect
              id="count-type"
              onChange={(value) =>
                onUpdateForm("countType", value as DiningForm["countType"])
              }
              options={[
                { label: "People", value: "People" },
                { label: "Couples", value: "Couples" }
              ]}
              value={form.countType}
            />
          </div>
          {[
            ["adultCount", t("dining.adults")],
            ["childrenCount", t("dining.children")],
            ["menWaiters", t("dining.menWaiters")],
            ["womenWaiters", t("dining.womenWaiters")]
          ].map(([field, label]) => (
            <div key={field}>
              <FieldLabel htmlFor={field}>{label}</FieldLabel>
              <LiveNumberField
                className="h-8 w-full rounded-lg border border-[#b9c2cf] px-2 text-xs sm:h-9 sm:text-sm"
                id={field}
                onCommit={(value) =>
                  onUpdateForm(
                    field as keyof Pick<
                      DiningForm,
                      | "adultCount"
                      | "childrenCount"
                      | "menWaiters"
                      | "womenWaiters"
                    >,
                    value
                  )
                }
                schema={countSchema({
                t,
                  max: field.endsWith("Waiters") ? 10_000 : 100_000,
                  label
                })}
                value={form[field as keyof DiningForm] as number}
              />
            </div>
          ))}
          <div>
            <FieldLabel htmlFor="tablecloth">{t("dining.tablecloth")}</FieldLabel>
            <CompactSelect
              id="tablecloth"
              onChange={(value) => onUpdateForm("tablecloth", value)}
              options={tableclothOptions.map((option) => ({
                label: option,
                value: option
              }))}
              value={form.tablecloth ?? ""}
            />
          </div>
          <div>
            <FieldLabel htmlFor="washing-time">{t("dining.washingStartTime")}</FieldLabel>
            <input
              className="h-8 w-full rounded-lg border border-[#b9c2cf] px-2 text-xs sm:h-9 sm:text-sm"
              id="washing-time"
              onChange={(event) =>
                onUpdateForm("washingTime", event.target.value)
              }
              type="time"
              value={form.washingTime}
            />
          </div>
        </div>

        {selectedTableId ? (
          <div className="rounded-lg border border-[#d8dde5] bg-[#fbfcfd] p-3">
            <p className="mb-2 text-xs font-black text-[#17202a]">
              {selectedTable?.name ?? t("dining.selectedTable")}
            </p>
            {hasPresetCoordinates ? (
              <p className="mb-3 text-[11px] font-medium text-[#617086]">
                {t("dining.presetHint")}
              </p>
            ) : null}
            <FieldLabel htmlFor="table-side">{t("dining.selectedTableUse")}</FieldLabel>
            <CompactSelect
              id="table-side"
              onChange={(value) =>
                onSetTables((current) =>
                  current.map((table) =>
                    table.id === selectedTableId
                      ? {
                          ...table,
                          isSeating: true,
                          side: value as TableSide
                        }
                      : table
                  )
                )
              }
              options={[
                { label: "Men", value: "men" },
                { label: "Women", value: "women" },
                { label: "Kids", value: "kids" },
                { label: t("dining.headTable"), value: "head" }
              ]}
              value={selectedTable?.side ?? "men"}
            />
          </div>
        ) : null}

        <section className="rounded-xl border border-[#d8dde5] bg-[#fbfcfd] p-3">
          <h3 className="text-[10px] font-black uppercase tracking-wider text-[#59677c]">
            {t("dining.seatingCheck")}
          </h3>

          {/* Sits above the seating rows because it is what their table counts
              are worked out from: a venue on 12-seat rounds needs fewer tables
              for the same guests than one on 10s. */}
          <div className="mt-3">
            <FieldLabel htmlFor="seats-per-table">{t("dining.seatsPerTable")}</FieldLabel>
            <LiveNumberField
              className="h-8 w-full rounded-lg border border-[#b9c2cf] px-2 text-xs sm:h-9 sm:text-sm"
              id="seats-per-table"
              onCommit={(value) => onSeatsPerTableChange(value)}
              schema={countSchema({
                t,
                label: t("dining.seatsPerTable"),
                max: MAX_SEATS_PER_TABLE,
                min: MIN_SEATS_PER_TABLE
              })}
              value={seatsPerTable}
            />
            <p className="mt-1 text-[10px] font-medium text-[#617086]">
              {t("dining.seatsPerTableHint")}
            </p>
          </div>

          <div className="mt-3 space-y-3">
            <SeatingRow
              current={seatTotals.men}
              label={t("dining.men")}
              maximum={menRequired}
            />
            <SeatingRow
              current={seatTotals.women}
              label={t("dining.women")}
              maximum={womenRequired}
            />
            <SeatingRow
              current={seatTotals.kids}
              label={t("dining.kids")}
              maximum={form.childrenCount}
            />
          </div>
          {checkMessage ? (
            <p className="mt-3 text-xs font-bold text-[#315573]">
              {checkMessage}
            </p>
          ) : null}
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <button
              className="h-9 min-w-0 whitespace-nowrap rounded-lg bg-[#1f4d73] px-3 text-[10px] font-black text-white hover:bg-[#15344f]"
              onClick={onAutoLayoutTables}
              type="button"
            >
              {t("dining.autoLayout")}
            </button>
            <button
              className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-2 text-[10px] font-black hover:bg-[#eef4fa]"
              onClick={() =>
                onSetCheckMessage(
                  seatTotals.men >= menRequired &&
                    seatTotals.women >= womenRequired &&
                    seatTotals.kids >= form.childrenCount
                    ? t("dining.seatingSufficient")
                    : t("dining.moreSeatingRequired")
                )
              }
              type="button"
            >
              {t("dining.checkSeating")}
            </button>
            <button
              className="h-9 min-w-0 whitespace-nowrap rounded-lg border border-[#b9c2cf] bg-white px-3 text-[10px] font-black hover:bg-[#eef4fa]"
              onClick={onAddRequiredTables}
              type="button"
            >
              {t("dining.addRequiredTables")}
            </button>
          </div>
        </section>

        <div>
          <FieldLabel htmlFor="special-notes">{t("dining.specialNotes")}</FieldLabel>
          <textarea
            className="min-h-20 w-full resize-y rounded-lg border border-[#b9c2cf] px-2 py-2 text-xs"
            id="special-notes"
            onChange={(event) =>
              onUpdateForm("specialNotes", event.target.value)
            }
            value={form.specialNotes}
          />
        </div>
        {diningError ? (
          <p className="text-xs font-bold text-[#b42318]">{diningError}</p>
        ) : null}
        <section className="rounded-lg border border-[#d8dde5] bg-[#f8fafc] p-3">
          <h3 className="text-[10px] font-black uppercase tracking-wider text-[#59677c]">
            {t("dining.planActions")}
          </h3>
          <p className="mt-1 text-xs font-medium leading-5 text-[#617086]">
            {t("dining.planActionsHint")}
          </p>
          {isSaving ? (
            <p className="mt-2 text-xs font-bold text-[#1f4d73]">
              {t("dining.savingPlan")}
            </p>
          ) : null}
        </section>
      </div>
    </Panel>
  );
}
