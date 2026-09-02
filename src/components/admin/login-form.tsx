"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, LogIn } from "lucide-react";
import { signIn, type LoginState } from "@/app/admin/login/actions";

const INITIAL: LoginState = { status: "idle" };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary w-full" disabled={pending}>
      <LogIn size={15} />
      {pending ? "Connexion…" : "Se connecter"}
    </button>
  );
}

export function LoginForm({ suite }: { suite: string }) {
  const [state, formAction] = useActionState(signIn, INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="suite" value={suite} />

      <label className="block">
        <span className="mb-1.5 block text-xs uppercase tracking-wider text-brown-soft">
          Adresse e-mail
        </span>
        <input
          type="email"
          name="email"
          required
          autoComplete="username"
          autoFocus
          className="field"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs uppercase tracking-wider text-brown-soft">
          Mot de passe
        </span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="field"
        />
      </label>

      {state.status === "error" ? (
        <p
          role="alert"
          className="flex items-start gap-2.5 border border-danger/30 bg-danger/8 p-3.5 text-sm"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-danger" />
          {state.message}
        </p>
      ) : null}

      <Submit />
    </form>
  );
}
