import { redirect } from "next/navigation";
import Link from "next/link";
import { serverClient } from "@/lib/supabase/server";
import { WorkspaceApp } from "@/components/workspace-app";
import type { Snapshot } from "@/lib/types";
export default async function AppPage() {
  const client = await serverClient();
  if (!client)
    return (
      <main className="center-page">
        <h1>Your workspace is nearly ready.</h1>
        <p>
          Add your Supabase URL and publishable key to .env.local, then apply
          the included migration.
        </p>
        <Link className="btn btn-primary" href="/demo">
          Explore the demo
        </Link>
      </main>
    );
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect("/auth/login");
  const [profile, workspaces] = await Promise.all([
    client.from("profiles").select("*").eq("id", user.id).single(),
    client.from("workspaces").select("*").order("created_at"),
  ]);
  if (profile.error || workspaces.error)
    throw new Error(
      "Unable to load account. Check that the database migration has been applied.",
    );
  const initial: Snapshot = {
    profile: profile.data,
    workspaces: workspaces.data,
    members: [],
    channels: [],
    messages: [],
    tasks: [],
    notifications: [],
  };
  return <WorkspaceApp initial={initial} />;
}
