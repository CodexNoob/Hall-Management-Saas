import { NextResponse } from "next/server";
import {
  getBearerToken,
  resolveAssuranceLevel,
  resolveSupabaseUser
} from "@/lib/auth/identity";
import { mfaObligation, syncMfaEnrollment } from "@/lib/auth/mfa";
import { reconcileMfaFactors } from "@/lib/auth/mfa-trust";
import {
  DEVICE_COOKIE,
  deviceCookieOptions,
  isDeviceConfirmationEnforced,
  readDeviceSecret
} from "@/lib/auth/device-identity";
import {
  findCurrentDevice,
  recordDeviceMfaVerified,
  registerDeviceSighting
} from "@/lib/auth/device-trust";
import {
  isDeviceTrusted,
  isMfaRememberedOnDevice
} from "@/lib/auth/device-trust-policy";
import { readRegionalSettings } from "@/lib/dates/regional-settings";
import { readInactivityTimeout } from "@/lib/auth/inactivity";
import { parseSupabaseProfile } from "@/lib/auth/supabase-profile";
import { ensureProvisionedUser } from "@/lib/auth/provisioning";
import {
  readRequestIp,
  readRequestLocation,
  readSessionId,
  touchUserSession
} from "@/lib/auth/session-record";
import {
  readAppLanguage,
  serializeAuthSession,
  widestScope,
  type DeviceTrustState
} from "@/lib/auth/session-context";
import { effectiveAccessByPrincipal } from "@/lib/authz/decide";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { AuthorizationError } from "@/lib/auth/errors";
import type { PermissionKey } from "@/lib/authz/catalog";
import { log } from "@/lib/logging/context";
import { withRoute } from "@/lib/http/with-route";
import { prisma } from "@/lib/prisma";

/**
 * Just-in-time provisioning for a signed-in Supabase account.
 *
 * The handler is deliberately four steps with no branches of its own -
 * verify, read, reconcile, serialize. Everything that used to make this file
 * 290 lines now lives in a module that can be tested on its own:
 *
 *   lib/auth/identity.ts         - which credential, and is it real
 *   lib/auth/supabase-profile.ts - what Supabase says about the account
 *   lib/auth/provisioning.ts     - what our database needs to look like
 *   lib/auth/session-context.ts  - what the browser gets back
 *
 * Every expected failure is an `AuthorizationError` subclass carrying its own
 * status and its own copy - the 403 text in particular is shown to the user
 * verbatim by `getAuthErrorMessage`, so it must survive the trip out.
 */
export const POST = withRoute(
  "POST /api/auth/session",
  async (request: Request) => {
    try {
      // A PER-PAGE-LOAD READ, NOT AN ACTION.
      //
      // Every other limiter in this app guards something a person does on
      // purpose - an import, an invite, a checkout - so a tight allowance over a
      // long window is right: nobody legitimately invites ten people a minute.
      // This endpoint is the opposite. It is what `fetchAuthSession` calls on
      // every cold dashboard load whose 5-minute client cache has lapsed, so its
      // traffic scales with how many people are looking at the dashboard rather
      // than with anything they chose to do.
      //
      // The bucket is keyed by IP (lib/security/rate-limit.ts), and a venue's
      // staff all share one. At 30 per 10 minutes an office of more than about
      // fifteen locked ITSELF out - "Too many requests" in place of the whole
      // dashboard, for ten minutes, with no action to point at. The window is a
      // minute now for the same reason: a burst that does trip this recovers
      // while somebody is still looking at the retry button, instead of poisoning
      // the next ten minutes.
      //
      // Still a real flood guard. A request only reaches here with a bearer token
      // that costs a Supabase user lookup to verify, and 2/second per address
      // caps that regardless of how many tabs are asking.
      const limited = await enforceRateLimit(request, {
        scope: "auth-session",
        limit: 120,
        windowMs: 60_000
      });
      if (limited) return limited;

      const token = getBearerToken(request);

      if (!token) {
        return NextResponse.json(
          { error: "Missing bearer token." },
          { status: 401 }
        );
      }

      // Kept rather than inlined: `parseSupabaseProfile` narrows to the fields
      // provisioning needs, and the factor list is not one of them.
      const supabaseUser = await resolveSupabaseUser(token);
      const profile = parseSupabaseProfile(supabaseUser);
      const context = await ensureProvisionedUser(profile);

      // The organization this response tells the client to START in - the user's
      // primary one, not whatever a stale cookie last hinted at. `memberships` is
      // guaranteed non-empty: `ensureProvisionedUser` throws when it is not.
      const active =
        context.memberships.find(
          (membership) =>
            membership.organizationId === context.user.organizationId
        ) ?? context.memberships[0];

      // The same resolver, the same rows, the same fold the server enforces with.
      // What the browser is told and what a route decides cannot disagree, because
      // there is only one place either could come from (INV-2).
      const access = await effectiveAccessByPrincipal(
        active.principalId,
        active.organizationId,
        active.organization.permissionsEpoch
      );
      const organizationSettings = await prisma.organizationSetting.findUnique({
        where: { organizationId: active.organizationId },
        select: {
          language: true,
          twoFactorRequired: true,
          sessionTimeoutMinutes: true,
          // How this organization writes a date and a time. Read for the
          // organization the session resolved to - `active.organizationId` -
          // and never for one the browser named, which is what keeps one
          // tenant's format out of another's screens.
          timezone: true,
          integrations: true
        }
      });

      /**
       * The two-factor mirror, refreshed from the list Supabase just gave us.
       *
       * This endpoint is the right place for it and costs nothing extra:
       * `resolveSupabaseUser` above already fetched the full user, and
       * `factors` comes back on it. Enrolment also pokes
       * `POST /api/me/mfa/sync` directly so the mirror is right immediately
       * rather than at the next cold load - this is the one that heals a
       * factor removed from the Supabase dashboard, or from another device.
       *
       * AND THE ONE THAT CATCHES A FACTOR ATTACHED OUTSIDE OUR UI. Somebody
       * with a stolen password can call Supabase's enroll directly and never
       * touch `/api/me/mfa`; this sync still sees the factor, finds no
       * email-verified grant behind it, and removes it (lib/auth/mfa-trust.ts).
       * Only TRUSTED factors reach the mirror.
       */
      const sessionId = readSessionId(token);
      const assuranceLevel = await resolveAssuranceLevel(token);
      let enrolled = Boolean(context.user.mfaEnrolledAt);

      try {
        const trust = await reconcileMfaFactors({
          userId: context.user.id,
          supabaseAuthId: supabaseUser.id,
          factors: supabaseUser.factors,
          sessionId,
          audit: {
            organizationId: active.organizationId,
            userId: context.user.id,
            actorName: context.user.name
          },
          owner: { email: context.user.email, name: context.user.name }
        });

        enrolled = trust.trusted;

        await syncMfaEnrollment(prisma, {
          userId: context.user.id,
          enrolled,
          enrolledAt: new Date()
        });
      } catch (mirrorError) {
        /**
         * Swallowed, and it is worth being explicit about the trade.
         *
         * Throwing here would fail the one request the dashboard cannot load
         * without - so a write problem on a bookkeeping column would read to
         * every user as "the application is down". Nobody is made safer by
         * that: the session is already valid, and every other route enforces
         * off whatever the mirror currently says either way.
         *
         * Logged rather than silent, because a mirror that has stopped
         * updating is exactly the state somebody would later report as "2FA
         * isn't being asked for" - and this line is the only thing that would
         * explain it.
         */
        log.warn({ err: String(mirrorError) }, "mfa_mirror_not_updated");
      }

      const requiredByOrganization = Boolean(
        organizationSettings?.twoFactorRequired
      );

      /**
       * THIS browser's device as it stood before this request - the same row
       * `resolveUserActor` reads, so the obligation below and the server's
       * refusal agree. A failed read remembers nothing: the person is asked
       * for the code, which is the safe direction.
       */
      const deviceSecret = readDeviceSecret(request);
      const now = new Date();
      let priorDevice: Awaited<ReturnType<typeof findCurrentDevice>> = null;

      try {
        priorDevice = await findCurrentDevice(
          prisma,
          context.user.id,
          deviceSecret
        );
      } catch (deviceReadError) {
        log.warn({ err: String(deviceReadError) }, "device_read_failed");
      }

      const rememberedOnDevice = isMfaRememberedOnDevice({
        device: priorDevice,
        mfaEnrolledAt: context.user.mfaEnrolledAt,
        now
      });
      const obligation = mfaObligation({
        assuranceLevel,
        enrolled,
        requiredByOrganization,
        rememberedOnDevice
      });

      // The decision worth reconstructing when somebody asks "why was I not
      // asked for my code?" - only when the memory is what satisfied it.
      if (
        enrolled &&
        assuranceLevel !== "aal2" &&
        obligation === "satisfied"
      ) {
        log.info({ userId: context.user.id }, "mfa_satisfied_by_trusted_device");
      }

      /**
       * WHICH BROWSER IS THIS, and has its owner confirmed it.
       *
       * First sight of a browser for this person records it as a new,
       * untrusted device. A browser with no device cookie gets a fresh secret,
       * planted below in an httpOnly cookie; only its HMAC is stored, and the
       * secret never appears in this response's body.
       *
       * THE ORDER IS PASSWORD, 2FA, DEVICE. The confirmation email is only
       * sent once the session owes no second factor (`notify`), and only once
       * per sign-in (lib/auth/device-trust.ts). A trusted device skips the
       * email code; it skips the authenticator only where that is remembered
       * and the organization does not require 2FA (above). An expired device
       * is treated as a new one.
       *
       * Never fails the sync. If the sighting cannot be recorded while the
       * gate is enforced, the browser is told a confirmation is required: the
       * API would refuse this device's requests anyway, and a gate that says
       * so beats a dashboard of 403s.
       */
      const enforceDevice = isDeviceConfirmationEnforced();
      let device: DeviceTrustState | undefined;
      let newDeviceSecret: string | null = null;
      let deviceId: string | null = null;

      try {
        const sighting = await registerDeviceSighting(prisma, {
          userId: context.user.id,
          organizationId: active.organizationId,
          sessionId,
          secret: deviceSecret,
          userAgent: request.headers.get("user-agent"),
          ipAddress: readRequestIp(request),
          ...readRequestLocation(request),
          owner: { email: context.user.email, name: context.user.name },
          notify: obligation === "satisfied",
          now
        });

        device = {
          known: sighting.device.known,
          trusted: sighting.device.trusted,
          pendingConfirmation: sighting.device.pendingConfirmation,
          // Trusted, not merely confirmed once: an expired device is gated.
          confirmationRequired: enforceDevice && !sighting.device.trusted
        };
        deviceId = sighting.device.id;
        newDeviceSecret = sighting.newSecret;

        /**
         * The authenticator was cleared on a device that is ALREADY trusted -
         * 2FA set up after this browser was confirmed, or a factor replaced.
         * Remember it here for the rest of the trust period. A device being
         * confirmed right now remembers it in `confirmDevice` instead.
         *
         * Evaluated against the factor's time as of THIS request when it was
         * only just trusted, so a fresh factor is never treated as already
         * remembered.
         */
        if (
          enrolled &&
          assuranceLevel === "aal2" &&
          priorDevice &&
          priorDevice.id === sighting.device.id &&
          isDeviceTrusted(priorDevice, now) &&
          !isMfaRememberedOnDevice({
            device: priorDevice,
            mfaEnrolledAt: context.user.mfaEnrolledAt ?? now,
            now
          })
        ) {
          try {
            await recordDeviceMfaVerified(prisma, {
              userId: context.user.id,
              deviceId: priorDevice.id,
              now
            });
          } catch (rememberError) {
            // Only convenience is lost: the next sign-in asks for the code.
            log.warn(
              { err: String(rememberError) },
              "device_mfa_not_remembered"
            );
          }
        }
      } catch (deviceError) {
        log.warn({ err: String(deviceError) }, "device_sighting_failed");

        if (enforceDevice) {
          device = {
            known: false,
            trusted: false,
            pendingConfirmation: false,
            confirmationRequired: true
          };
        }
      }

      // Link the heartbeat to the device so bulk sign-out can preserve the
      // primary device without preserving other sessions from the same user.
      // Omit deviceId on a failed sighting to retain any earlier association.
      const sessionRow = sessionId
        ? await touchUserSession(prisma, {
            userId: context.user.id,
            sessionId,
            ...(deviceId ? { deviceId } : {}),
            userAgent: request.headers.get("user-agent"),
            ipAddress: readRequestIp(request),
            ...readRequestLocation(request)
          })
        : null;

      const response = NextResponse.json(
        serializeAuthSession({
          ...context,
          // Sorted so a re-fetch that changed nothing produces a byte-identical
          // cache entry, and the browser's own comparison stays trivial.
          permissions: [...access.permissions.keys()].sort() as PermissionKey[],
          scope: widestScope(access.permissions.values()),
          epoch: Number(active.organization.permissionsEpoch),
          usesEmailPassword: profile.usesEmailPassword,
          language: readAppLanguage(organizationSettings?.language) ?? "en-US",
          // Wins over the organization's when set - see `serializeAuthSession`.
          userLanguage: readAppLanguage(context.user.language),
          // Parsed rather than passed through: date and time format live in a
          // `Json?` column no migration constrains, so the shape is checked
          // here and anything unrecognised falls back to the documented
          // defaults instead of reaching a formatter.
          /**
           * The inactivity policy, for the browser's countdown.
           *
           * A HINT, never the control - `resolveUserActor` refuses an idle
           * session on its own authority. Sent because a warning dialog nobody
           * can draw is a sign-out with no notice, and the person it happens to
           * is mid-sentence in a booking form.
           *
           * `sharedDevice` comes off the row `touchUserSession` just wrote, so
           * the exemption a kitchen board set on itself travels with it.
           */
          inactivity: {
            timeoutMinutes: readInactivityTimeout(
              organizationSettings?.sessionTimeoutMinutes
            ),
            sharedDevice: sessionRow?.sharedDevice ?? false
          },
          regional: readRegionalSettings({
            language: organizationSettings?.language,
            timezone: organizationSettings?.timezone,
            integrations: organizationSettings?.integrations
          }),
          /**
           * What this session still owes on the second factor.
           *
           * This route is exempt from the check that refuses everything else,
           * and it has to be: it is the one endpoint that can tell the browser
           * WHY it is being refused. If it were gated too, a person who owes a
           * factor would get a 403 from the call that would have told them to
           * enter a code, and the dashboard would have nothing to render but a
           * generic failure.
           */
          mfa: { enrolled, requiredByOrganization, obligation },
          // Four booleans - never the device id, hash or secret. The
          // serializer rebuilds them, so nothing else can ride along.
          device
        })
      );

      // The one place the raw device secret travels: its own httpOnly cookie.
      if (newDeviceSecret) {
        response.cookies.set(
          DEVICE_COOKIE,
          newDeviceSecret,
          deviceCookieOptions(new URL(request.url).protocol === "https:")
        );
      }

      return response;
    } catch (error) {
      if (error instanceof AuthorizationError) {
        // `code` alongside the prose, because the two refusals that are terminal -
        // no invitation, deactivated account - have to be told apart from a
        // transient 500 by the caller. The browser ends the Supabase session on
        // those, and it must not decide that by matching on a message.
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.status }
        );
      }

      log.error(
        {
          err:
            error instanceof Error
              ? { name: error.name, message: error.message, stack: error.stack }
              : { name: "NonError", message: String(error) },
          status: 500
        },
        "auth_session_request_failed"
      );

      // User-facing copy, deliberately left as it was. Renaming the route is a
      // code change; rewording what a user reads when sign-in breaks is a product
      // one, and `getAuthErrorMessage` surfaces this string verbatim.
      return NextResponse.json(
        { error: "Unable to sync the signed-in user. Please try again." },
        { status: 500 }
      );
    }
  }
);
