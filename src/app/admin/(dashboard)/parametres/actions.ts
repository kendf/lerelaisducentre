"use server";

import { revalidatePath } from "next/cache";
import { createUserClient } from "@/lib/supabase/server";
import { getStaffMember, isManager } from "@/lib/auth";

export interface SettingsState {
  status: "idle" | "error" | "success";
  message?: string;
}

/**
 * Bornes de sécurité sur les réglages métier.
 *
 * Ces valeurs pilotent le moteur de réservation : un acompte à 0 % rendrait la
 * confirmation gratuite, un blocage à 0 minute relâcherait la chambre avant
 * même l'ouverture du guichet de paiement. Le back-office doit permettre à
 * l'hôtel d'ajuster ses règles, pas de casser le tunnel.
 */
const NUMERIC_BOUNDS: Record<string, { min: number; max: number; label: string }> = {
  deposit_percent: { min: 0, max: 100, label: "Le pourcentage d'acompte" },
  hold_minutes: { min: 5, max: 120, label: "La durée de blocage" },
  min_nights: { min: 1, max: 30, label: "Le séjour minimum" },
  max_nights: { min: 1, max: 365, label: "Le séjour maximum" },
  max_advance_days: { min: 1, max: 1095, label: "La fenêtre de réservation" },
  free_cancellation_hours: { min: 0, max: 720, label: "Le délai d'annulation" },
};

const TIME_KEYS = ["check_in_time", "check_out_time"];

export async function updateSettings(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const staff = await getStaffMember();
  if (!staff || !isManager(staff)) {
    return { status: "error", message: "Réservé au gérant." };
  }

  const updates: Array<{ key: string; value: unknown }> = [];

  for (const [key, bounds] of Object.entries(NUMERIC_BOUNDS)) {
    const raw = formData.get(key);
    if (raw === null) continue;

    const value = Number(raw);
    if (!Number.isInteger(value) || value < bounds.min || value > bounds.max) {
      return {
        status: "error",
        message: `${bounds.label} doit être un entier entre ${bounds.min} et ${bounds.max}.`,
      };
    }
    updates.push({ key, value });
  }

  for (const key of TIME_KEYS) {
    const raw = formData.get(key);
    if (raw === null) continue;

    const value = String(raw);
    if (!/^\d{2}:\d{2}$/.test(value)) {
      return { status: "error", message: "Les horaires doivent être au format HH:MM." };
    }
    updates.push({ key, value });
  }

  // Cohérence croisée : un séjour minimum supérieur au maximum bloquerait
  // toute réservation sans qu'aucun champ ne soit isolément invalide.
  const min = updates.find((u) => u.key === "min_nights")?.value as number | undefined;
  const max = updates.find((u) => u.key === "max_nights")?.value as number | undefined;
  if (min !== undefined && max !== undefined && min > max) {
    return {
      status: "error",
      message: "Le séjour minimum ne peut pas dépasser le séjour maximum.",
    };
  }

  const contact = {
    phone: String(formData.get("contact_phone") ?? "").trim(),
    whatsapp: String(formData.get("contact_whatsapp") ?? "").trim(),
    email: String(formData.get("contact_email") ?? "").trim(),
    address: String(formData.get("contact_address") ?? "").trim(),
    maps_query: String(formData.get("contact_maps") ?? "").trim(),
  };

  if (contact.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email)) {
    return { status: "error", message: "L'adresse e-mail de contact est invalide." };
  }
  updates.push({ key: "hotel_contact", value: contact });

  updates.push({ key: "demo_mode", value: formData.get("demo_mode") === "on" });

  const supabase = await createUserClient();

  for (const update of updates) {
    const { error } = await supabase
      .from("settings")
      .update({ value: update.value, updated_by: staff.id, updated_at: new Date().toISOString() })
      .eq("key", update.key);

    if (error) {
      return {
        status: "error",
        message: `Échec de l'enregistrement de « ${update.key} ».`,
      };
    }
  }

  await supabase.from("audit_log").insert({
    actor_id: staff.id,
    actor_label: staff.full_name,
    action: "settings.update",
    entity: "settings",
    after: Object.fromEntries(updates.map((u) => [u.key, u.value])),
  });

  // Le site public met ses pages en cache 5 minutes : sans purge, une
  // modification de l'acompte ou des horaires resterait invisible au visiteur
  // le temps du cycle. Le gérant, lui, attend un effet immédiat.
  revalidatePath("/", "layout");
  revalidatePath("/admin/parametres");

  return { status: "success", message: "Réglages enregistrés et appliqués au site." };
}
