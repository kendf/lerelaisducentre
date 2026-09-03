import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, MapPin } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { HotelImage } from "@/components/site/hotel-image";
import { RotatingImage } from "@/components/site/rotating-image";
import { StaySearchForm } from "@/components/booking/stay-search-form";
import { getMedia, getPublicSettings, getRoomTypes } from "@/lib/content";
import { addDaysIso, formatXof, hotelToday } from "@/lib/utils";
import type { Locale } from "@/types/database";

// Le contenu change rarement : on sert une page statique régénérée toutes les
// 5 minutes. Les disponibilités, elles, sont toujours lues en direct dans le
// tunnel de réservation — jamais mises en cache (CDC §7.1).
export const revalidate = 300;

/* =============================================================================
   DIRECTION ARTISTIQUE DE L'ACCUEIL

   Le Relais n'est pas un resort : c'est une maison de bord de route, dont
   l'identité tient dans un médaillon ivoire. Trois décisions en découlent, et
   elles s'écartent délibérément des codes du complexe hôtelier.

   1. L'IVOIRE DOMINE, PAS LA PHOTOGRAPHIE. Pas de bandeau plein cadre où le
      titre flotte sur un voile sombre : l'ouverture est un diptyque — panneau
      ivoire à gauche, photographie à droite. Le fond de la marque reste la
      couleur de la marque (CDC §5.1 : « tons crème et bronze »).

   2. L'ARCHE EST LE SEUL GESTE. Les photographies principales sont sommées
      d'un arc, emprunté au médaillon du logo et au registre d'une maison qui
      accueille. Tout le reste est en lignes droites. Un motif tenu vaut mieux
      que trois motifs empilés.

   3. LA PAUSE EST UNE SECTION. « Le temps d'une pause » n'est pas une ligne
      perdue dans un pied de page : elle occupe une bande entière, presque
      vide. C'est la promesse de l'établissement, elle mérite du silence
      autour d'elle.
   ============================================================================= */

/** Visuels du panneau d'ouverture, alternés lentement. */
const HERO_IMAGES = [
  "/images/hotel/03",
  "/images/chambres/suite/02",
  "/images/cadre/05",
];

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("home");
  const tCommon = await getTranslations("common");
  const tServices = await getTranslations("services");
  const tRooms = await getTranslations("rooms");
  const lang = locale as Locale;

  const [roomTypes, roomMedia, settings] = await Promise.all([
    getRoomTypes(),
    getMedia({ section: "room" }),
    getPublicSettings(),
  ]);

  const coverFor = (roomTypeId: string) =>
    roomMedia.find((m) => m.room_type_id === roomTypeId && m.is_cover) ??
    roomMedia.find((m) => m.room_type_id === roomTypeId);

  // Les chiffres viennent du catalogue réel, jamais d'une valeur écrite en dur :
  // le jour où l'hôtel ajoute une catégorie, la page se met à jour seule.
  const totalRooms = roomTypes.reduce((sum, r) => sum + r.total_units, 0);

  const today = hotelToday();
  const searchDefaults = {
    checkIn: addDaysIso(today, 1),
    checkOut: addDaysIso(today, 2),
    adults: 2,
    children: 0,
  };

  const services = [
    {
      title: tServices("restaurantTitle"),
      body: tServices("restaurantBody"),
      hours: tServices("restaurantHours"),
      image: "/images/restaurant/04",
    },
    {
      title: tServices("barTitle"),
      body: tServices("barBody"),
      hours: tServices("barHours"),
      image: "/images/bar/02",
    },
    {
      title: tServices("groundsTitle"),
      body: tServices("groundsBody"),
      hours: null,
      image: "/images/cadre/03",
    },
  ];

  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    settings.hotel_contact.maps_query
  )}`;

  return (
    <>
      {/* =====================================================================
          1. DIPTYQUE D'OUVERTURE
          Panneau ivoire porteur du discours et de la recherche, photographie
          en vis-à-vis. Sur mobile, la photographie passe au-dessus : on montre
          la maison avant de parler d'elle.
          ===================================================================== */}
      <section className="grid lg:min-h-[86svh] lg:grid-cols-[minmax(0,47%)_1fr]">
        <div className="order-2 flex flex-col justify-center px-5 py-12 lg:order-1 lg:px-14 lg:py-16">
          <p className="eyebrow eyebrow-rule">{t("heroKicker")}</p>

          <h1
            className="mt-7 max-w-lg font-display font-normal leading-[1.08] tracking-tight text-balance"
            style={{ fontSize: "clamp(2.2rem, 3.4vw, 3.4rem)" }}
          >
            {t("heroTitle")}
          </h1>
          <p className="signature mt-2 text-4xl sm:text-5xl">
            Le temps d&apos;une pause
          </p>

          <p className="mt-7 max-w-md text-[15px] leading-relaxed text-brown-soft">
            {t("heroSubtitle")}
          </p>

          {/* La recherche vit DANS le panneau, elle ne flotte pas par-dessus
              l'image : le premier geste attendu du visiteur fait partie du
              discours d'accueil, il ne s'y superpose pas. */}
          <div className="mt-10 max-w-md border-t border-ivory-line pt-8">
            <StaySearchForm defaults={searchDefaults} variant="panel" />
          </div>
        </div>

        <div className="relative order-1 h-[52svh] lg:order-2 lg:h-auto">
          <RotatingImage
            images={HERO_IMAGES}
            alt=""
            priority
            className="arch-corner absolute inset-0"
          />
        </div>
      </section>

      {/* =====================================================================
          2. LA PAUSE — une bande presque vide
          ===================================================================== */}
      <section className="border-y border-ivory-line bg-ivory-deep px-5 py-14 text-center lg:py-16">
        <p className="mx-auto max-w-2xl font-display text-2xl leading-relaxed text-balance sm:text-3xl">
          {t("introTitle")}
        </p>
        <p className="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-brown-soft">
          {t("welcomeP2")}
        </p>

        {totalRooms > 0 ? (
          <dl className="mx-auto mt-12 flex max-w-lg justify-center divide-x divide-ivory-line">
            {[
              { value: String(totalRooms), label: t("statRooms") },
              { value: String(roomTypes.length), label: t("statCategories") },
              { value: t("statReceptionValue"), label: t("statReception") },
            ].map((stat) => (
              <div key={stat.label} className="px-7">
                <dt className="numeric text-2xl font-medium text-bronze">
                  {stat.value}
                </dt>
                <dd className="mt-1 text-xs uppercase tracking-wider text-brown-soft">
                  {stat.label}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </section>

      {/* =====================================================================
          3. CHAMBRES — portraits sommés d'une arche
          Format vertical et arc plein cintre : une porte de chambre, pas une
          vignette de catalogue.
          ===================================================================== */}
      <section className="mx-auto max-w-6xl px-5 py-section lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl">
            <p className="eyebrow eyebrow-rule">{t("roomsEyebrow")}</p>
            <h2 className="mt-5 text-3xl sm:text-4xl">{t("roomsTitle")}</h2>
          </div>
          <Link href="/chambres" className="btn btn-outline">
            {t("roomsCta")}
          </Link>
        </div>

        {roomTypes.length > 0 ? (
          <ul className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {roomTypes.map((room) => {
              const c = room.content[lang] ?? room.content.fr;
              const cover = coverFor(room.id);

              return (
                <li key={room.id}>
                  <Link
                    href={{
                      pathname: "/chambres/[slug]",
                      params: { slug: room.slug },
                    }}
                    className="group block"
                  >
                    <div className="arch aspect-3/4 bg-ivory-line">
                      {cover ? (
                        <HotelImage
                          basePath={cover.storage_path}
                          alt={cover.alt[lang] ?? c.name}
                          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                          className="transition-transform duration-700 group-hover:scale-[1.04]"
                        />
                      ) : null}
                    </div>

                    <h3 className="mt-6 text-center font-display text-xl transition-colors group-hover:text-bronze">
                      {c.name}
                    </h3>
                    <p className="mt-2 text-center text-sm text-brown-soft">
                      {tRooms("capacityValue", {
                        adults: room.max_adults,
                        children: room.max_children,
                      })}
                      {room.surface_m2 ? ` · ${room.surface_m2} m²` : ""}
                    </p>
                    <p className="mt-3 text-center">
                      <span className="text-xs text-brown-soft">
                        {tCommon("from")}{" "}
                      </span>
                      <span className="numeric text-lg font-medium text-bronze">
                        {formatXof(room.base_price_xof, lang)}
                      </span>
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-12 border border-dashed border-ivory-line bg-cream p-8 text-sm text-brown-soft">
            Catalogue indisponible : la base de données n&apos;est pas encore
            connectée à cet environnement.
          </p>
        )}
      </section>

      {/* =====================================================================
          4. LA MAISON — panoramique puis récit centré
          Une seule image très large, puis un texte en colonne étroite. Pas de
          collage : la maison se raconte, elle ne s'étale pas.
          ===================================================================== */}
      <section className="bg-ivory-deep py-section">
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <div className="aspect-21/9 overflow-hidden">
            <HotelImage
              basePath="/images/hotel/07"
              alt=""
              sizes="(min-width: 1024px) 1152px, 100vw"
            />
          </div>

          <div className="mx-auto mt-14 max-w-2xl text-center">
            <p className="eyebrow">{t("introEyebrow")}</p>
            <p className="mt-6 text-[17px] leading-relaxed text-brown-soft">
              {t("introBody")}
            </p>
            <Link
              href="/notre-maison"
              className="mt-9 inline-flex items-center gap-2 text-sm font-medium uppercase tracking-[0.14em] text-bronze transition-colors hover:text-bronze-dark"
            >
              {tCommon("seeMore")}
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* =====================================================================
          5. SERVICES — bandes horizontales alternées
          Chaque adresse occupe toute la largeur, image et texte côte à côte,
          le sens s'inversant d'une bande à l'autre. Rien à voir avec trois
          cartes alignées : on parcourt la maison pièce par pièce.
          ===================================================================== */}
      <section className="mx-auto max-w-6xl px-5 py-section lg:px-8">
        <div className="max-w-xl">
          <p className="eyebrow eyebrow-rule">{t("servicesEyebrow")}</p>
          <h2 className="mt-5 text-3xl sm:text-4xl">{t("servicesTitle")}</h2>
          <p className="mt-5 text-[15px] leading-relaxed text-brown-soft">
            {t("servicesLead")}
          </p>
        </div>

        <div className="mt-14 space-y-14">
          {services.map((service, index) => (
            <article
              key={service.title}
              className="grid items-center gap-8 md:grid-cols-12 md:gap-12"
            >
              <div
                className={`aspect-4/3 overflow-hidden md:col-span-7 ${
                  index % 2 === 1 ? "md:order-2" : ""
                }`}
              >
                <HotelImage
                  basePath={service.image}
                  alt=""
                  sizes="(min-width: 768px) 58vw, 100vw"
                />
              </div>

              <div
                className={`md:col-span-5 ${index % 2 === 1 ? "md:order-1" : ""}`}
              >
                <h3 className="font-display text-2xl">{service.title}</h3>
                <p className="mt-4 text-[15px] leading-relaxed text-brown-soft">
                  {service.body}
                </p>
                {service.hours ? (
                  <p className="mt-5 text-xs uppercase tracking-wider text-bronze">
                    {service.hours}
                  </p>
                ) : null}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-14">
          <Link href="/services" className="btn btn-outline">
            {t("servicesCta")}
          </Link>
        </div>
      </section>

      {/* =====================================================================
          6. NOUS TROUVER — un panneau indicateur
          L'adresse posée en grand, comme sur un panneau de route. C'est le
          motif du lieu : une halte signalée sur un axe.
          ===================================================================== */}
      <section className="border-y border-ivory-line bg-ivory-deep px-5 py-section">
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow">{t("locationEyebrow")}</p>
          <p className="mx-auto mt-6 max-w-xl font-display text-3xl leading-tight text-balance sm:text-4xl">
            {t("locationAddress")}
          </p>
          <p className="mx-auto mt-6 max-w-lg text-[15px] leading-relaxed text-brown-soft">
            {t("locationBody")}
          </p>

          <p className="mt-6 inline-flex items-center gap-2 text-sm text-brown-soft">
            <MapPin size={15} className="text-bronze" />
            {t("locationHint")}
          </p>

          <div className="mt-9 flex flex-wrap justify-center gap-4">
            <a
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline"
            >
              {t("openMap")}
            </a>
            <Link href="/contact" className="btn btn-outline">
              {t("locationCta")}
            </Link>
          </div>
        </div>
      </section>

      {/* =====================================================================
          7. RÉSERVER — arche centrale
          Le motif d'ouverture revient en clôture, cette fois centré : la page
          se referme sur la porte par laquelle elle a commencé.
          ===================================================================== */}
      <section className="mx-auto max-w-4xl px-5 py-section text-center lg:px-8">
        <div className="arch mx-auto aspect-4/5 max-w-xs bg-ivory-line">
          <HotelImage
            basePath="/images/chambres/familiale/02"
            alt=""
            sizes="320px"
          />
        </div>

        <p className="eyebrow mt-12">{t("bookEyebrow")}</p>
        <h2 className="mt-4 text-3xl sm:text-4xl">{t("bookTitle")}</h2>
        <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-brown-soft">
          {t("bookBody")}
        </p>
        <p className="mx-auto mt-4 max-w-xl text-sm text-brown-soft">
          {t("depositNote", {
            percent: settings.deposit_percent,
            hours: settings.free_cancellation_hours,
          })}
        </p>

        <Link href="/reserver" className="btn btn-primary mt-9">
          {tCommon("book")}
        </Link>
      </section>
    </>
  );
}
