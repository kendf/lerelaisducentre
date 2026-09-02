"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getPaymentProvider } from "@/lib/payments";
import { HOLD_COOKIE } from "@/lib/booking/hold-cookie";
import type { BookingErrorCode } from "@/lib/booking/errors";
import { getSiteUrl } from "@/lib/site-url";

export interface PaymentState {
  status: "idle" | "error";
  code?: BookingErrorCode | "PAYMENT_INIT_FAILED";
}

/**
 * Ouverture du guichet de paiement de l'acompte.
 *
 * Utilise le client `service_role` — donc hors RLS — pour une raison précise :
 * il faut lire l'identifiant interne de la réservation et son montant exact
 * pour les transmettre au prestataire, sans jamais les exposer au navigateur.
 * Le lien entre le visiteur et sa réservation vient du cookie httpOnly déposé
 * à l'étape 2, pas d'un paramètre d'URL manipulable.
 */
export async function startPayment(
  _prev: PaymentState,
  formData: FormData
): Promise<PaymentState> {
  const locale = (formData.get("locale") as string) || "fr";

  if (!isSupabaseConfigured()) {
    return { status: "error", code: "GENERIC" };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(HOLD_COOKIE)?.value;
  if (!token) {
    return { status: "error", code: "HOLD_EXPIRED" };
  }

  const supabase = createServiceClient();
  const { data: reservation, error } = await supabase
    .from("reservations")
    .select(
      "id, reference, status, deposit_amount_xof, hold_expires_at, guest_first_name, guest_last_name, guest_email, guest_phone, locale, public_token"
    )
    .eq("public_token", token)
    .maybeSingle();

  if (error || !reservation) {
    return { status: "error", code: "GENERIC" };
  }

  // Le hold a pu expirer pendant que le visiteur remplissait ses coordonnées :
  // on refuse d'ouvrir un paiement pour une chambre déjà relâchée, plutôt que
  // d'encaisser un acompte sur une réservation qui n'existe plus.
  const expired =
    reservation.hold_expires_at !== null &&
    new Date(reservation.hold_expires_at).getTime() < Date.now();

  if (reservation.status !== "pending_payment" || expired) {
    return { status: "error", code: "HOLD_EXPIRED" };
  }

  const siteUrl = getSiteUrl();
  const provider = getPaymentProvider();

  let paymentUrl: string;
  try {
    const init = await provider.initPayment({
      reservationId: reservation.id,
      reference: reservation.reference,
      amountXof: reservation.deposit_amount_xof,
      customer: {
        firstName: reservation.guest_first_name,
        lastName: reservation.guest_last_name,
        email: reservation.guest_email,
        phone: reservation.guest_phone,
      },
      locale: reservation.locale,
      returnUrl: `${siteUrl}/${locale}/reserver/confirmation/${reservation.public_token}`,
      notifyUrl: `${siteUrl}/api/payments/${provider.name}/webhook`,
    });

    paymentUrl = init.paymentUrl;

    // Trace de la tentative. Un hôtel qui manipule de l'argent doit pouvoir
    // reconstituer ce qui s'est passé, y compris pour les paiements qui
    // n'aboutissent jamais.
    await supabase.from("payments").insert({
      reservation_id: reservation.id,
      provider: provider.name,
      provider_ref: init.providerRef,
      // Conservé pour authentifier la notification à venir : sans lui, une
      // requête forgée sur l'URL publique du webhook serait indiscernable.
      notify_token: init.notifyToken ?? null,
      amount_xof: reservation.deposit_amount_xof,
      status: "initiated",
      // Horodatée : chaque tentative laisse sa propre trace. Si un client
      // s'y reprend à trois fois, le back-office le voit.
      idempotency_key: `${provider.name}:init:${init.providerRef}:${Date.now()}`,
    });
  } catch (err) {
    console.error("[payment] init:", err);
    return { status: "error", code: "PAYMENT_INIT_FAILED" };
  }

  redirect(paymentUrl);
}
