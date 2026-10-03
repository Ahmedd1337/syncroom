"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Brand } from "./shared";
import { Button } from "./ui/button";
import { browserClient, configured } from "@/lib/supabase/client";
import { authSchema } from "@/lib/validation";
import { safeNext } from "@/lib/utils";
export function AuthForm({
  mode,
}: {
  mode: "login" | "signup" | "forgot" | "reset";
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState("");
  const [failure, setFailure] = useState(false);
  const schema = z
    .object({ email: z.string(), password: z.string(), full_name: z.string() })
    .superRefine((values, ctx) => {
      const relevant =
        mode === "forgot"
          ? authSchema.pick({ email: true })
          : mode === "reset"
            ? authSchema.pick({ password: true })
            : authSchema;
      const result = relevant.safeParse(values);
      if (!result.success)
        for (const issue of result.error.issues)
          ctx.addIssue({
            code: "custom",
            path: issue.path,
            message: issue.message,
          });
      if (mode === "signup" && values.full_name.trim().length < 2)
        ctx.addIssue({
          code: "custom",
          path: ["full_name"],
          message: "Enter your full name",
        });
    });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", full_name: "" },
  });
  const title = {
    login: "Welcome back.",
    signup: "Make room for your team.",
    forgot: "Let’s get you back in.",
    reset: "Choose a new password.",
  }[mode];
  async function submit(values: z.infer<typeof authSchema>) {
    setFeedback("");
    setFailure(false);
    try {
      const client = browserClient();
      const next = safeNext(
        new URLSearchParams(window.location.search).get("next"),
      );
      if (mode === "signup") {
        const { data: authData, error } = await client.auth.signUp({
          email: values.email,
          password: values.password,
          options: {
            data: { full_name: values.full_name },
            emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (error) throw error;
        if (authData.session) {
          router.replace(next);
          router.refresh();
          return;
        }
        setFeedback("Check your email to confirm your account, then sign in.");
      } else if (mode === "forgot") {
        const { error } = await client.auth.resetPasswordForEmail(
          values.email,
          { redirectTo: `${location.origin}/auth/callback?next=/auth/reset` },
        );
        if (error) throw error;
        setFeedback(
          "If this email has an account, a reset link is on its way.",
        );
      } else if (mode === "reset") {
        const { error } = await client.auth.updateUser({
          password: values.password,
        });
        if (error) throw error;
        router.replace("/app");
        router.refresh();
      } else {
        const { error } = await client.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });
        if (error) throw error;
        router.replace(next);
        router.refresh();
      }
    } catch (error) {
      setFailure(true);
      setFeedback(
        error instanceof Error
          ? error.message
          : "Could not complete this request. Try again.",
      );
    }
  }
  return (
    <main className="auth-page">
      <div className="auth-story">
        <Link href="/">
          <Brand />
        </Link>
        <div>
          <span className="eyebrow">A SHARED SPACE FOR GREAT WORK</span>
          <h1>
            Find your team.
            <br />
            Find your flow.
          </h1>
          <p>
            Conversations, ideas, and next steps.
            <br />
            Finally, in the same room.
          </p>
          <div className="auth-quote">
            “The best work happens when everyone has a place in the
            conversation.”<small>The idea behind SyncRoom</small>
          </div>
        </div>
        <span>Less switching. More sync.</span>
      </div>
      <div className="auth-panel">
        <div className="auth-card">
          <Link className="mobile-brand" href="/">
            <Brand />
          </Link>
          <h2>{title}</h2>
          <p className="muted">
            {mode === "signup"
              ? "Create your account. Your workspace comes next."
              : "Your team’s work, right where you left it."}
          </p>
          {!configured && (
            <div className="info-box">
              Live accounts need a Supabase connection. You can still{" "}
              <Link href="/demo">explore the interactive demo</Link>.
            </div>
          )}
          <form onSubmit={handleSubmit(submit)} className="form-stack">
            {mode === "signup" && (
              <label>
                Full name
                <input
                  autoComplete="name"
                  {...register("full_name", { required: true })}
                />
                <span className="field-error">{errors.full_name?.message}</span>
              </label>
            )}
            {mode !== "reset" && (
              <label>
                Email address
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  {...register("email")}
                />
                <span className="field-error">{errors.email?.message}</span>
              </label>
            )}
            {mode !== "forgot" && (
              <label>
                Password
                <input
                  type="password"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  placeholder="At least 10 characters"
                  {...register("password")}
                />
                <span className="field-error">{errors.password?.message}</span>
              </label>
            )}
            {feedback && (
              <p role="status" className={failure ? "error-box" : "info-box"}>
                {feedback}
              </p>
            )}
            <Button disabled={isSubmitting || !configured}>
              {isSubmitting
                ? "Please wait…"
                : {
                    login: "Log in",
                    signup: "Create account",
                    forgot: "Send reset link",
                    reset: "Update password",
                  }[mode]}
            </Button>
          </form>
          {mode === "login" && (
            <Link className="auth-secondary" href="/auth/forgot">
              Forgot your password?
            </Link>
          )}
          <div className="auth-bottom">
            {mode === "signup"
              ? "Already have an account?"
              : "New to SyncRoom?"}{" "}
            <Link
              href={mode === "signup" ? "/auth/login" : "/auth/signup"}
              onClick={(e) => {
                e.preventDefault();
                const next = safeNext(
                  new URLSearchParams(window.location.search).get("next"),
                );
                router.push(
                  `${mode === "signup" ? "/auth/login" : "/auth/signup"}?next=${encodeURIComponent(next)}`,
                );
              }}
            >
              {mode === "signup" ? "Log in" : "Create an account"}
            </Link>
          </div>
          <Link className="auth-secondary" href="/demo">
            Take a look around the demo
          </Link>
        </div>
      </div>
    </main>
  );
}
