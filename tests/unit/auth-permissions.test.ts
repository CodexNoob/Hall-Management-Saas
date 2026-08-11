import { describe, expect, it } from "vitest";
import { normalizeStaffRole } from "@/lib/auth/permissions";

describe("normalizeStaffRole", () => {
  it("passes through canonical role values unchanged", () => {
    expect(normalizeStaffRole("owner")).toBe("owner");
    expect(normalizeStaffRole("admin")).toBe("admin");
    expect(normalizeStaffRole("manager")).toBe("manager");
    expect(normalizeStaffRole("kitchen")).toBe("kitchen");
    expect(normalizeStaffRole("billing")).toBe("billing");
    expect(normalizeStaffRole("viewer")).toBe("viewer");
  });

  it("maps legacy alias spellings to their canonical role", () => {
    expect(normalizeStaffRole("superadmin")).toBe("owner");
    expect(normalizeStaffRole("administrator")).toBe("admin");
    expect(normalizeStaffRole("event manager")).toBe("manager");
    expect(normalizeStaffRole("eventmanager")).toBe("manager");
    expect(normalizeStaffRole("kitchen staff")).toBe("kitchen");
    expect(normalizeStaffRole("kitchenstaff")).toBe("kitchen");
    expect(normalizeStaffRole("billing staff")).toBe("billing");
    expect(normalizeStaffRole("billingstaff")).toBe("billing");
    expect(normalizeStaffRole("member")).toBe("viewer");
  });

  it("is case-insensitive and trims surrounding whitespace", () => {
    expect(normalizeStaffRole("  OWNER  ")).toBe("owner");
    expect(normalizeStaffRole("Event Manager")).toBe("manager");
    expect(normalizeStaffRole("KitchenStaff")).toBe("kitchen");
  });

  it("falls back to viewer for unrecognized role strings", () => {
    expect(normalizeStaffRole("cook")).toBe("viewer");
    expect(normalizeStaffRole("")).toBe("viewer");
  });

  it("falls back to viewer for nullish or non-string input", () => {
    expect(normalizeStaffRole(undefined)).toBe("viewer");
    expect(normalizeStaffRole(null)).toBe("viewer");
    expect(normalizeStaffRole(42)).toBe("viewer");
    expect(normalizeStaffRole({})).toBe("viewer");
  });
});
