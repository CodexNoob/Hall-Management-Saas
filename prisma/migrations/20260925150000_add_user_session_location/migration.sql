-- Roughly where a session signed in from.
--
-- Read from the platform's own geolocation headers, which are on the request
-- already: Vercel resolves `x-vercel-ip-city` and `x-vercel-ip-country` at the
-- edge, and Cloudflare sets `cf-ipcountry`. So no IP address leaves our
-- infrastructure to answer the question, there is no vendor, no key and no
-- per-lookup cost - and nothing new to put through `trackedFetch`, because
-- there is no outbound call.
--
-- Both nullable, and they will be null in local development: there is no edge
-- in front of `next dev` to set the headers. A row with no location still
-- shows its device, its address and when it was last seen.
--
-- The country is the ISO code rather than a name, so the row can be rendered
-- in whichever language the reader has chosen.
ALTER TABLE "user_sessions" ADD COLUMN "city" TEXT;
ALTER TABLE "user_sessions" ADD COLUMN "country" TEXT;
