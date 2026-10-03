"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="center-page">
      <h1>Something interrupted your workspace.</h1>
      <p>Your saved work is still there. Try loading this page again.</p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
