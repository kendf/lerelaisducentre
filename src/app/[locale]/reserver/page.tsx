import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AlertCircle } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { BookingSteps } from "@/components/booking/booking-steps";
import { StaySearchForm } from "@/components/booking/stay-search-form";
import { HotelImage } from "@/components/site/hotel-image";
import { getAvailability, getMedia, getPublicSettings } from "@/lib/content";
import { addDaysIso, formatXof, hotelToday, nightsBetween } from "@/lib/utils";
import { staySearchSchema } from "@/lib/validation/schemas";
import type { AvailabilityRow, Locale } from "@/types/database";

/**
 * Les disponibilités ne sont JAMAIS mises en cache : une chambre affichée
 * libre alors qu'elle vient d'être vendue est le pire défaut possible pour cet
 * écran. Rendu dynamique à chaque requête (CDC §7.1 : « les disponibilités
 * affichées aux visiteurs sont toujours à jour »).
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "booking" });
  // Le tunnel n'a aucune valeur en résultat de recherche et ne doit pas
  // concurrencer la page « Chambres » : on le laisse hors index.
  return { title: t("title"), robots: { index: false, follow: true } };
}

export default async function BookingPage({
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
  const tRooms = await getTranslations("rooms");
  const settings = await getPublicSettings();

  const today = hotelToday();
  const parsed = staySearchSchema.safeParse({
    checkIn: sp.checkIn ?? addDaysIso(today, 1),
    checkOut: sp.checkOut ?? addDaysIso(today, 2),
    adults: sp.adults ?? 2,
    children: sp.children ?? 0,
  });

  const search = parsed.success
    ? parsed.data
    : {
        checkIn: addDaysIso(today, 1),
        checkOut: addDaysIso(today, 2),
        adults: 2,
        children: 0,
      };

  // Une recherche n'est lancée que si l'URL porte des dates : à l'arrivée sur
  // la page, on montre le formulaire, pas une liste de chambres arbitraire.
  const hasQuery = Boolean(sp.checkIn && sp.checkOut);

  let rows: AvailabilityRow[] = [];
  let searchError: string | null = null;

  if (hasQuery) {
    try {
      rows = await getAvailability(search);
    } catch (error) {
      searchError = error instanceof Error ? error.message : "GENERIC";
    }
  }

  const media = await getMedia({ section: "room" });
  const nights = nightsBetween(search.checkIn, search.checkOut);
  const available = rows.filter((r) => r.is_available);

  return (
    <>
      <BookingSteps current={1} />

      {/* Aucune photographie dans le tunnel : à partir d'ici le visiteur
          exécute une tâche. Une grande image le distrairait de la seule chose
          qui compte — vérifier ses dates et aller au bout. */}
      <div className="mx-auto max-w-5xl px-5 py-14 lg:px-8 lg:py-16">
        <h1 className="font-display text-3xl">{t("searchTitle")}</h1>
        <div className="mt-8">
          <StaySearchForm defaults={search} />
        </div>

        <p className="mt-4 text-xs text-brown-soft">
          {t("arrivalInfo", {
            checkIn: settings.check_in_time,
            checkOut: settings.check_out_time,
          })}{" "}
          {t("cancellationInfo", { hours: settings.free_cancellation_hours })}
        </p>

        {searchError ? (
          <p
            role="alert"
            className="mt-10 flex items-start gap-2.5 border border-danger/30 bg-danger/8 p-5 text-sm"
          >
            <AlertCircle size={17} className="mt-0.5 shrink-0 text-danger" />
            {t("errors.GENERIC")}
          </p>
        ) : null}

        {hasQuery && !searchError ? (
          <section className="mt-14">
            <h2 className="text-2xl">
              {t("resultsTitle", { nights: tCommon("night", { count: nights }) })}
            </h2>

            {available.length === 0 ? (
              <p className="mt-6 border border-ivory-line bg-cream p-7 text-[15px] leading-relaxed text-brown-soft">
                {t("noResults")}
              </p>
            ) : (
              <ul className="mt-8 space-y-5">
                {available.map((row) => {
                  const c = row.content[lang] ?? row.content.fr;
                  const cover =
                    media.find(
                      (m) => m.room_type_id === row.room_type_id && m.is_cover
                    ) ?? media.find((m) => m.room_type_id === row.room_type_id);

                  return (
                    <li
                      key={row.room_type_id}
                      className="grid gap-6 border border-ivory-line bg-cream p-5 sm:grid-cols-[200px_1fr_auto] sm:items-center"
                    >
                      <div className="aspect-4/3 overflow-hidden sm:aspect-square">
                        {cover ? (
                          <HotelImage
                            basePath={cover.storage_path}
                            alt={cover.alt[lang] ?? c.name}
                            sizes="200px"
                          />
                        ) : null}
                      </div>

                      <div>
                        <h3 className="font-display text-xl">{c.name}</h3>
                        {c.short ? (
                          <p className="mt-1.5 text-sm text-brown-soft">{c.short}</p>
                        ) : null}
                        {/* Signal de rareté honnête : il vient du stock réel
                            restant, pas d'un compteur décoratif. */}
                        {row.units_free <= 2 ? (
                          <p className="mt-3 text-sm text-warning">
                            {tRooms("unitsAvailable", { count: row.units_free })}
                          </p>
                        ) : null}
                      </div>

                      <div className="text-right">
                        <p className="font-display text-2xl text-bronze">
                          {formatXof(row.total_price_xof, lang)}
                        </p>
                        <p className="text-xs text-brown-soft">
                          {tCommon("night", { count: nights })}
                        </p>
                        <Link
                          href={{
                            pathname: "/reserver/informations",
                            query: {
                              room: row.room_type_id,
                              checkIn: search.checkIn,
                              checkOut: search.checkOut,
                              adults: String(search.adults),
                              children: String(search.children),
                            },
                          }}
                          className="btn btn-primary mt-4 w-full sm:w-auto"
                        >
                          {t("select")}
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ) : null}
      </div>
    </>
  );
}
