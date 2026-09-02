"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createUserClient } from "@/lib/supabase/server";
import { getStaffMember, isReceptionist } from "@/lib/auth";

export interface DeskReservationState {
  status: "idle" | "error";
  message?: string;
}

/** Codes levés par la fonction SQL, traduits pour la réception. */
const MESSAGES: Record<string, string> = {
  ROOM_UNAVAILABLE:
    "Plus aucune chambre de cette catégorie n'est libre sur ces dates. Consultez le planning pour trouver une alternative.",
  INVALID_DATES: "Les dates saisies ne sont pas valides.",
  DATE_IN_PAST: "La date d'arrivée est déjà passée.",
  MIN_NIGHTS: "Le séjour est plus court que le minimum autorisé.",
  MAX_NIGHTS: "Le séjour dépasse la durée maximale autorisée.",
  TOO_FAR_AHEAD: "Cette date est au-delà de la fenêtre de réservation.",
  CAPACITY_EXCEEDED:
    "Cette catégorie ne peut pas accueillir autant de personnes.",
  ROOM_TYPE_NOT_FOUND: "Cette catégorie n'est plus proposée.",
  INVALID_GUEST_DETAILS: "Vérifiez le nom et le téléphone du client.",
  INVALID_AMOUNT: "Le montant encaissé dépasse le total du séjour.",
  FORBIDDEN: "Vous n'avez pas les droits requis.",
};

/**
 * Enregistrement d'une réservation prise au comptoir ou au téléphone.
 *
 * Passe par `create_desk_reservation`, qui applique le MÊME verrou et la même
 * attribution d'unité que le tunnel public. Une réservation téléphonique
 * consomme donc le même stock : le site ne peut plus revendre la chambre.
 */
export async function createDeskReservation(
  _prev: DeskReservationState,
  formData: FormData
): Promise<DeskReservationState> {
  const staff = await getStaffMember();
  if (!staff) return { status: "error", message: "Session expirée." };

  // Réservé à la réception : c'est elle qui décroche le téléphone et tient le
  // comptoir. La fonction SQL vérifie de son côté qu'il s'agit bien d'un
  // membre du personnel.
  if (!isReceptionist(staff)) {
    return {
      status: "error",
      message: "Seule la réception enregistre les réservations au comptoir.",
    };
  }

  const paid = Number(formData.get("amount_paid") ?? 0);
  if (!Number.isInteger(paid) || paid < 0) {
    return { status: "error", message: "Le montant encaissé est invalide." };
  }

  const supabase = await createUserClient();
  const { data, error } = await supabase.rpc("create_desk_reservation", {
    p_room_type_id: String(formData.get("room_type_id") ?? ""),
    p_check_in: String(formData.get("check_in") ?? ""),
    p_check_out: String(formData.get("check_out") ?? ""),
    p_adults: Number(formData.get("adults") ?? 1),
    p_children: Number(formData.get("children") ?? 0),
    p_guest_first_name: String(formData.get("first_name") ?? ""),
    p_guest_last_name: String(formData.get("last_name") ?? ""),
    p_guest_email: String(formData.get("email") ?? ""),
    p_guest_phone: String(formData.get("phone") ?? ""),
    p_guest_notes: String(formData.get("notes") ?? ""),
    p_locale: String(formData.get("locale") ?? "fr"),
    p_source: String(formData.get("source") ?? "phone"),
    p_mark_confirmed: formData.get("mark_confirmed") === "on",
    p_amount_paid_xof: paid,
  });

  if (error) {
    const code = Object.keys(MESSAGES).find((key) =>
      error.message.includes(key)
    );
    return {
      status: "error",
      message: code
        ? MESSAGES[code]
        : "L'enregistrement a échoué. Réessayez, ou vérifiez le planning.",
    };
  }

  const result = data as { reservation_id: string };

  revalidatePath("/admin/reservations");
  revalidatePath("/admin/planning");
  revalidatePath("/admin");

  redirect(`/admin/reservations/${result.reservation_id}?creee=1`);
}
