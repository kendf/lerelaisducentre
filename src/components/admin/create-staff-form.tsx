"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import {
  createStaffAccount,
  type StaffState,
} from "@/app/admin/(dashboard)/utilisateurs/actions";

const INITIAL: StaffState = { status: "idle" };

/**
 * Mot de passe initial tiré au sort dans le navigateur.
 *
 * `crypto.getRandomValues` plutôt que `Math.random` : le second est prévisible
 * et n'a rien à faire dans la génération d'un secret. L'alphabet exclut les
 * caractères ambigus (I, l, 1, O, 0) — ce mot de passe sera dicté à voix haute
 * à une réceptionniste, pas copié-collé.
 */
function generatePassword(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => alphabet[n % alphabet.length]).join("");
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? "Création…" : "Créer le compte"}
    </button>
  );
}

export function CreateStaffForm() {
  const [state, formAction] = useActionState(createStaffAccount, INITIAL);
  const [password, setPassword] = useState("");

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-wider text-brown-soft">
            Nom complet
          </span>
          <input name="fullName" required minLength={3} className="field" />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-wider text-brown-soft">
            Adresse e-mail
          </span>
          <input type="email" name="email" required className="field" />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-wider text-brown-soft">
            Rôle
          </span>
          <select name="role" defaultValue="receptionist" className="field">
            <option value="receptionist">
              Réception — réservations, planning, messages
            </option>
            <option value="manager">
              Gérance — et tarifs, chambres, réglages
            </option>
            <option value="admin">
              Administration — et gestion des accès
            </option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-wider text-brown-soft">
            Mot de passe initial
          </span>
          <div className="flex gap-2">
            <input
              name="password"
              required
              minLength={10}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => setPassword(generatePassword())}
              className="shrink-0 px-2.5 text-brown-soft transition-colors hover:text-bronze"
              title="Proposer un mot de passe"
              aria-label="Proposer un mot de passe"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </label>
      </div>

      {state.status !== "idle" ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`flex items-start gap-2 border p-3.5 text-sm leading-relaxed ${
            state.status === "error"
              ? "border-danger/30 bg-danger/8"
              : "border-palm/30 bg-palm/8"
          }`}
        >
          {state.status === "error" ? (
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-danger" />
          ) : (
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-palm" />
          )}
          {state.message}
        </p>
      ) : null}

      <Submit />
    </form>
  );
}
