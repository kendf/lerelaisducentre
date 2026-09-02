import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { HotelImage } from "@/components/site/hotel-image";
import { getPublicSettings, getRoomTypes } from "@/lib/content";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "hotel" });
  return { title: t("title"), description: t("lead") };
}

/* =============================================================================
   NOTRE MAISON — page de récit

   L'accueil s'ouvre sur une photographie ; celle-ci s'ouvre sur du TEXTE. Une
   page qui raconte l'histoire d'une maison ne doit pas commencer par la même
   image que la page qui la vend : elle commence par une voix.

   D'où trois écarts assumés avec l'accueil :
     - ouverture typographique centrée, la photographie vient après ;
     - lettrine sur le premier paragraphe, comme dans un texte suivi ;
     - les valeurs sont une liste verticale rythmée par des filets, pas trois
       cartes alignées — on lit une profession de foi, on ne compare pas des
       options.
   ============================================================================= */

export default async function OurHousePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("hotel");
  const tHome = await getTranslations("home");
  const tBooking = await getTranslations("booking");
  const [roomTypes, settings] = await Promise.all([
    getRoomTypes(),
    getPublicSettings(),
  ]);

  const totalRooms = roomTypes.reduce((sum, r) => sum + r.total_units, 0);
  const paragraphs = t("storyBody").split("\n\n");

  const values = [
    { title: t("value1Title"), body: t("value1Body") },
    { title: t("value2Title"), body: t("value2Body") },
    { title: t("value3Title"), body: t("value3Body") },
  ];

  return (
    <>
      {/* --- Ouverture typographique -------------------------------------- */}
      <section className="mx-auto max-w-3xl px-5 pt-20 pb-14 text-center lg:pt-28">
        <p className="eyebrow">{t("subtitle")}</p>
        <h1 className="mt-6 font-display text-4xl leading-[1.1] text-balance sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-7 max-w-xl text-lg leading-relaxed text-brown-soft">
          {t("lead")}
        </p>
      </section>

      {/* La photographie vient APRÈS la voix, sommée de l'arche de la maison. */}
      <div className="mx-auto max-w-5xl px-5 lg:px-8">
        <div className="arch aspect-4/3 bg-ivory-line sm:aspect-16/9">
          <HotelImage
            basePath="/images/hotel/08"
            alt=""
            sizes="(min-width: 1024px) 960px, 100vw"
            priority
          />
        </div>
      </div>

      {/* --- Le récit ------------------------------------------------------- */}
      <section className="mx-auto max-w-3xl px-5 py-section">
        <h2 className="text-3xl sm:text-4xl">{t("storyTitle")}</h2>

        {paragraphs.map((paragraph, i) => (
          <p
            key={i}
            className={`mt-6 text-[17px] leading-[1.75] text-brown-soft ${
              i === 0 ? "dropcap" : ""
            }`}
          >
            {paragraph}
          </p>
        ))}
      </section>

      {/* --- Ce à quoi nous tenons ------------------------------------------
          Liste verticale rythmée par des filets. Trois cartes côte à côte
          inviteraient à comparer ; ici il n'y a rien à comparer, il y a un
          engagement à lire de bout en bout.
          -------------------------------------------------------------------- */}
      <section className="border-y border-ivory-line bg-ivory-deep py-section">
        <div className="mx-auto max-w-4xl px-5 lg:px-8">
          <div className="max-w-xl">
            <p className="eyebrow eyebrow-rule">{t("valuesTitle")}</p>
            <p className="mt-6 text-[17px] leading-relaxed text-brown-soft">
              {t("valuesLead")}
            </p>
          </div>

          <dl className="mt-12 divide-y divide-ivory-line border-t border-ivory-line">
            {values.map((value) => (
              <div
                key={value.title}
                className="grid gap-3 py-8 md:grid-cols-[minmax(0,14rem)_1fr] md:gap-10"
              >
                <dt className="font-display text-xl text-balance">
                  {value.title}
                </dt>
                <dd className="text-[15px] leading-relaxed text-brown-soft">
                  {value.body}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* --- Chiffres et cadre ---------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-5 py-section lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="aspect-4/5 overflow-hidden">
            <HotelImage
              basePath="/images/cadre/06"
              alt=""
              sizes="(min-width: 1024px) 50vw, 100vw"
            />
          </div>

          <div>
            <p className="eyebrow eyebrow-rule">{t("figuresTitle")}</p>

            <dl className="mt-8 divide-y divide-ivory-line border-y border-ivory-line">
              {[
                // Libellés puisés dans les messages existants : aucun texte en
                // dur sur un site bilingue, sinon la version anglaise se
                // retrouve avec des mots français au milieu.
                {
                  label: tHome("statRooms"),
                  value: totalRooms > 0 ? String(totalRooms) : "—",
                },
                {
                  label: tHome("statCategories"),
                  value: roomTypes.length > 0 ? String(roomTypes.length) : "—",
                },
                { label: tBooking("checkIn"), value: settings.check_in_time },
                { label: tBooking("checkOut"), value: settings.check_out_time },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-baseline justify-between gap-6 py-4"
                >
                  <dt className="text-sm text-brown-soft first-letter:uppercase">
                    {row.label}
                  </dt>
                  <dd className="numeric text-lg font-medium text-bronze">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>

            <Link href="/chambres" className="btn btn-outline mt-9">
              {tHome("roomsCta")}
            </Link>
          </div>
        </div>
      </section>

      {/* --- La signature ---------------------------------------------------- */}
      <section className="relative overflow-hidden py-24 lg:py-28">
        <HotelImage
          basePath="/images/cadre/04"
          alt=""
          sizes="100vw"
          className="absolute inset-0"
        />
        <div className="absolute inset-0 bg-brown/72" aria-hidden />
        <div className="relative mx-auto max-w-xl px-5 text-center">
          <p className="text-sm leading-relaxed text-ivory/80">
            {t("quoteLead")}
          </p>
          <p className="signature mt-4 text-5xl text-ivory sm:text-6xl">
            {t("quote")}
          </p>
        </div>
      </section>
    </>
  );
}
