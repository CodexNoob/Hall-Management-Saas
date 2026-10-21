-- Sign out after inactivity: the two columns that make it real.
--
-- `session_timeout_minutes` has been stored, validated and rendered as a
-- dropdown since the Security section shipped, and read by NOTHING. A control
-- that looks like a policy and changes no behaviour is worse than no control,
-- because somebody sets it to fifteen minutes and believes they are protected.
--
-- WHY `last_seen_at` COULD NOT BE THE SIGNAL, which is the whole reason this
-- migration exists. That column is touched by `POST /api/auth/session`, and the
-- dashboard calls that on a sixty-second poll whenever the tab is VISIBLE. Tab
-- visible is not user active: a screen left open on a desk refreshes itself
-- forever and would never time out, which is precisely the screen an idle
-- timeout exists for. `last_seen_at` answers "is this session still alive" and
-- must go on answering only that.
--
-- `last_active_at` is written only by a deliberate interaction ping - a click,
-- a keypress, a scroll - throttled hard in the browser, so it costs about one
-- request per five minutes per person who is actually working.
--
-- NULLABLE, AND THAT IS A SAFETY PROPERTY. Every session recorded before this
-- ran has no activity history, and a null must read as "cannot tell, leave them
-- alone" rather than as "idle since the epoch". The alternative signs out every
-- open session in every organization the moment this deploys.
ALTER TABLE "user_sessions" ADD COLUMN "last_active_at" TIMESTAMP(3);

-- A screen that is unattended BY DESIGN.
--
-- The kitchen board is mounted on a wall and nobody touches it for three hours
-- at a stretch; that is it working, not it being abandoned. Without an
-- exemption the cooks arrive at a login form in the middle of service.
--
-- PER DEVICE RATHER THAN PER ROLE, deliberately. It is a fact about the screen,
-- not about the person: the same cook on their own phone should time out like
-- anybody else. It also keeps the decision with a human who ticked a box that
-- was written to the audit trail, instead of buried in a role matrix where
-- nobody will find it - and it does not put a role name anywhere near an
-- authorization decision (INV-1).
ALTER TABLE "user_sessions"
  ADD COLUMN "shared_device" BOOLEAN NOT NULL DEFAULT false;
