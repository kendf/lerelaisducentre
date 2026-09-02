"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, ShieldCheck, UserRound } from "lucide-react";
import {
  setStaffActive,
  setStaffRole,
  type StaffState,
} from "@/app/admin/(dashboard)/utilisateurs/actions";
import type { StaffRole } from "@/types/database";

const INITIAL: StaffState = { status: "idle" };

const ROLE_LABEL: Record<StaffRole, string> = {
  receptionist: "Réception",
  manager: "Gérance",
  admin: "Administration",
};

function SubmitLink({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-xs uppercase tracking-wider text-brown-soft transition-colors hover:text-bronze disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function StaffList({
  members,
  currentId,
}: {
  members: Array<{
    id: string;
    full_name: string;
    email: string;
    role: StaffRole;
    is_active: boolean;
    created_at: string;
  }>;
  currentId: string;
}) {
  const [activeState, activeAction] = useActionState(setStaffActive, INITIAL);
  const [roleState, roleAction] = useActionState(setStaffRole, INITIAL);

  const feedback =
    activeState.status !== "idle"
      ? activeState
      : roleState.status !== "idle"
        ? roleState
        : null;

  return (
    <>
      {feedback ? (
        <p
          role={feedback.status === "error" ? "alert" : "status"}
          className={`mb-4 flex items-start gap-2 border p-3.5 text-sm ${
            feedback.status === "error"
              ? "border-danger/30 bg-danger/8"
              : "border-palm/30 bg-palm/8"
          }`}
        >
          {feedback.status === "error" ? (
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-danger" />
          ) : (
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-palm" />
          )}
          {feedback.message}
        </p>
      ) : null}

      <ul className="divide-y divide-ivory-line border border-ivory-line bg-cream">
        {members.map((member) => {
          const isSelf = member.id === currentId;

          return (
            <li
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-4 p-5"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm">
                  {member.role === "receptionist" ? (
                    <UserRound size={15} className="shrink-0 text-bronze-soft" />
                  ) : (
                    <ShieldCheck size={15} className="shrink-0 text-bronze" />
                  )}
                  {member.full_name}
                  {isSelf ? (
                    <span className="text-xs text-brown-soft">(vous)</span>
                  ) : null}
                  {!member.is_active ? (
                    <span className="text-xs text-danger">· désactivé</span>
                  ) : null}
                </p>
                <p className="mt-0.5 truncate text-xs text-brown-soft">
                  {member.email} · {ROLE_LABEL[member.role]}
                </p>
              </div>

              {/* Son propre compte n'est pas modifiable ici : c'est ce qui
                  empêche l'administrateur de se retirer ses propres droits et
                  de fermer la porte de l'intérieur. */}
              {isSelf ? (
                <span className="text-xs text-brown-soft">
                  Votre compte se modifie ailleurs
                </span>
              ) : (
                <div className="flex flex-wrap items-center gap-4">
                  {/* Trois rôles : un sélecteur, pas une bascule. Le changement
                      part à la sélection — pas de bouton « valider » séparé pour
                      une action à un seul champ. */}
                  <form action={roleAction}>
                    <input type="hidden" name="id" value={member.id} />
                    <label className="flex items-center gap-2 text-xs text-brown-soft">
                      <span className="sr-only">
                        Rôle de {member.full_name}
                      </span>
                      <select
                        name="role"
                        defaultValue={member.role}
                        onChange={(e) => e.currentTarget.form?.requestSubmit()}
                        className="border border-ivory-line bg-cream px-2 py-1.5 text-xs text-brown"
                      >
                        <option value="receptionist">Réception</option>
                        <option value="manager">Gérance</option>
                        <option value="admin">Administration</option>
                      </select>
                    </label>
                    <noscript>
                      <SubmitLink>Appliquer</SubmitLink>
                    </noscript>
                  </form>

                  <form action={activeAction}>
                    <input type="hidden" name="id" value={member.id} />
                    <input
                      type="hidden"
                      name="active"
                      value={member.is_active ? "false" : "true"}
                    />
                    <SubmitLink>
                      {member.is_active ? "Désactiver" : "Réactiver"}
                    </SubmitLink>
                  </form>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
