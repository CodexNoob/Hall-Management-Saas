import { AuthErrorView } from "@/features/auth/components/auth-error-view";

/**
 * A Server Component on purpose: the route handlers redirect here with
 * `error_code` / `error_description` on the query string, so the correct
 * message can be in the very first byte of HTML. The client half only handles
 * the URL fragment, which never reaches a server at all.
 */

function first(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

export default async function AuthErrorPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  return (
    <AuthErrorView
      initial={{
        type: null,
        errorCode: first(params.error_code),
        errorDescription:
          first(params.error_description) ?? first(params.error),
        next: null
      }}
    />
  );
}
