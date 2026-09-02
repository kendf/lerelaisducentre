import { formatXof } from "@/lib/utils";
import type { Locale } from "@/types/database";

/**
 * Contenu des notifications de réservation, en français et en anglais.
 *
 * Écrits ici plutôt que dans les fichiers de traduction du site : ces messages
 * partent depuis le serveur, hors de tout contexte de requête, et doivent
 * rester lisibles tels quels par l'équipe de l'hôtel qui les relira avant la
 * mise en production.
 */

export interface ConfirmationData {
  reference: string;
  firstName: string;
  lastName: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  totalXof: number;
  depositPaidXof: number;
  balanceXof: number;
  checkInTime: string;
  checkOutTime: string;
  confirmationUrl: string;
  phone: string;
  email: string;
}

function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Abidjan",
  }).format(new Date(`${iso}T12:00:00Z`));
}

/** Message court, destiné à WhatsApp ou SMS — le client le lit sur son téléphone. */
export function guestShortMessage(d: ConfirmationData, locale: Locale): string {
  if (locale === "en") {
    return [
      `Le Relais du Centre — booking confirmed`,
      ``,
      `Reference: ${d.reference}`,
      `${d.roomName}, ${formatDate(d.checkIn, "en")} to ${formatDate(d.checkOut, "en")}`,
      `Deposit received: ${formatXof(d.depositPaidXof, "en")}`,
      `Balance on arrival: ${formatXof(d.balanceXof, "en")}`,
      ``,
      `Check-in from ${d.checkInTime}. See you soon.`,
    ].join("\n");
  }

  return [
    `Le Relais du Centre — réservation confirmée`,
    ``,
    `Référence : ${d.reference}`,
    `${d.roomName}, du ${formatDate(d.checkIn, "fr")} au ${formatDate(d.checkOut, "fr")}`,
    `Acompte reçu : ${formatXof(d.depositPaidXof, "fr")}`,
    `Solde à l'arrivée : ${formatXof(d.balanceXof, "fr")}`,
    ``,
    `Arrivée à partir de ${d.checkInTime}. À bientôt.`,
  ].join("\n");
}

/**
 * Variables du template WhatsApp approuvé par Meta.
 * L'ordre correspond aux emplacements {{1}}…{{5}} déclarés dans le template —
 * il doit rester synchronisé avec ce qui a été soumis à l'approbation.
 */
export function guestTemplateVariables(
  d: ConfirmationData,
  locale: Locale
): Record<string, string> {
  return {
    "1": d.firstName,
    "2": d.reference,
    "3": d.roomName,
    "4": `${formatDate(d.checkIn, locale)} → ${formatDate(d.checkOut, locale)}`,
    "5": formatXof(d.depositPaidXof, locale),
  };
}

export function guestEmailSubject(d: ConfirmationData, locale: Locale): string {
  return locale === "en"
    ? `Booking confirmed — ${d.reference} — Le Relais du Centre`
    : `Réservation confirmée — ${d.reference} — Le Relais du Centre`;
}

export function guestEmailHtml(d: ConfirmationData, locale: Locale): string {
  const en = locale === "en";
  const rows: Array<[string, string]> = [
    [en ? "Reference" : "Référence", d.reference],
    [en ? "Room" : "Chambre", d.roomName],
    [
      en ? "Arrival" : "Arrivée",
      `${formatDate(d.checkIn, locale)} — ${en ? "from" : "à partir de"} ${d.checkInTime}`,
    ],
    [
      en ? "Departure" : "Départ",
      `${formatDate(d.checkOut, locale)} — ${en ? "until" : "jusqu'à"} ${d.checkOutTime}`,
    ],
    [
      en ? "Guests" : "Voyageurs",
      `${d.adults} ${en ? "adult(s)" : "adulte(s)"}${d.children ? ` + ${d.children} ${en ? "child(ren)" : "enfant(s)"}` : ""}`,
    ],
    [en ? "Stay total" : "Total du séjour", formatXof(d.totalXof, locale)],
    [
      en ? "Deposit received" : "Acompte reçu",
      formatXof(d.depositPaidXof, locale),
    ],
    [
      en ? "Balance on arrival" : "Solde à l'arrivée",
      formatXof(d.balanceXof, locale),
    ],
  ];

  // HTML volontairement simple et en styles en ligne : les clients de
  // messagerie ignorent les feuilles de style externes et une bonne part des
  // sélecteurs modernes.
  return `<!doctype html>
<html lang="${locale}">
<body style="margin:0;padding:0;background:#f7f3ec;font-family:Helvetica,Arial,sans-serif;color:#3b2a1e;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3ec;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fdfbf7;border:1px solid #e2d7c5;">
        <tr><td style="padding:32px 32px 8px;">
          <div style="font-size:18px;letter-spacing:1px;">LE RELAIS <span style="color:#8b5e34;">DU CENTRE</span></div>
          <div style="color:#8b5e34;font-style:italic;font-size:20px;margin-top:4px;">Le temps d'une pause</div>
        </td></tr>
        <tr><td style="padding:16px 32px 0;">
          <h1 style="font-size:22px;font-weight:normal;margin:16px 0 8px;">
            ${en ? "Your booking is confirmed" : "Votre réservation est confirmée"}
          </h1>
          <p style="font-size:15px;line-height:1.6;color:#6b5748;margin:0 0 24px;">
            ${en ? `Thank you ${d.firstName}. We look forward to welcoming you.` : `Merci ${d.firstName}. Nous serons heureux de vous accueillir.`}
          </p>
        </td></tr>
        <tr><td style="padding:0 32px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
            ${rows
              .map(
                ([label, value]) =>
                  `<tr>
                     <td style="padding:7px 0;color:#6b5748;border-bottom:1px solid #efe7da;">${label}</td>
                     <td style="padding:7px 0;text-align:right;border-bottom:1px solid #efe7da;">${value}</td>
                   </tr>`
              )
              .join("")}
          </table>
        </td></tr>
        <tr><td style="padding:0 32px 32px;">
          <a href="${d.confirmationUrl}" style="display:inline-block;background:#8b5e34;color:#f7f3ec;text-decoration:none;padding:13px 26px;font-size:12px;letter-spacing:2px;text-transform:uppercase;">
            ${en ? "View my booking" : "Voir ma réservation"}
          </a>
        </td></tr>
        <tr><td style="padding:0 32px 32px;font-size:12px;line-height:1.6;color:#6b5748;">
          ${en ? "Tiébissou, Côte d'Ivoire" : "Tiébissou, Côte d'Ivoire"}<br>
          ${d.phone} · ${d.email}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Message interne à la réception — factuel, avec les coordonnées du client. */
export function hotelMessage(d: ConfirmationData): string {
  return [
    `NOUVELLE RÉSERVATION — ${d.reference}`,
    ``,
    `${d.firstName} ${d.lastName}`,
    `${d.phone} · ${d.email}`,
    ``,
    `${d.roomName}`,
    `Du ${formatDate(d.checkIn, "fr")} au ${formatDate(d.checkOut, "fr")} (${d.nights} nuit${d.nights > 1 ? "s" : ""})`,
    `${d.adults} adulte(s)${d.children ? ` + ${d.children} enfant(s)` : ""}`,
    ``,
    `Total : ${formatXof(d.totalXof, "fr")}`,
    `Acompte encaissé : ${formatXof(d.depositPaidXof, "fr")}`,
    `Solde à percevoir : ${formatXof(d.balanceXof, "fr")}`,
  ].join("\n");
}
