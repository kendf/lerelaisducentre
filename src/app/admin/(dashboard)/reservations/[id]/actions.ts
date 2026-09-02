"use server";

import { revalidatePath } from "next/cache";
import { createUserClient } from "@/lib/supabase/server";
import { getStaffMember } from "@/lib/auth";

export interface ReservationActionState {
  status: "idle" | "error" | "success";
  message?: string;
}

/**
 * Annulation d'une réservation depuis le back-office.
 *
 * `p_expected_version` porte le numéro de version affiché à l'écran. Si un
 * collègue a modifié la fiche entre-temps, la fonction SQL refuse au lieu
 * d'écraser son travail : deux réceptionnistes sur le même dossier ne peuvent
 * pas se contredire silencieusement.
 *
 * L'annulation libère l'inventaire immédiatement — c'est le déclencheur
 * `tg_release_nights` qui s'en charge, pas ce code.
 */
export async function cancelReservation(
  _prev: ReservationActionState,
  formData: FormData
): Promise<ReservationActionState> {
  const id = String(formData.get("id") ?? "");
  const version = Number(formData.get("version") ?? 0);
  const reason = String(formData.get("reason") ?? "").trim();

  if (!id || !version) {
    return { status: "error", message: "Requête incomplète." };
  }
  if (reason.length < 3) {
    return { status: "error", message: "Indiquez un motif d'annulation." };
  }

  const supabase = await createUserClient();
  const { error } = await supabase.rpc("cancel_reservation", {
    p_reservation_id: id,
    p_reason: reason,
    p_expected_version: version,
  });

  if (error) {
    if (error.message.includes("VERSION_CONFLICT")) {
      return {
        status: "error",
        message:
          "Cette réservation a été modifiée par un autre utilisateur pendant que vous la consultiez. Rechargez la page pour voir l'état à jour.",
      };
    }
    if (error.message.includes("FORBIDDEN")) {
      return { status: "error", message: "Vous n'avez pas les droits requis." };
    }
    return { status: "error", message: "L'annulation a échoué." };
  }

  revalidatePath(`/admin/reservations/${id}`);
  revalidatePath("/admin/reservations");
  revalidatePath("/admin");
  return { status: "success", message: "Réservation annulée." };
}

/**
 * Changement de statut de séjour (arrivée constatée, départ, non-présentation).
 *
 * Volontairement limité à des transitions qui ne touchent pas à l'inventaire ni
 * aux montants : l'annulation a sa propre action, avec motif obligatoire, et
 * l'encaissement ne passe que par le webhook de paiement.
 */
export async function updateStayStatus(
  _prev: ReservationActionState,
  formData: FormData
): Promise<ReservationActionState> {
  const id = String(formData.get("id") ?? "");
  const version = Number(formData.get("version") ?? 0);
  const status = String(formData.get("status") ?? "");

  const ALLOWED = ["confirmed", "completed", "no_show"] as const;
  if (!ALLOWED.includes(status as (typeof ALLOWED)[number])) {
    return { status: "error", message: "Statut non autorisé." };
  }

  const staff = await getStaffMember();
  if (!staff) return { status: "error", message: "Session expirée." };

  const supabase = await createUserClient();

  // Verrouillage optimiste appliqué dans la clause WHERE : si la version a
  // changé, aucune ligne n'est modifiée et on le détecte au retour.
  const { data, error } = await supabase
    .from("reservations")
    .update({ status })
    .eq("id", id)
    .eq("version", version)
    .select("id");

  if (error) {
    return { status: "error", message: "La mise à jour a échoué." };
  }
  if (!data || data.length === 0) {
    return {
      status: "error",
      message:
        "Cette réservation a été modifiée entre-temps. Rechargez la page avant de réessayer.",
    };
  }

  await supabase.from("audit_log").insert({
    actor_id: staff.id,
    actor_label: staff.full_name,
    action: "reservation.status",
    entity: "reservations",
    entity_id: id,
    after: { status },
  });

  revalidatePath(`/admin/reservations/${id}`);
  revalidatePath("/admin/reservations");
  return { status: "success", message: "Statut mis à jour." };
}
