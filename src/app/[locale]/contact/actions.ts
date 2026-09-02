"use server";

import { createPublicClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { contactSchema } from "@/lib/validation/schemas";

export interface ContactState {
  status: "idle" | "success" | "error";
  message?: string;
}

/**
 * Envoi du formulaire de contact (CDC §3.2).
 *
 * Passe par la fonction SQL `submit_contact_message` plutôt que par un INSERT :
 * la table `contact_messages` n'accepte aucune écriture anonyme directe, donc
 * la clé publique — qui est par nature lisible dans le navigateur — ne donne
 * aucun moyen d'écrire librement en base.
 */
export async function submitContactMessage(
  _prev: ContactState,
  formData: FormData
): Promise<ContactState> {
  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    subject: formData.get("subject") ?? "",
    message: formData.get("message"),
    locale: formData.get("locale") ?? "fr",
  });

  if (!parsed.success) {
    return { status: "error", message: "VALIDATION" };
  }

  if (!isSupabaseConfigured()) {
    return { status: "error", message: "NOT_CONFIGURED" };
  }

  const supabase = createPublicClient();
  const { error } = await supabase.rpc("submit_contact_message", {
    p_name: parsed.data.name,
    p_email: parsed.data.email,
    p_phone: parsed.data.phone || null,
    p_subject: parsed.data.subject || null,
    p_message: parsed.data.message,
    p_locale: parsed.data.locale,
  });

  if (error) {
    console.error("[contact] submit:", error.message);
    return { status: "error", message: "SERVER" };
  }

  return { status: "success" };
}
