export function getClientPortalUrl(eventId: string, browserOrigin: string) {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();
  let isLocalBrowser = false;

  try {
    const hostname = new URL(browserOrigin).hostname;
    isLocalBrowser =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]";
  } catch {
    // Fall through to the configured public origin for malformed origins.
  }

  const origin = (
    isLocalBrowser ? browserOrigin : configuredOrigin || browserOrigin
  ).replace(/\/+$/, "");

  return `${origin}/client/${encodeURIComponent(eventId)}`;
}
