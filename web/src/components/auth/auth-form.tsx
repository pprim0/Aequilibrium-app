"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import type { AuthState } from "@/app/actions/auth";
import { t } from "@/i18n";

export function AuthForm({
  mode,
  action,
}: {
  mode: "signIn" | "signUp";
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const isSignIn = mode === "signIn";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label={t.auth.email} htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label={t.auth.password} htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={isSignIn ? "current-password" : "new-password"}
          minLength={isSignIn ? undefined : 8}
          required
        />
      </Field>
      {state?.error && (
        <p role="alert" className="rounded-[var(--radius-sm)] bg-error-pale px-3 py-2 text-sm text-error">
          {state.error}
        </p>
      )}
      {state?.message && (
        <p role="status" className="rounded-[var(--radius-sm)] bg-primary-pale px-3 py-2 text-sm text-success">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {isSignIn ? t.auth.signIn : t.auth.signUp}
      </Button>
      <p className="text-center text-sm text-text-2">
        {isSignIn ? t.auth.noAccount : t.auth.haveAccount}{" "}
        <Link href={isSignIn ? "/criar-conta" : "/entrar"} className="font-semibold text-primary underline-offset-2 hover:underline">
          {isSignIn ? t.auth.signUp : t.auth.signIn}
        </Link>
      </p>
    </form>
  );
}
