import { redirect } from "next/navigation";
import { serverClient } from "@/lib/supabase/server";
import { InviteForm } from "@/components/invite-form";
export default async function Invite({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const client = await serverClient();
  const user = client ? await client.auth.getUser() : null;
  if (!user?.data.user)
    redirect(
      `/auth/login?next=${encodeURIComponent(`/invite?token=${token || ""}`)}`,
    );
  return <InviteForm token={token || ""} />;
}
