import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getPaymentProvider } from "@/lib/payments";
import { notifyReservationConfirmed } from "@/lib/notifications";

/**
 * Notification de paiement du prestataire — LE POINT DE VÉRITÉ.
 *
 * C'est cet appel, et lui seul, qui confirme une réservation. Le retour du
 * navigateur après le guichet Mobile Money ne prouve rien : le client peut
 * fermer son onglet, perdre le réseau, ou ne jamais revenir. Une connexion
 * mobile interrompue au mauvais moment ne doit pas coûter une réservation
 * payée.
 *
 * Trois garanties :
 *   1. On ne fait jamais confiance au corps de la requête. Le prestataire est
 *      réinterrogé sur le statut réel de la transaction (voir verifyWebhook).
 *   2. L'écriture passe par `confirm_reservation_payment`, idempotente grâce à
 *      `payments.idempotency_key` : un webhook rejoué — cas courant chez tous
 *      les agrégateurs — ne double ni l'encaissement ni la notification client.
 *   3. On répond 200 même sur un doublon : un code d'erreur ferait réessayer
 *      le prestataire indéfiniment pour un événement déjà traité.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerName } = await params;

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "UNREADABLE_BODY" }, { status: 400 });
  }

  const provider = getPaymentProvider();

  // Le segment d'URL doit correspondre au prestataire réellement configuré :
  // sinon une notification destinée à un autre environnement pourrait être
  // interprétée avec les mauvaises clés.
  if (providerName !== provider.name) {
    return NextResponse.json({ error: "PROVIDER_MISMATCH" }, { status: 404 });
  }

  const result = await provider.verifyWebhook({
    headers: request.headers,
    rawBody,
  });

  if (!result.ok) {
    console.error(`[webhook:${providerName}] rejeté :`, result.reason);
    // 400 volontaire : la requête est invalide ou falsifiée, la réessayer
    // n'y changerait rien.
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }

  const event = result.event;
  const supabase = createServiceClient();

  if (event.status === "failed") {
    await supabase.rpc("fail_reservation_payment", {
      p_reservation_id: event.reservationId,
      p_provider: provider.name,
      p_provider_ref: event.providerRef,
      p_amount_xof: event.amountXof,
      p_idempotency_key: `${provider.name}:fail:${event.providerRef}`,
      p_reason: event.failureReason ?? null,
      p_raw_payload: event.raw as never,
    });

    // La réservation n'est PAS annulée : le client peut relancer son paiement
    // tant que le hold court. C'est l'expiration qui libérera la chambre.
    return NextResponse.json({ received: true, status: "failed" });
  }

  if (event.status === "pending") {
    return NextResponse.json({ received: true, status: "pending" });
  }

  const { data, error } = await supabase.rpc("confirm_reservation_payment", {
    p_reservation_id: event.reservationId,
    p_provider: provider.name,
    p_provider_ref: event.providerRef,
    p_method: event.method,
    p_amount_xof: event.amountXof,
    p_idempotency_key: `${provider.name}:paid:${event.providerRef}`,
    p_raw_payload: event.raw as never,
  });

  if (error) {
    console.error(`[webhook:${providerName}] confirmation :`, error.message);
    // 500 assumé : l'erreur est de notre côté, on veut que le prestataire
    // réessaie — l'idempotence rend ce réessai sans danger.
    return NextResponse.json({ error: "CONFIRMATION_FAILED" }, { status: 500 });
  }

  const outcome = data as { duplicate: boolean; reference: string };

  // Les notifications ne partent qu'au premier traitement réel : un webhook
  // rejoué ne renvoie pas un second message au client ni à l'hôtel.
  if (!outcome.duplicate) {
    await notifyReservationConfirmed(event.reservationId);
  }

  return NextResponse.json({ received: true, reference: outcome.reference });
}
