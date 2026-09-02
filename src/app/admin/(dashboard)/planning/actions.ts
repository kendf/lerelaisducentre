"use server";

import { revalidatePath } from "next/cache";
import { createUserClient } from "@/lib/supabase/server";

export interface PlanningState {
  status: "idle" | "error" | "success";
  message?: string;
}

/**
 * Fermeture ou réouverture de dates à la vente.
 *
 * Passe par `set_inventory_block`, qui ne touche JAMAIS aux tarifs : bloquer
 * des dates est une tâche quotidienne de réception, changer un prix ne l'est
 * pas. La fonction vérifie elle-même le rôle du demandeur et journalise
 * l'opération.
 */
export async function blockDates(
  _prev: PlanningState,
  formData: FormData
): Promise<PlanningState> {
  const roomTypeId = String(formData.get("roomTypeId") ?? "");
  const from = String(formData.get("from") ?? "");
  const to = String(formData.get("to") ?? "");
  const mode = String(formData.get("mode") ?? "close");
  const units = formData.get("units");
  const note = String(formData.get("note") ?? "").trim();

  if (!roomTypeId || !from || !to) {
    return { status: "error", message: "Renseignez la catégorie et les dates." };
  }
  if (to <= from) {
    return { status: "error", message: "La date de fin doit suivre la date de début." };
  }

  const supabase = await createUserClient();
  const { error } = await supabase.rpc("set_inventory_block", {
    p_room_type_id: roomTypeId,
    p_from: from,
    p_to: to,
    p_units_override:
      mode === "reduce" && units !== null && units !== ""
        ? Number(units)
        : null,
    p_is_closed: mode === "close",
    p_note: note || null,
  });

  if (error) {
    if (error.message.includes("FORBIDDEN")) {
      return { status: "error", message: "Vous n'avez pas les droits requis." };
    }
    return { status: "error", message: "L'opération a échoué." };
  }

  revalidatePath("/admin/planning");
  revalidatePath("/admin");

  return {
    status: "success",
    message:
      mode === "close"
        ? "Dates fermées à la vente."
        : mode === "reduce"
          ? "Inventaire ajusté sur la période."
          : "Dates rouvertes à la vente.",
  };
}
