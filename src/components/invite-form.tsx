"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/client";
import { Button } from "./ui/button";
import { Brand } from "./shared";
export function InviteForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="center-page">
      <Brand />
      <h1>You’ve got a place at the table.</h1>
      <p>Accept this invitation to join your team’s workspace.</p>
      {error && (
        <p role="alert" className="error-box">
          {error}
        </p>
      )}
      <Button
        disabled={busy || !token}
        onClick={async () => {
          setBusy(true);
          const result = await browserClient().rpc("accept_invite", { token });
          if (result.error) {
            setError(result.error.message);
            setBusy(false);
          } else {
            router.replace("/app");
            router.refresh();
          }
        }}
      >
        {busy ? "Joining…" : "Accept invitation"}
      </Button>
    </main>
  );
}
