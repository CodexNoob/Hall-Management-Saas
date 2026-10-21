"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { initialsForName } from "@/features/administration/components/staff-dialog";
import type {
  StaffMember,
  StaffStatus
} from "@/features/administration/components/staff-shared";
import type { StaffResponse } from "@/features/access/components/access-shared";

const ROWS_PER_PAGE = 10;
const staffDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "medium"
});

/**
 * The directory's filtering and paging.
 *
 * The search term matches names, emails, departments AND the names of the roles
 * somebody holds - which now come from the assignments the server sent rather
 * than from a `role` string, so a tenant's own "Front Desk" is searchable the
 * moment it exists.
 */
export function useStaffDirectory(
  data: StaffResponse | null | undefined,
  searchQuery: string
) {
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<"All" | StaffStatus>("All");
  const [selectedPrincipalId, setSelectedPrincipalId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const staffMembers = useMemo<StaffMember[]>(
    () =>
      (data?.staff ?? []).map((staff, index) => ({
        userId: staff.userId,
        principalId: staff.principalId,
        initials: initialsForName(staff.name),
        name: staff.name,
        email: staff.email,
        department: staff.department,
        title: staff.title,
        status: staff.status,
        lastLogin: staff.lastLoginAt
          ? staffDateTimeFormatter.format(new Date(staff.lastLoginAt))
          : "",
        presence: staff.presence,
        lastSeenAt: staff.lastSeenAt,
        phone: staff.phone ?? "",
        color: ["bg-[#397fc2]", "bg-[#4eb18c]", "bg-[#e4a332]", "bg-[#7665d5]"][
          index % 4
        ],
        assignments: staff.assignments
      })),
    [data?.staff]
  );

  const departments = useMemo(
    () => [
      "All",
      ...Array.from(new Set(staffMembers.map((staff) => staff.department)))
    ],
    [staffMembers]
  );

  const filteredStaff = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();

    return staffMembers.filter((staff) => {
      const roleNames = staff.assignments
        .map((assignment) => assignment.roleName)
        .join(" ");
      const haystack =
        `${staff.name} ${staff.email} ${staff.department} ${roleNames}`.toLowerCase();

      return (
        (!query || haystack.includes(query)) &&
        (departmentFilter === "All" || staff.department === departmentFilter) &&
        (statusFilter === "All" || staff.status === statusFilter)
      );
    });
  }, [deferredSearchQuery, departmentFilter, staffMembers, statusFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredStaff.length / ROWS_PER_PAGE)
  );
  const safePage = Math.min(currentPage, totalPages);
  const paginatedStaff = filteredStaff.slice(
    (safePage - 1) * ROWS_PER_PAGE,
    safePage * ROWS_PER_PAGE
  );
  const selectedStaff =
    staffMembers.find((staff) => staff.principalId === selectedPrincipalId) ??
    staffMembers[0] ??
    null;

  return {
    currentPage: safePage,
    departmentFilter,
    departments,
    filteredStaff,
    paginatedStaff,
    rowsPerPage: ROWS_PER_PAGE,
    selectedStaff,
    selectedPrincipalId,
    setCurrentPage,
    setDepartmentFilter,
    setSelectedPrincipalId,
    setStatusFilter,
    staffMembers,
    statusFilter,
    totalPages
  };
}
