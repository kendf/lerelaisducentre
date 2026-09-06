import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AlertTriangle, ArrowLeft, ArrowRight } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { BookingSteps } from "@/components/booking/booking-steps";
import { HoldCountdown } from "@/components/booking/hold-countdown";
import { RecapCard } from "@/components/booking/recap-card";
import { HOLD_COOKIE } from "@/lib/booking/hold-cookie";
import {
  getMedia,
  getPublicSettings,
  getReservationByToken,
  getRoomTypes,
} from "@/lib/content";
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

/* =============================================================================
   ÉTAPE 3 — RÉCAPITULATIF

   POURQUOI UNE ÉTAPE À PART. Le récapitulatif vivait jusqu'ici dans une colonne
   latérale de l'étape 2, à côté du formulaire. Deux défauts à cela : sur
   téléphone il passait SOUS le formulaire, donc après le bouton d'envoi — il
   n'était plus lu par personne ; et il demandait au visiteur de vérifier des
   montants au moment même où il tapait son numéro de téléphone.

   Vérifier et saisir sont deux gestes différents. Ils ont maintenant deux
   écrans.

   La pré-réservation EXISTE DÉJÀ quand cette page s'affiche : la chambre est
   retenue pendant la relecture, et le compte à rebours dit combien de temps.
   C'est le comportement voulu — sans blocage, un visiteur consciencieux qui
   relit son récapitulatif perdrait la chambre au profit d'un autre plus rapide.
   ============================================================================= */

export default async function RecapPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const lang = locale as Locale;

  const t = await getTranslations("booking");
  const settings = await getPublicSettings();

  const cookieStore = await cookies();
  const token = cookieStore.get(HOLD_COOKIE)?.value;
  if (!token) redirect(`/${locale}/reserver`);

  const reservation = await getReservationByToken(token);
  if (!reservation) redirect(`/${locale}/reserver`);

  // Paiement déjà passé — retour tardif, second onglet, webhook plus rapide que
  // le navigateur : on ne repropose pas de payer ce qui est réglé.
  if (reservation.status === "confirmed") {
    redirect(`/${locale}/reserver/confirmation/${token}`);
  }

  // L'expiration est décidée par la base, jamais par l'horloge du serveur web :
  // c'est PostgreSQL qui libère réellement les chambres (migration 0007).
  const expired = reservation.is_expired;

  const [rooms, roomMedia] = await Promise.all([
    getRoomTypes(),
    getMedia({ section: "room" }),
  ]);
  const room = rooms.find((r) => r.slug === reservation.room_type_slug);
  const photos = room ? roomMedia.filter((m) => m.room_type_id === room.id) : [];
  const cover = photos.find((m) => m.is_cover) ?? photos[0];

  const content = reservation.room_type[lang] ?? reservation.room_type.fr;

  const depositPercent = Math.round(
    (reservation.deposit_amount_xof / reservation.total_amount_xof) * 100
  );

  return (
    <>
      <BookingSteps current={3} />

      <div className="mx-auto max-w-2xl px-5 py-12 lg:px-8 lg:py-14">
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
            <h1 className="font-display text-3xl">{t("recapTitle")}</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-brown-soft">
              {t("recapLead")}
            </p>

            {/* Le compte à rebours passe AVANT la carte : c'est l'information
                qui inquiète, elle ne doit pas se découvrir plus bas. */}
            {reservation.hold_expires_at ? (
              <div className="mt-6">
                <HoldCountdown expiresAt={reservation.hold_expires_at} />
              </div>
            ) : null}

            <div className="mt-7">
              <RecapCard
                reservation={reservation}
                roomName={content.name}
                roomShort={content.short}
                coverPath={cover?.storage_path}
                depositPercent={depositPercent}
              />
            </div>

            {/* Une seule action mise en avant. Le retour existe, mais il ne
                rivalise pas visuellement avec la marche à suivre. */}
            <div className="mt-8">
              <Link
                href="/reserver/paiement"
                className="btn btn-primary w-full justify-center"
              >
                {t("recapConfirm")}
                <ArrowRight size={16} aria-hidden />
              </Link>
            </div>

            {room ? (
              <div className="mt-5 text-center">
                <Link
                  href={{
                    pathname: "/reserver/informations",
                    query: {
                      room: room.id,
                      checkIn: reservation.check_in,
                      checkOut: reservation.check_out,
                      adults: String(reservation.adults),
                      children: String(reservation.children),
                    },
                  }}
                  className="inline-flex items-center gap-2 text-sm text-brown-soft transition-colors hover:text-bronze"
                >
                  <ArrowLeft size={15} aria-hidden />
                  {t("recapEdit")}
                </Link>
              </div>
            ) : null}

            <p className="mt-8 text-center text-xs text-brown-soft">
              {t("cancellationInfo", {
                hours: settings.free_cancellation_hours,
              })}
            </p>
          </>
        )}
      </div>
    </>
  );
}
