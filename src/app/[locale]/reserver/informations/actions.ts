"use server";

import { cookies } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { createPublicClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { guestDetailsSchema } from "@/lib/validation/schemas";
import { toBookingErrorCode, type BookingErrorCode } from "@/lib/booking/errors";
import { HOLD_COOKIE, HOLD_COOKIE_MAX_AGE } from "@/lib/booking/hold-cookie";
import type { HoldResult } from "@/types/database";

export interface HoldState {
  status: "idle" | "error";
  code?: BookingErrorCode;
}

/**
 * Étape 2 → 3 : création de la pré-réservation.
 *
 * Rien n'est calculé ici : ni le prix, ni la disponibilité. Tout est délégué à
 * `create_reservation_hold`, qui fait le devis, prend le verrou, attribue une
 * unité et écrit la réservation dans UNE SEULE transaction. Cette action ne
 * fait que valider la forme des données et transmettre.
 *
 * Le jeton de la réservation est déposé dans un cookie httpOnly : la page de
 * paiement ne lit donc pas un identifiant passé dans l'URL, et un lien
 * recopié ou partagé ne donne accès au règlement de personne d'autre.
 */
export async function createHold(
  _prev: HoldState,
  formData: FormData
): Promise<HoldState> {
  const parsed = guestDetailsSchema.safeParse({
    roomTypeId: formData.get("roomTypeId"),
    checkIn: formData.get("checkIn"),
    checkOut: formData.get("checkOut"),
    adults: formData.get("adults"),
    children: formData.get("children"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    country: formData.get("country") ?? "",
    notes: formData.get("notes") ?? "",
    locale: formData.get("locale") ?? "fr",
    acceptTerms: formData.get("acceptTerms") === "on",
  });

  if (!parsed.success) {
    return { status: "error", code: "INVALID_GUEST_DETAILS" };
  }

  if (!isSupabaseConfigured()) {
    return { status: "error", code: "GENERIC" };
  }

  const input = parsed.data;
  const supabase = createPublicClient();

  const { data, error } = await supabase.rpc("create_reservation_hold", {
    p_room_type_id: input.roomTypeId,
    p_check_in: input.checkIn,
    p_check_out: input.checkOut,
    p_adults: input.adults,
    p_children: input.children,
    p_guest_first_name: input.firstName,
    p_guest_last_name: input.lastName,
    p_guest_email: input.email,
    p_guest_phone: input.phone,
    p_guest_country: input.country || null,
    p_guest_notes: input.notes || null,
    p_locale: input.locale,
    p_source: "web",
  });

  if (error) {
    return { status: "error", code: toBookingErrorCode(error.message) };
  }

  const hold = data as HoldResult & { public_token: string };

  const cookieStore = await cookies();
  cookieStore.set(HOLD_COOKIE, hold.public_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // Volontairement plus long que le hold lui-même : si le délai expire, on
    // veut pouvoir afficher « votre chambre a été relâchée » plutôt qu'une
    // page vide qui laisserait le visiteur sans explication.
    maxAge: HOLD_COOKIE_MAX_AGE,
  });

  // Redirection côté serveur : le visiteur ne peut pas atterrir sur la page de
  // paiement sans que le hold existe réellement, et un rechargement de l'étape 2
  // ne recrée pas une seconde réservation.
  redirect({ href: "/reserver/paiement", locale: input.locale });

  // `redirect` interrompt l'exécution en levant une exception : cette ligne
  // n'est jamais atteinte, elle satisfait l'analyse de flux de TypeScript.
  return { status: "idle" };
}
