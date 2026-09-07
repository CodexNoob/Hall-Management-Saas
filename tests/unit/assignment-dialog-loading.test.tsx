import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssignmentDialog } from "@/features/access/components/assignment-dialog";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import type {
  RoleSummary,
  StaffEntry
} from "@/features/access/components/access-shared";

vi.mock("@/features/dashboard/hooks/use-authenticated-query", () => ({
  useAuthenticatedQuery: vi.fn(() => ({
    data: null,
    error: null,
    isFetching: false,
    isLoading: false,
    refetch: vi.fn()
  }))
}));

vi.mock("@/lib/http/authenticated-fetch", () => ({
  authenticatedFetch: vi.fn()
}));

const staff: StaffEntry = {
  userId: "user-1",
  principalId: "principal-1",
  membershipId: "membership-1",
  name: "Ada Staff",
  email: "ada@example.com",
  phone: null,
  department: "Kitchen",
  title: null,
  status: "Active",
  assignments: [],
  lastLoginAt: null,
  createdAt: "2026-09-01T00:00:00.000Z"
};

const role: RoleSummary = {
  id: "role-1",
  key: "kitchen-staff",
  name: "Kitchen Staff",
  description: null,
  rank: 30,
  isSystem: true,
  permissions: [],
  holderCount: 0
};

describe("AssignmentDialog role loading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticatedFetch).mockResolvedValue({
      ok: true
    } as Response);
  });

  it("selects the first role once lazy-loaded roles arrive", async () => {
    const onSaved = vi.fn();
    const onClose = vi.fn();
    const view = render(
      <AssignmentDialog
        canAssign
        epoch={3}
        isRolesLoading
        onClose={onClose}
        onSaved={onSaved}
        roles={[]}
        staff={staff}
      />
    );

    expect(screen.getByRole("button", { name: "Assign" })).toBeDisabled();

    view.rerender(
      <AssignmentDialog
        canAssign
        epoch={3}
        onClose={onClose}
        onSaved={onSaved}
        roles={[role]}
        staff={staff}
      />
    );

    await waitFor(() =>
      expect(screen.getByLabelText("Role")).toHaveValue(role.id)
    );

    fireEvent.click(screen.getByRole("button", { name: "Assign" }));

    await waitFor(() => expect(authenticatedFetch).toHaveBeenCalledTimes(1));
    const [, init] = vi.mocked(authenticatedFetch).mock.calls[0];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      principalId: staff.principalId,
      roleId: role.id,
      scope: { type: "org" }
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
