import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MessageCircle,
  Phone,
} from "lucide-react";

import { Link } from "@/i18n/navigation";
import { getPublicSettings, getReservationByToken } from "@/lib/content";
import { formatXof } from "@/lib/utils";
import type { Locale } from "@/types/database";

// Rendu à chaque appel : le statut change au moment où le webhook du
// prestataire arrive, éventuellement quelques secondes après le retour du
// visiteur sur cette page.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "booking" });
  // Jamais indexée : l'URL porte un jeton personnel.
  return { title: t("confirmedTitle"), robots: { index: false, follow: false } };
}

/* =============================================================================
   CONFIRMATION

   C'est la page qu'on relit dans la voiture, qu'on montre au comptoir, dont on
   fait une capture d'écran. Elle est donc construite autour d'UNE information :
   la référence. Posée en grand, centrée, lisible d'un coup d'œil sur un
   téléphone tenu à bout de bras — pas noyée dans une ligne de tableau.

   Le reste suit dans l'ordre où on se le demande : ce que j'ai réservé, ce que
   j'ai payé, ce qu'il me reste à régler, à quelle heure j'arrive, qui appeler.
   ============================================================================= */

export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const lang = locale as Locale;

  const t = await getTranslations("booking");
  const tCommon = await getTranslations("common");
  const format = await getFormatter();
  const settings = await getPublicSettings();

  const reservation = await getReservationByToken(token);
  if (!reservation) notFound();

  const roomName =
    reservation.room_type[lang]?.name ?? reservation.room_type.fr.name;

  const confirmed =
    reservation.status === "confirmed" || reservation.status === "completed";
  const released =
    reservation.status === "expired" || reservation.status === "cancelled";

  const contact = settings.hotel_contact;
  const phoneHref = `tel:${contact.phone.replace(/[^0-9+]/g, "")}`;
  const whatsappHref = `https://wa.me/${contact.whatsapp.replace(/[^0-9]/g, "")}`;

  const rows = [
    { label: t("summaryRoom"), value: roomName },
    {
      label: t("summaryDates"),
      value: `${format.dateTime(new Date(`${reservation.check_in}T12:00:00Z`), "long")} → ${format.dateTime(new Date(`${reservation.check_out}T12:00:00Z`), "long")}`,
    },
    {
      label: t("summaryGuests"),
      value:
        tCommon("adults", { count: reservation.adults }) +
        (reservation.children > 0
          ? ` · ${tCommon("children", { count: reservation.children })}`
          : ""),
    },
  ];

  return (
    <div className="mx-auto max-w-2xl px-5 py-16 lg:px-8 lg:py-20">
      {/* --- L'issue -------------------------------------------------------- */}
      <div className="text-center">
        {confirmed ? (
          <>
            <CheckCircle2 size={44} className="mx-auto text-palm" />
            <h1 className="mt-6 font-display text-3xl sm:text-4xl">
              {t("confirmedTitle")}
            </h1>
            <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-brown-soft">
              {t("confirmedLead", { firstName: reservation.guest_first_name })}
            </p>
          </>
        ) : released ? (
          <>
            <AlertTriangle size={44} className="mx-auto text-warning" />
            <h1 className="mt-6 font-display text-3xl sm:text-4xl">
              {t("holdExpired")}
            </h1>
            <Link href="/reserver" className="btn btn-primary mt-8">
              {t("search")}
            </Link>
          </>
        ) : (
          <>
            <Clock size={44} className="mx-auto text-bronze" />
            <h1 className="mt-6 font-display text-3xl sm:text-4xl">
              {t("pendingTitle")}
            </h1>
            <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-brown-soft">
              {t("pendingLead")}
            </p>
            {/* La confirmation dépend du webhook du prestataire, pas du retour
                du navigateur : on rafraîchit doucement plutôt que de demander
                au visiteur de recharger lui-même. */}
            <meta httpEquiv="refresh" content="8" />
          </>
        )}
      </div>

      {!released ? (
        <>
          {/* --- La référence, en grand ---------------------------------- */}
          <div className="mt-12 border border-bronze/30 bg-cream px-6 py-8 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-brown-soft">
              {t("reference")}
            </p>
            <p className="numeric mt-3 text-3xl font-medium text-bronze sm:text-4xl">
              {reservation.reference}
            </p>
            <p className="mx-auto mt-4 max-w-sm text-xs leading-relaxed text-brown-soft">
              {t("keepReference")}
            </p>
          </div>

          {/* --- Le séjour ------------------------------------------------- */}
          <dl className="mt-10 divide-y divide-ivory-line border-y border-ivory-line text-sm">
            {rows.map((row) => (
              <div key={row.label} className="flex justify-between gap-6 py-3.5">
                <dt className="text-brown-soft">{row.label}</dt>
                <dd className="text-right">{row.value}</dd>
              </div>
            ))}
          </dl>

          {/* --- Les montants ---------------------------------------------- */}
          <dl className="mt-8 space-y-3 text-sm">
            <div className="flex justify-between gap-6">
              <dt className="text-brown-soft">{t("summaryTotal")}</dt>
              <dd className="price">
                {formatXof(reservation.total_amount_xof)}
              </dd>
            </div>
            <div className="flex justify-between gap-6">
              <dt className="text-brown-soft">{t("summaryDeposit")}</dt>
              <dd className="price text-palm">
                {formatXof(
                  confirmed
                    ? reservation.amount_paid_xof
                    : reservation.deposit_amount_xof
                )}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-6 border-t border-ivory-line pt-3">
              <dt>{t("summaryBalance")}</dt>
              <dd className="price text-xl font-medium text-bronze">
                {formatXof(
                  reservation.total_amount_xof - reservation.amount_paid_xof
                )}
              </dd>
            </div>
          </dl>

          {confirmed ? (
            <p className="mt-8 border-t border-ivory-line pt-6 text-sm leading-relaxed text-brown-soft">
              {t("arrivalInfo", {
                checkIn: settings.check_in_time,
                checkOut: settings.check_out_time,
              })}{" "}
              {t("cancellationInfo", { hours: settings.free_cancellation_hours })}
            </p>
          ) : null}

          {/* --- Qui appeler ------------------------------------------------
              Une confirmation sans numéro oblige le client à rouvrir le site
              pour poser sa question. Il est là.
              ---------------------------------------------------------------- */}
          <div className="mt-8 flex flex-wrap gap-4">
            <a href={phoneHref} className="btn btn-outline">
              <Phone size={15} />
              {contact.phone}
            </a>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline"
            >
              <MessageCircle size={15} />
              {tCommon("whatsapp")}
            </a>
          </div>
        </>
      ) : null}

      <Link
        href="/"
        className="mt-10 inline-block text-xs uppercase tracking-wider text-brown-soft transition-colors hover:text-bronze"
      >
        {t("backHome")}
      </Link>
    </div>
  );
}
