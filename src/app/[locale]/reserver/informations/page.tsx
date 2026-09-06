import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, BedDouble } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { BookingSteps } from "@/components/booking/booking-steps";
import {
  GuestDetailsForm,
  type GuestDefaults,
} from "@/components/booking/guest-details-form";
import { GUEST_COOKIE } from "@/lib/booking/hold-cookie";
import { getQuote, getRoomTypes } from "@/lib/content";
import { staySearchSchema } from "@/lib/validation/schemas";
import type { Locale } from "@/types/database";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "booking" });
  return { title: t("step2"), robots: { index: false, follow: false } };
}

export default async function GuestDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const lang = locale as Locale;

  const t = await getTranslations("booking");
  const tCommon = await getTranslations("common");
  const format = await getFormatter();

  const roomTypeId = typeof sp.room === "string" ? sp.room : null;
  const parsed = staySearchSchema.safeParse({
    checkIn: sp.checkIn,
    checkOut: sp.checkOut,
    adults: sp.adults ?? 2,
    children: sp.children ?? 0,
  });

  // Arrivée directe sur l'étape 2 sans séjour valide : on renvoie à l'étape 1
  // plutôt que d'afficher un formulaire qui ne mènerait nulle part.
  if (!roomTypeId || !parsed.success) {
    redirect(`/${locale}/reserver`);
  }

  const stay = parsed.data;
  const [quote, roomTypes] = await Promise.all([
    getQuote({ roomTypeId, ...stay }),
    getRoomTypes(),
  ]);

  // Le devis est refusé par la base (dates passées, chambre dépubliée, séjour
  // trop long…) : inutile de laisser le visiteur remplir ses coordonnées.
  if (!quote) {
    redirect(`/${locale}/reserver`);
  }

  const room = roomTypes.find((r) => r.id === roomTypeId);
  const roomName = room
    ? (room.content[lang] ?? room.content.fr).name
    : quote.room_type_slug;

  // Coordonnées d'une saisie précédente. Le contenu du cookie vient du
  // navigateur : on ne lui fait pas confiance, on le passe au crible d'un
  // schéma avant d'en faire quoi que ce soit — un JSON tordu ne doit pas
  // pouvoir casser le rendu de la page.
  const defaults = readGuestDefaults(
    (await cookies()).get(GUEST_COOKIE)?.value
  );

  const dateRange = `${format.dateTime(new Date(`${stay.checkIn}T12:00:00Z`), "long")} → ${format.dateTime(new Date(`${stay.checkOut}T12:00:00Z`), "long")}`;

  return (
    <>
      <BookingSteps current={2} />

      <div className="mx-auto max-w-5xl px-5 py-14 lg:px-8 lg:py-16">
        <Link
          href={{
            pathname: "/reserver",
            query: {
              checkIn: stay.checkIn,
              checkOut: stay.checkOut,
              adults: String(stay.adults),
              children: String(stay.children),
            },
          }}
          className="inline-flex items-center gap-2 text-sm text-brown-soft transition-colors hover:text-bronze"
        >
          <ArrowLeft size={15} />
          {t("back")}
        </Link>

        <div className="mt-8 max-w-2xl">
          <h1 className="font-display text-3xl">{t("detailsTitle")}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-brown-soft">
            {t("detailsLead")}
          </p>

          {/* Rappel d'UNE LIGNE, sans le moindre montant. Le récapitulatif
              complet est passé à l'étape 3 : vérifier des chiffres et saisir
              des coordonnées sont deux gestes différents, et les mêler faisait
              qu'aucun des deux n'était fait correctement. Reste ici le strict
              nécessaire pour ne pas oublier ce qu'on est en train de réserver. */}
          <p className="mt-6 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-y border-ivory-line py-3 text-sm text-brown-soft">
            <BedDouble
              size={16}
              className="shrink-0 text-bronze-soft"
              aria-hidden
            />
            <span className="text-brown">{roomName}</span>
            <span aria-hidden>·</span>
            <span>{dateRange}</span>
            <span aria-hidden>·</span>
            <span>{tCommon("night", { count: quote.nights })}</span>
          </p>

          <div className="mt-8">
            <GuestDetailsForm stay={{ roomTypeId, ...stay }} defaults={defaults} />
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Relecture défensive du cookie de saisie.
 *
 * Le cookie est httpOnly, donc hors de portée du JavaScript de la page — mais
 * il reste une donnée envoyée par le client, et une donnée envoyée par le
 * client se valide. On ne garde que des chaînes, tronquées : un cookie forgé
 * ne peut ni faire lever le `JSON.parse`, ni injecter un objet inattendu dans
 * les props du formulaire.
 */
function readGuestDefaults(raw: string | undefined): GuestDefaults | undefined {
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return undefined;
    const o = parsed as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" ? v.slice(0, 500) : "");
    return {
      firstName: str(o.firstName),
      lastName: str(o.lastName),
      email: str(o.email),
      phone: str(o.phone),
      country: str(o.country),
      notes: str(o.notes),
    };
  } catch {
    return undefined;
  }
}
