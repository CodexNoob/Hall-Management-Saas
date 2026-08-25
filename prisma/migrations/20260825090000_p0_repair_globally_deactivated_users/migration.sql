-- P0-A step 9: repair users that the old DELETE /api/staff deactivated globally.
--
-- DELETE used to flip `users.is_active = false` with no tenant predicate, and
-- both `requireAuthenticatedUser` and `ensureProvisionedUser` reject on that flag
-- BEFORE any membership is consulted. So a person removed from one organization
-- was locked out of every organization, and P0-A removes the last code path that
-- could ever set the flag back.
--
-- THE OBVIOUS VERSION OF THIS MIGRATION IS WRONG. Repairing only users who still
-- hold an ACTIVE membership misses the common case: both old deactivation paths
-- cleared the membership flag too, so a single-organization user has no active
-- membership at migration time. They would stay `is_active = false` forever
-- while an administrator clicks Activate, the staff directory reports "Active"
-- (it now reads membership only), and sign-in keeps throwing "This account has
-- been deactivated." A permanent silent lockout with a UI saying the opposite.
--
-- Hence EXISTS over memberships with NO `m.is_active` filter: the test is "does
-- this person belong to any live organization at all", not "are they currently
-- enabled there". A genuinely removed employee stays locked out through their
-- inactive MEMBERSHIP, which is the only switch the staff screen owns now.

UPDATE public.users AS u
SET is_active = true, updated_at = NOW()
WHERE u.is_active = false
  AND EXISTS (
    SELECT 1
    FROM public.organization_memberships AS m
    JOIN public.organizations AS o ON o.id = m.organization_id
    WHERE m.user_id = u.id
      AND o.is_active = true
  );
