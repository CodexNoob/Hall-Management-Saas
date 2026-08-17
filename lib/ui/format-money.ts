/**
 * Currency formatting for integer cents.
 *
 * `money(cents)` was previously copy-pasted into feature folders
 * (features/clients/components/clients-shared.tsx and
 * features/billing/components/billing-reports-tab.tsx). The client portal needs
 * the same formatting but must not import out of the Clients feature, which is
 * not part of the intended product navigation - so the shared version lives
 * here.
 */
export function formatMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency
  }).format(cents / 100);
}

/** Prisma `Decimal` columns store dollars; the portal DTOs speak cents. */
export function decimalToCents(
  value: { toString(): string } | null | undefined
): number | null {
  if (value === null || value === undefined) return null;

  const parsed = Number(value.toString());

  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}
