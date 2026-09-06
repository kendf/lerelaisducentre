import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AlertTriangle, ShieldCheck } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { BookingSteps } from "@/components/booking/booking-steps";
import { HoldCountdown } from "@/components/booking/hold-countdown";
import { PaymentButton } from "@/components/booking/payment-button";
import { getPublicSettings, getReservationByToken } from "@/lib/content";
import { HOLD_COOKIE } from "@/lib/booking/hold-cookie";
import { isMockPayment } from "@/lib/payments";
import { formatXof } from "@/lib/utils";
import type { Locale } from "@/types/database";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "booking" });
  return { title: t("step3"), robots: { index: false, follow: false } };
}

export default async function PaymentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const lang = locale as Locale;

  const t = await getTranslations("booking");
  const settings = await getPublicSettings();
  const holdMinutes = settings.hold_minutes;

  const cookieStore = await cookies();
  const token = cookieStore.get(HOLD_COOKIE)?.value;

  // Aucune réservation en cours dans ce navigateur : on ne montre pas un écran
  // de paiement orphelin, on renvoie au début du parcours.
  if (!token) redirect(`/${locale}/reserver`);

  const reservation = await getReservationByToken(token);
  if (!reservation) redirect(`/${locale}/reserver`);

  // Le paiement est déjà passé (retour tardif, double onglet, webhook plus
  // rapide que le navigateur) : on envoie directement à la confirmation.
  if (reservation.status === "confirmed") {
    redirect(`/${locale}/reserver/confirmation/${token}`);
  }

  // L'expiration est décidée par la base, pas par l'horloge du serveur web :
  // c'est PostgreSQL qui libère réellement les chambres, une dérive entre les
  // deux machines suffirait à afficher « payez maintenant » sur une chambre
  // déjà remise en vente. Voir migration 0007.
  const expired = reservation.is_expired;

  const roomName =
    reservation.room_type[lang]?.name ?? reservation.room_type.fr.name;

  return (
    <>
      <BookingSteps current={4} />

      <div className="mx-auto max-w-2xl px-5 py-14 lg:px-8 lg:py-16">
        {expired ? (
          <div className="border border-warning/40 bg-warning/8 p-7">
            <p className="flex items-start gap-2.5 text-[15px] leading-relaxed">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
              {t("holdExpired")}
            </p>
            <Link href="/reserver" className="btn btn-primary mt-6">
              {t("search")}
            </Link>
          </div>
        ) : (
          <>
            <h1 className="font-display text-3xl">{t("paymentTitle")}</h1>

            {/* Durée TOTALE du blocage, telle que réglée par le gérant. Le
                temps restant, lui, est affiché en direct juste dessous — le
                calculer ici donnerait une valeur déjà périmée à l'affichage. */}
            <p className="mt-3 text-[15px] leading-relaxed text-brown-soft">
              {t("paymentLead", { minutes: holdMinutes })}
            </p>

            {/* Le compte à rebours est placé AVANT le récapitulatif : c'est
                l'information qui inquiète, elle ne doit pas se découvrir au
                détour d'un paragraphe. */}
            {reservation.hold_expires_at ? (
              <div className="mt-6">
                <HoldCountdown expiresAt={reservation.hold_expires_at} />
              </div>
            ) : null}

            <div className="mt-8 border border-ivory-line bg-cream p-7">
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-brown-soft">{t("reference")}</dt>
                  <dd className="numeric">{reservation.reference}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-brown-soft">{t("summaryRoom")}</dt>
                  <dd>{roomName}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-brown-soft">{t("summaryTotal")}</dt>
                  <dd className="price">
                    {formatXof(reservation.total_amount_xof)}
                  </dd>
                </div>
              </dl>

              <div className="mt-5 flex items-baseline justify-between gap-4 border-t border-ivory-line pt-5">
                <span className="text-sm text-brown-soft">
                  {t("summaryDeposit")}
                </span>
                <span className="price text-2xl font-medium text-bronze">
                  {formatXof(reservation.deposit_amount_xof)}
                </span>
              </div>
            </div>

            <div className="mt-8">
              <PaymentButton
                amountLabel={formatXof(reservation.deposit_amount_xof)}
              />
            </div>

            <p className="mt-4 text-center text-xs text-brown-soft">
              {t("paymentMethods")}
            </p>
            <p className="mt-4 flex items-start gap-2.5 text-xs leading-relaxed text-brown-soft">
              <ShieldCheck size={15} className="mt-0.5 shrink-0 text-palm" />
              {t("paymentSecure")}
            </p>

            {isMockPayment() ? (
              <p className="mt-6 border border-dashed border-bronze/40 bg-bronze-tint/40 p-4 text-xs leading-relaxed text-brown">
                <strong>Mode simulation.</strong> Aucun paiement réel n&apos;est
                effectué : le guichet est simulé localement pour permettre de
                dérouler le parcours complet avant l&apos;ouverture du compte
                marchand CinetPay de l&apos;hôtel.
              </p>
            ) : null}

            <p className="mt-6 text-center text-xs text-brown-soft">
              {t("cancellationInfo", { hours: settings.free_cancellation_hours })}
            </p>
          </>
        )}
      </div>
    </>
  );
}
