-- 20260817143000_add_hall_map_shape_library_items creates this table with an
-- organization_id but no row-level security. Supabase grants the anon role
-- access to public tables by default and that key ships in the client bundle,
-- so without this every organization's shape library is readable and writable
-- by anyone holding it.
--
-- Deliberately unguarded: the migration that creates the table runs before this
-- one, so a missing table means something is wrong and should fail loudly
-- rather than skip the policy and leave the table exposed.
ALTER TABLE public.hall_map_shape_library_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.hall_map_shape_library_items FROM anon;

DROP POLICY IF EXISTS tenant_member_access ON public.hall_map_shape_library_items;

CREATE POLICY tenant_member_access
ON public.hall_map_shape_library_items
FOR ALL
TO authenticated
USING (public.is_organization_member(organization_id))
WITH CHECK (public.is_organization_member(organization_id));
