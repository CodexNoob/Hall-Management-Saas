import "@testing-library/jest-dom/vitest";

// The Supabase public credentials are required by lib/env.ts and are read at
// client construction by @supabase/ssr. Most suites mock the Supabase modules
// outright, but anything that reaches getEnv() or builds a real client would
// otherwise throw on a machine with no .env loaded.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
