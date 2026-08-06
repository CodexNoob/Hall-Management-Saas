"use client";

import { useMemo, useState } from "react";
import { formatStaffRole, initialsForName } from "@/features/administration/components/staff-dialog";
import type { StaffMember, StaffResponse, StaffStatus } from "@/features/administration/components/staff-shared";

const ROWS_PER_PAGE = 10;

export function useStaffDirectory(data: StaffResponse | null | undefined, searchQuery: string) {
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<"All" | StaffStatus>("All");
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const staffMembers = useMemo<StaffMember[]>(
    () =>
      (data?.staff ?? []).map((staff, index) => ({
        id: staff.id,
        initials: initialsForName(staff.name),
        name: staff.name,
        email: staff.email,
        department: staff.department,
        role: formatStaffRole(staff.role),
        status: staff.status,
        lastLogin: staff.lastLoginAt
          ? new Intl.DateTimeFormat("en-US", {
              dateStyle: "medium",
              timeStyle: "medium"
            }).format(new Date(staff.lastLoginAt))
          : "Never",
        phone: staff.phone ?? "Not provided",
        color: ["bg-[#397fc2]", "bg-[#4eb18c]", "bg-[#e4a332]", "bg-[#7665d5]"][index % 4],
        access: staff.access ?? null
      })),
    [data?.staff]
  );
  const departments = useMemo(
    () => ["All", ...Array.from(new Set(staffMembers.map((staff) => staff.department)))],
    [staffMembers]
  );
  const filteredStaff = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return staffMembers.filter((staff) =>
      (!query || `${staff.name} ${staff.email} ${staff.role} ${staff.department}`.toLowerCase().includes(query)) &&
      (departmentFilter === "All" || staff.department === departmentFilter) &&
      (statusFilter === "All" || staff.status === statusFilter)
    );
  }, [departmentFilter, searchQuery, staffMembers, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredStaff.length / ROWS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedStaff = filteredStaff.slice((safePage - 1) * ROWS_PER_PAGE, safePage * ROWS_PER_PAGE);
  const selectedStaff = staffMembers.find((staff) => staff.id === selectedStaffId) ?? staffMembers[0] ?? null;

  return {
    currentPage: safePage,
    departmentFilter,
    departments,
    filteredStaff,
    paginatedStaff,
    rowsPerPage: ROWS_PER_PAGE,
    selectedStaff,
    selectedStaffId,
    setCurrentPage,
    setDepartmentFilter,
    setSelectedStaffId,
    setStatusFilter,
    staffMembers,
    statusFilter,
    totalPages
  };
}
