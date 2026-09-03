import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Car, Clock, CreditCard, Shirt, Sparkles, Wifi } from "lucide-react";

import { HotelImage } from "@/components/site/hotel-image";
import { getPublicSettings } from "@/lib/content";
import { cn } from "@/lib/utils";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "services" });
  return { title: t("title"), description: t("lead") };
}

/* =============================================================================
   SERVICES

   L'accueil présente déjà les trois adresses en bandes alternées. Cette page
   ne peut donc pas répéter la même figure, sinon elle n'apporte rien.

   Elle est construite comme la visite d'une maison :
     - un TRIPTYQUE d'ouverture qui sert d'index — trois arches, trois noms,
       trois ancres. On choisit par où commencer ;
     - puis chaque lieu occupe une bande CONTENUE, image d'un côté, texte de
       l'autre, en alternance.

   POURQUOI PLUS DE PLEINE LARGEUR ICI. La version précédente posait un panneau
   crème remonté de -4 rem sur une photographie pleine largeur. L'image était
   en position absolue dans un conteneur positionné, le panneau ne l'était pas :
   l'image se peignait donc PAR-DESSUS le texte et coupait le titre de chaque
   lieu. Le défaut n'était pas dans le chevauchement lui-même mais dans l'ordre
   d'empilement — et un chevauchement qui dépend d'un z-index implicite est une
   figure fragile, qui se recasse à la première modification.

   La composition contenue supprime la cause plutôt que le symptôme : plus
   aucun élément ne passe devant un autre. Elle raccourcit aussi la page d'un
   tiers, ce que la lecture au défilement gagne directement.
   ============================================================================= */

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("services");
  const settings = await getPublicSettings();

  const venues = [
    {
      id: "restaurant",
      title: t("restaurantTitle"),
      body: t("restaurantBody"),
      hours: t("restaurantHours"),
      cover: "/images/restaurant/01",
      thumb: "/images/restaurant/05",
    },
    {
      id: "bar",
      title: t("barTitle"),
      body: t("barBody"),
      hours: t("barHours"),
      cover: "/images/bar/01",
      thumb: "/images/bar/02",
    },
    {
      id: "jardin",
      title: t("groundsTitle"),
      body: t("groundsBody"),
      hours: null,
      cover: "/images/cadre/02",
      thumb: "/images/cadre/04",
    },
  ];

  const practical = [
    { icon: Car, label: t("practical1") },
    { icon: Wifi, label: t("practical2") },
    { icon: Clock, label: t("practical3") },
    { icon: Shirt, label: t("practical4") },
    {
      icon: Sparkles,
      label: t("practical5", {
        checkIn: settings.check_in_time,
        checkOut: settings.check_out_time,
      }),
    },
    { icon: CreditCard, label: t("practical6") },
  ];

  return (
    <>
      <section className="mx-auto max-w-3xl px-5 pt-14 pb-10 text-center lg:pt-20">
        <p className="eyebrow">{t("subtitle")}</p>
        <h1 className="mt-6 font-display text-4xl leading-[1.1] text-balance sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-7 max-w-xl text-[17px] leading-relaxed text-brown-soft">
          {t("lead")}
        </p>
      </section>

      {/* --- Triptyque d'ouverture, qui sert d'index ------------------------ */}
      <nav
        aria-label={t("title")}
        className="mx-auto max-w-5xl px-5 pb-4 lg:px-8"
      >
        <ul className="grid gap-8 sm:grid-cols-3">
          {venues.map((venue) => (
            <li key={venue.id}>
              <a href={`#${venue.id}`} className="group block text-center">
                <div className="arch aspect-3/4 bg-ivory-line">
                  <HotelImage
                    basePath={venue.thumb}
                    alt=""
                    sizes="(min-width: 640px) 33vw, 100vw"
                    className="transition-transform duration-700 group-hover:scale-[1.04]"
                  />
                </div>
                <p className="mt-5 font-display text-lg transition-colors group-hover:text-bronze">
                  {venue.title}
                </p>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* --- Chaque lieu : image et texte côte à côte, en alternance -------- */}
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        {venues.map((venue, index) => (
          <div key={venue.id}>
            {/* Le filet ne sépare que deux lieux : il marque une série, il
                n'ouvre ni ne ferme la page. */}
            {index > 0 ? (
              <div className="rule-mark" aria-hidden="true">
                <i />
              </div>
            ) : null}

            <section id={venue.id} className="scroll-mt-28 py-12 lg:py-16">
              <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-14">
                <div
                  className={cn(
                    "lg:col-span-7",
                    // L'alternance évite la colonne unique qui donnerait à la
                    // page un rythme de catalogue.
                    index % 2 === 1 && "lg:order-2"
                  )}
                >
                  <div className="aspect-16/10 overflow-hidden bg-ivory-line">
                    <HotelImage
                      basePath={venue.cover}
                      alt=""
                      sizes="(min-width: 1024px) 58vw, 100vw"
                    />
                  </div>
                </div>

                <div className="lg:col-span-5">
                  <h2 className="text-3xl">{venue.title}</h2>
                  <p className="mt-5 text-[17px] leading-relaxed text-brown-soft">
                    {venue.body}
                  </p>
                  {venue.hours ? (
                    <p className="mt-6 border-t border-ivory-line pt-5 text-xs tracking-[0.14em] text-bronze uppercase">
                      {venue.hours}
                    </p>
                  ) : null}
                </div>
              </div>
            </section>
          </div>
        ))}
      </div>

      {/* --- Aspects pratiques ----------------------------------------------- */}
      <section className="border-t border-ivory-line bg-ivory-deep py-section">
        <div className="mx-auto max-w-4xl px-5 lg:px-8">
          <h2 className="text-center text-3xl">{t("practicalTitle")}</h2>

          <ul className="mt-12 grid gap-x-12 gap-y-6 sm:grid-cols-2">
            {practical.map((item) => (
              <li
                key={item.label}
                className="flex items-start gap-3.5 border-b border-ivory-line pb-5 text-[15px] text-brown-soft"
              >
                <item.icon size={17} className="mt-0.5 shrink-0 text-bronze" />
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
