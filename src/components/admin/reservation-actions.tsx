"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Ban, Check, CheckCircle2, UserX } from "lucide-react";
import {
  cancelReservation,
  updateStayStatus,
  type ReservationActionState,
} from "@/app/admin/(dashboard)/reservations/[id]/actions";
import type { ReservationStatus } from "@/types/database";

const INITIAL: ReservationActionState = { status: "idle" };

function Feedback({ state }: { state: ReservationActionState }) {
  if (state.status === "idle") return null;

  const error = state.status === "error";
  return (
    <p
      role={error ? "alert" : "status"}
      className={`mt-3 flex items-start gap-2 border p-3 text-xs leading-relaxed ${
        error
          ? "border-danger/30 bg-danger/8 text-brown"
          : "border-palm/30 bg-palm/8 text-brown"
      }`}
    >
      {error ? (
        <AlertCircle size={15} className="mt-px shrink-0 text-danger" />
      ) : (
        <CheckCircle2 size={15} className="mt-px shrink-0 text-palm" />
      )}
      {state.message}
    </p>
  );
}

function PendingButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {children}
    </button>
  );
}

/**
 * Actions sur une réservation.
 *
 * Le champ `version` accompagne chaque envoi : c'est lui qui permet au serveur
 * de détecter qu'un collègue a modifié la fiche entre l'affichage et le clic.
 * Sans ce garde-fou, deux réceptionnistes travaillant en même temps peuvent
 * s'écraser mutuellement sans que personne ne s'en aperçoive.
 */
export function ReservationActions({
  id,
  version,
  status,
}: {
  id: string;
  version: number;
  status: ReservationStatus;
}) {
  const [cancelState, cancelAction] = useActionState(cancelReservation, INITIAL);
  const [statusState, statusAction] = useActionState(updateStayStatus, INITIAL);
  const [confirming, setConfirming] = useState(false);

  const closed = ["cancelled", "expired", "completed"].includes(status);

  return (
    <section className="border border-ivory-line bg-cream p-6">
      <h2 className="font-display text-lg">Actions</h2>

      {closed ? (
        <p className="mt-4 text-sm text-brown-soft">
          Cette réservation est clôturée. Aucune action n&apos;est disponible.
        </p>
      ) : (
        <>
          {status !== "confirmed" ? (
            <form action={statusAction} className="mt-4">
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="version" value={version} />
              <input type="hidden" name="status" value="confirmed" />
              <PendingButton className="btn btn-outline w-full">
                <Check size={14} />
                Marquer confirmée
              </PendingButton>
            </form>
          ) : null}

          <form action={statusAction} className="mt-2">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="version" value={version} />
            <input type="hidden" name="status" value="completed" />
            <PendingButton className="btn btn-outline w-full">
              <CheckCircle2 size={14} />
              Séjour terminé
            </PendingButton>
          </form>

          <form action={statusAction} className="mt-2">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="version" value={version} />
            <input type="hidden" name="status" value="no_show" />
            <PendingButton className="btn btn-outline w-full">
              <UserX size={14} />
              Client non présenté
            </PendingButton>
          </form>

          <Feedback state={statusState} />

          <div className="mt-5 border-t border-ivory-line pt-5">
            {!confirming ? (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="flex w-full items-center justify-center gap-2 py-2 text-xs uppercase tracking-wider text-danger transition-colors hover:text-brown"
              >
                <Ban size={14} />
                Annuler la réservation
              </button>
            ) : (
              <form action={cancelAction} className="space-y-3">
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="version" value={version} />

                <p className="text-xs leading-relaxed text-brown-soft">
                  L&apos;annulation remet la chambre en vente immédiatement.
                  Cette action est tracée.
                </p>

                <label className="block">
                  <span className="mb-1.5 block text-xs uppercase tracking-wider text-brown-soft">
                    Motif
                  </span>
                  <input
                    name="reason"
                    required
                    minLength={3}
                    maxLength={200}
                    autoFocus
                    placeholder="Demande du client, double saisie…"
                    className="field"
                  />
                </label>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="btn btn-outline flex-1"
                  >
                    Retour
                  </button>
                  <PendingButton className="btn btn-primary flex-1">
                    Confirmer
                  </PendingButton>
                </div>
              </form>
            )}
            <Feedback state={cancelState} />
          </div>
        </>
      )}
    </section>
  );
}
