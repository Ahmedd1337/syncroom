"use client";
import { createBrowserClient } from "@supabase/ssr";
function makeClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
let client: ReturnType<typeof makeClient> | undefined;
export const configured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
export function browserClient() {
  if (!configured)
    throw new Error(
      "Connect a Supabase project using the environment variables in .env.example.",
    );
  return (client ??= makeClient());
}
