import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { BookingSteps } from "@/components/booking/booking-steps";
import { GuestDetailsForm } from "@/components/booking/guest-details-form";
import { StaySummary } from "@/components/booking/stay-summary";
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

        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_340px] lg:gap-14">
          <div>
            <h1 className="font-display text-3xl">{t("detailsTitle")}</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-brown-soft">
              {t("detailsLead")}
            </p>
            <div className="mt-8">
              <GuestDetailsForm stay={{ roomTypeId, ...stay }} />
            </div>
          </div>

          <StaySummary
            quote={quote}
            roomName={roomName}
            adults={stay.adults}
            childCount={stay.children}
            locale={lang}
          />
        </div>
      </div>
    </>
  );
}
