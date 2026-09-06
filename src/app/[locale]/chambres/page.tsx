import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, BedDouble, Maximize2, Users } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { HotelImage } from "@/components/site/hotel-image";
import { StaySearchForm } from "@/components/booking/stay-search-form";
import { getMedia, getPublicSettings, getRoomTypes } from "@/lib/content";
import { addDaysIso, formatXof, hotelToday } from "@/lib/utils";
import type { Locale } from "@/types/database";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "rooms" });
  return { title: t("title"), description: t("lead") };
}

/* =============================================================================
   CHAMBRES & SUITES

   Le visiteur vient voir À QUOI RESSEMBLENT les chambres, puis vérifier ses
   dates. La page suit cet ordre :

     - un bandeau photographique pleine largeur, qui pose le niveau de
       l'établissement avant tout argument ;
     - la barre de disponibilité, collée sous l'en-tête pendant qu'on fait
       défiler les catégories : la question des dates suit le regard ;
     - une entrée par catégorie, chacune ouverte par une COMPOSITION À DEUX
       PHOTOGRAPHIES. Une seule image montre une chambre ; deux images qui se
       chevauchent en montrent l'ambiance et un détail, et donnent à la page le
       relief qui manque à un alignement de vignettes.

   La photographie secondaire est ARQUÉE — le médaillon du logo — et cernée
   d'un liseré ivoire qui la détache. C'est là que se loge la fantaisie, et
   elle reste dans le vocabulaire de la maison.
   ============================================================================= */

export default async function RoomsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const lang = locale as Locale;

  const t = await getTranslations("rooms");
  const tCommon = await getTranslations("common");
  const tHome = await getTranslations("home");

  const [roomTypes, media, settings] = await Promise.all([
    getRoomTypes(),
    getMedia({ section: "room" }),
    getPublicSettings(),
  ]);

  const today = hotelToday();
  const searchDefaults = {
    checkIn: addDaysIso(today, 1),
    checkOut: addDaysIso(today, 2),
    adults: 2,
    children: 0,
  };

  const roomOptions = roomTypes.map((room) => ({
    id: room.id,
    name: (room.content[lang] ?? room.content.fr).name,
  }));

  return (
    <>
      {/* --- Bandeau pleine largeur ---------------------------------------- */}
      <section className="relative h-[52vh] min-h-[340px] w-full overflow-hidden">
        <HotelImage
          basePath="/images/chambres/suite/04"
          alt=""
          sizes="100vw"
          priority
          className="absolute inset-0"
        />
        <div className="absolute inset-0 bg-brown/55" aria-hidden />
        <div className="relative mx-auto flex h-full max-w-6xl flex-col justify-end px-5 pb-14 lg:px-8">
          <p className="eyebrow eyebrow-rule text-bronze-tint">
            {t("subtitle")}
          </p>
          <h1 className="mt-4 max-w-2xl font-display text-4xl leading-[1.08] text-balance text-ivory sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ivory/85">
            {t("lead")}
          </p>
        </div>
      </section>

      {/* --- Barre de disponibilité ----------------------------------------
          Collée sous l'en-tête pendant le défilement : le visiteur compare les
          catégories sans jamais perdre de vue la question de ses dates.
          -------------------------------------------------------------------- */}
      <div className="sticky top-20 z-30 border-y border-ivory-line bg-ivory/95 backdrop-blur">
        <div className="mx-auto max-w-6xl px-5 py-4 lg:px-8">
          <StaySearchForm
            defaults={searchDefaults}
            roomTypes={roomOptions}
            variant="bar"
          />
        </div>
      </div>

      {roomTypes.length === 0 ? (
        <div className="mx-auto max-w-3xl px-5 py-section">
          <p className="border border-dashed border-ivory-line bg-cream p-8 text-center text-sm text-brown-soft">
            Catalogue indisponible : la base de données n&apos;est pas encore
            connectée à cet environnement.
          </p>
        </div>
      ) : (
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          {roomTypes.map((room, index) => {
            const c = room.content[lang] ?? room.content.fr;
            const photos = media.filter((m) => m.room_type_id === room.id);
            const main = photos.find((m) => m.is_cover) ?? photos[0];
            const inset = photos.find((m) => m.id !== main?.id);
            const reversed = index % 2 === 1;

            return (
              <article
                key={room.id}
                className="grid items-center gap-12 border-b border-ivory-line py-14 last:border-0 lg:grid-cols-2 lg:gap-16 lg:py-16"
              >
                {/* --- Composition à deux photographies -------------------- */}
                <div
                  className={`relative pb-14 pr-10 sm:pb-16 sm:pr-16 ${
                    reversed ? "lg:order-2" : ""
                  }`}
                >
                  <div className="arch-corner aspect-4/3 bg-ivory-line">
                    {main ? (
                      <HotelImage
                        basePath={main.storage_path}
                        alt={main.alt[lang] ?? c.name}
                        sizes="(min-width: 1024px) 50vw, 100vw"
                      />
                    ) : null}
                  </div>

                  {inset ? (
                    // Le liseré ivoire détache la vignette du cliché principal :
                    // sans lui, les deux images se confondent en une seule tache.
                    <div className="arch absolute right-0 bottom-0 aspect-3/4 w-[38%] bg-ivory ring-8 ring-ivory sm:w-[36%] sm:ring-[10px]">
                      <HotelImage
                        basePath={inset.storage_path}
                        alt=""
                        sizes="(min-width: 1024px) 20vw, 40vw"
                      />
                    </div>
                  ) : null}
                </div>

                {/* --- Informations --------------------------------------- */}
                <div className={reversed ? "lg:order-1" : ""}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                    <h2 className="font-display text-3xl">{c.name}</h2>
                    <p className="text-right">
                      <span className="price text-2xl font-medium text-bronze">
                        {formatXof(room.base_price_xof)}
                      </span>
                      <span className="block text-xs text-brown-soft">
                        {tCommon("perNight")}
                      </span>
                    </p>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-x-7 gap-y-2 border-y border-ivory-line py-4 text-sm text-brown-soft">
                    <span className="inline-flex items-center gap-2">
                      <Users size={15} className="text-bronze" />
                      {t("capacityValue", {
                        adults: room.max_adults,
                        children: room.max_children,
                      })}
                    </span>
                    {room.surface_m2 ? (
                      <span className="inline-flex items-center gap-2">
                        <Maximize2 size={15} className="text-bronze" />
                        <span className="numeric">{room.surface_m2} m²</span>
                      </span>
                    ) : null}
                    {room.bed_config ? (
                      <span className="inline-flex items-center gap-2">
                        <BedDouble size={15} className="text-bronze" />
                        {room.bed_config}
                      </span>
                    ) : null}
                  </div>

                  {c.short ? (
                    <p className="signature mt-5 text-2xl">{c.short}</p>
                  ) : null}
                  {c.description ? (
                    <p className="mt-3 text-[15px] leading-relaxed text-brown-soft">
                      {c.description}
                    </p>
                  ) : null}

                  {room.amenities.length > 0 ? (
                    <ul className="mt-6 flex flex-wrap gap-2">
                      {/* Six au plus : la fiche détaillée porte la liste
                          complète, ici on donne le caractère. */}
                      {room.amenities.slice(0, 6).map((item) => (
                        <li key={item} className="chip">
                          {item}
                        </li>
                      ))}
                      {room.amenities.length > 6 ? (
                        <li className="chip border-dashed">
                          + {room.amenities.length - 6}
                        </li>
                      ) : null}
                    </ul>
                  ) : null}

                  <div className="mt-8 flex flex-wrap items-center gap-5">
                    <Link
                      href={{
                        pathname: "/chambres/[slug]",
                        params: { slug: room.slug },
                      }}
                      className="btn btn-primary"
                    >
                      {t("seeDetails")}
                    </Link>
                    <Link
                      href={{
                        pathname: "/reserver",
                        query: { room: room.slug },
                      }}
                      className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-[0.14em] text-bronze transition-colors hover:text-bronze-dark"
                    >
                      {tCommon("book")}
                      <ArrowRight size={15} />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}

          <p className="pb-section text-xs text-brown-soft">
            {tHome("depositNote", {
              percent: settings.deposit_percent,
              hours: settings.free_cancellation_hours,
            })}
          </p>
        </div>
      )}
    </>
  );
}
