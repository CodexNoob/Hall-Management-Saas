export function normalizeRole(role: string | null | undefined) {
  return (role ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function isAdministrativeRole(role: string | null | undefined) {
  return ["owner", "admin", "administrator", "superadmin"].includes(
    normalizeRole(role)
  );
}
