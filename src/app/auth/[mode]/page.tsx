import { notFound } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
export default async function AuthPage({
  params,
}: {
  params: Promise<{ mode: string }>;
}) {
  const { mode } = await params;
  if (!["login", "signup", "forgot", "reset"].includes(mode)) notFound();
  return <AuthForm mode={mode as "login" | "signup" | "forgot" | "reset"} />;
}
