import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupportCenterPanel } from "@/features/support/components/support-center-panel";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  mutate: vi.fn(),
  resetError: vi.fn()
}));

vi.mock("@/features/dashboard/hooks/use-authenticated-query", () => ({
  useAuthenticatedQuery: () => ({
    data: {
      supportEmail: "support@eventcore.app",
      tickets: [
        {
          id: "ticket-1",
          reference: "EC-20260907-ABC123",
          subject: "Calendar is slow",
          description: "The calendar takes a long time to open.",
          category: "BUG",
          priority: "NORMAL",
          status: "SUBMITTED",
          pageUrl: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: {
            id: "user-1",
            name: "Sample User",
            email: "sample@example.com"
          }
        }
      ]
    },
    error: null,
    isLoading: false,
    isFetching: false,
    refetch: mocks.refetch
  })
}));

vi.mock("@/features/dashboard/hooks/use-authenticated-mutation", () => ({
  useAuthenticatedMutation: () => ({
    mutate: mocks.mutate,
    isPending: false,
    error: null,
    fieldErrors: {},
    requestId: "",
    resetError: mocks.resetError
  })
}));

vi.mock("@/lib/http/authenticated-fetch", () => ({
  authenticatedFetch: vi.fn()
}));

function PanelHarness() {
  const [formOpen, setFormOpen] = useState(false);

  return (
    <SupportCenterPanel
      formOpen={formOpen}
      onFormClose={() => setFormOpen(false)}
      onFormOpen={() => setFormOpen(true)}
    />
  );
}

describe("SupportCenterPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.refetch.mockResolvedValue(null);
    mocks.mutate.mockResolvedValue({
      ticket: {
        reference: "EC-20260907-NEW123"
      }
    });
    vi.mocked(authenticatedFetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        messages: [
          {
            id: "message-1",
            body: "We are checking this now.",
            isStaffReply: true,
            createdAt: new Date().toISOString(),
            author: { name: "Support" }
          }
        ]
      })
    } as Response);
  });

  it("resets the submitted reference when the report form is closed and reopened", async () => {
    render(<PanelHarness />);

    fireEvent.click(screen.getByRole("button", { name: /report a problem/i }));
    fireEvent.change(screen.getByLabelText(/problem title/i), {
      target: { value: "Calendar is slow" }
    });
    fireEvent.change(screen.getByLabelText(/what happened/i), {
      target: { value: "The calendar takes a long time to open after login." }
    });
    fireEvent.click(screen.getByRole("button", { name: /submit request/i }));

    expect(await screen.findByText("EC-20260907-NEW123")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /close report form/i }));
    fireEvent.click(screen.getByRole("button", { name: /report a problem/i }));

    expect(screen.queryByText("EC-20260907-NEW123")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/problem title/i)).toHaveValue("");
  });

  it("loads ticket messages only after a support request is expanded", async () => {
    render(<PanelHarness />);

    expect(authenticatedFetch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /calendar is slow/i }));

    await waitFor(() =>
      expect(authenticatedFetch).toHaveBeenCalledWith(
        "/api/support/tickets/ticket-1/messages"
      )
    );
    expect(await screen.findByText("We are checking this now.")).toBeInTheDocument();
  });
});
