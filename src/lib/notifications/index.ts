import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { isZavuConfigured, zavuSend, type ZavuChannel } from "./zavu";
import {
  guestEmailHtml,
  guestEmailSubject,
  guestShortMessage,
  guestTemplateVariables,
  hotelMessage,
  type ConfirmationData,
} from "./templates";
import type { Locale } from "@/types/database";

/**
 * Envoi des confirmations de réservation (CDC §3.2 : « confirmation
 * automatique par e-mail et par SMS, client et hôtel »).
 *
 * DEUX PRINCIPES :
 *
 * 1. Une notification qui échoue ne doit JAMAIS faire échouer une réservation
 *    déjà payée. Toutes les erreurs sont capturées et journalisées ; la
 *    fonction ne lève jamais d'exception vers le webhook de paiement.
 *
 * 2. Tout envoi est tracé dans `notifications_log`, y compris les échecs.
 *    C'est ce qui permettra de PROUVER en recette que les confirmations sont
 *    bien parties (critère CDC §13), et à la réception de savoir si un client
 *    a réellement reçu son message avant de le rappeler.
 */

type LogStatus = "sent" | "failed" | "queued";

async function logNotification(entry: {
  reservationId: string;
  channel: ZavuChannel;
  template: string;
  recipient: string;
  locale: string;
  status: LogStatus;
  providerRef?: string;
  error?: string;
}) {
  const supabase = createServiceClient();
  await supabase.from("notifications_log").insert({
    reservation_id: entry.reservationId,
    channel: entry.channel,
    template: entry.template,
    recipient: entry.recipient,
    locale: entry.locale,
    status: entry.status,
    provider: "zavu",
    provider_ref: entry.providerRef ?? null,
    error: entry.error ?? null,
    attempts: 1,
    sent_at: entry.status === "sent" ? new Date().toISOString() : null,
  });
}

async function send(
  reservationId: string,
  template: string,
  locale: string,
  params: Parameters<typeof zavuSend>[0]
) {
  const result = await zavuSend(params);

  await logNotification({
    reservationId,
    channel: params.channel,
    template,
    recipient: params.to,
    locale,
    status: result.ok ? "sent" : "failed",
    providerRef: result.providerRef,
    error: result.error,
  });

  return result;
}

/**
 * Confirmation d'une réservation payée : client (e-mail + mobile) et hôtel.
 * Appelée par le webhook de paiement, une seule fois par réservation.
 */
export async function notifyReservationConfirmed(
  reservationId: string
): Promise<void> {
  try {
    const supabase = createServiceClient();

    const { data: reservation, error } = await supabase
      .from("reservations")
      .select("*, room_types(content)")
      .eq("id", reservationId)
      .maybeSingle();

    if (error || !reservation) {
      console.error("[notifications] réservation introuvable :", reservationId);
      return;
    }

    const { data: settingsRows } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", ["check_in_time", "check_out_time", "hotel_contact"]);

    const settings = Object.fromEntries(
      (settingsRows ?? []).map((r) => [r.key, r.value])
    ) as {
      check_in_time?: string;
      check_out_time?: string;
      hotel_contact?: { phone: string; email: string };
    };

    const locale = (reservation.locale as Locale) ?? "fr";
    const content = (
      reservation as unknown as { room_types: { content: Record<Locale, { name: string }> } }
    ).room_types.content;

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    const data: ConfirmationData = {
      reference: reservation.reference,
      firstName: reservation.guest_first_name,
      lastName: reservation.guest_last_name,
      roomName: content[locale]?.name ?? content.fr.name,
      checkIn: reservation.check_in,
      checkOut: reservation.check_out,
      nights: reservation.nights,
      adults: reservation.adults,
      children: reservation.children,
      totalXof: reservation.total_amount_xof,
      depositPaidXof: reservation.amount_paid_xof,
      balanceXof: reservation.total_amount_xof - reservation.amount_paid_xof,
      checkInTime: settings.check_in_time ?? "14:00",
      checkOutTime: settings.check_out_time ?? "12:00",
      confirmationUrl: `${siteUrl}/${locale}/reserver/confirmation/${reservation.public_token}`,
      phone: settings.hotel_contact?.phone ?? "",
      email: settings.hotel_contact?.email ?? "",
    };

    // Zavu absent (phase de démonstration) : on journalise l'intention plutôt
    // que de perdre l'information. Le back-office montrera « en attente » au
    // lieu d'un silence trompeur.
    if (!isZavuConfigured()) {
      await logNotification({
        reservationId,
        channel: "email",
        template: "reservation_confirmed_guest",
        recipient: reservation.guest_email,
        locale,
        status: "queued",
        error: "ZAVU_NOT_CONFIGURED",
      });
      return;
    }

    const shortText = guestShortMessage(data, locale);
    const templateId = process.env.ZAVU_WHATSAPP_TEMPLATE_CONFIRMATION;

    await Promise.allSettled([
      // 1. E-mail au client — aucun prérequis, part toujours.
      send(reservationId, "reservation_confirmed_guest", locale, {
        to: reservation.guest_email,
        channel: "email",
        subject: guestEmailSubject(data, locale),
        text: shortText,
        htmlBody: guestEmailHtml(data, locale),
        idempotencyKey: `confirm:email:${reservation.reference}`,
      }),

      // 2. Mobile du client. WhatsApp si le template Meta est approuvé et
      //    configuré ; sinon SMS, qui n'a pas cette contrainte. Dans les deux
      //    cas l'engagement du CDC est tenu.
      send(
        reservationId,
        "reservation_confirmed_guest",
        locale,
        templateId
          ? {
              to: reservation.guest_phone,
              channel: "whatsapp",
              text: shortText,
              templateId,
              templateVariables: guestTemplateVariables(data, locale),
              idempotencyKey: `confirm:wa:${reservation.reference}`,
            }
          : {
              to: reservation.guest_phone,
              channel: "sms",
              text: shortText,
              idempotencyKey: `confirm:sms:${reservation.reference}`,
            }
      ),

      // 3. Copie à l'hôtel — c'est ce qui remplace l'appel téléphonique et
      //    permet à la réception de reporter la réservation dans Orchestra
      //    (CDC §15.1, saisie manuelle croisée au lancement).
      ...(process.env.HOTEL_NOTIFICATION_EMAIL
        ? [
            send(reservationId, "reservation_confirmed_hotel", "fr", {
              to: process.env.HOTEL_NOTIFICATION_EMAIL,
              channel: "email",
              subject: `Nouvelle réservation ${data.reference} — ${data.roomName}`,
              text: hotelMessage(data),
              idempotencyKey: `confirm:hotel:email:${reservation.reference}`,
            }),
          ]
        : []),
      ...(process.env.HOTEL_NOTIFICATION_WHATSAPP
        ? [
            send(reservationId, "reservation_confirmed_hotel", "fr", {
              to: process.env.HOTEL_NOTIFICATION_WHATSAPP,
              channel: "sms",
              text: hotelMessage(data),
              idempotencyKey: `confirm:hotel:sms:${reservation.reference}`,
            }),
          ]
        : []),
    ]);
  } catch (err) {
    // Filet de sécurité : quoi qu'il arrive ici, la réservation reste payée et
    // confirmée. Une notification perdue se rattrape ; une erreur 500 renvoyée
    // au prestataire de paiement déclencherait des réessais inutiles.
    console.error("[notifications] échec inattendu :", err);
  }
}
