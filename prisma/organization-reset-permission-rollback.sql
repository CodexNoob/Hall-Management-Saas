-- Undo organization-reset-permission.sql: take the Reset panel back off Owner.
--
-- Removes only the grant that file makes - `organization.reset` on roles keyed
-- `owner`. A tenant who has since ticked the key onto a role of their own keeps
-- it, because that was their decision rather than this migration's.
--
-- The Reset panel renders nothing for anyone without the key, so this is enough
-- to withdraw the feature without deploying anything.
--
-- IDEMPOTENT. Deletes rows that may already be gone.

BEGIN;

DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.key = 'owner'
  AND p.key = 'organization.reset';

COMMIT;
