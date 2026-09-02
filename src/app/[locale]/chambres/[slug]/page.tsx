import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, Check } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { HotelImage } from "@/components/site/hotel-image";
import { getMedia, getPublicSettings, getRoomType, getRoomTypes } from "@/lib/content";
import { formatXof } from "@/lib/utils";
import type { Locale } from "@/types/database";

export const revalidate = 300;

/** Pré-génère les fiches des deux langues : elles sont servies en statique. */
export async function generateStaticParams() {
  const rooms = await getRoomTypes();
  return rooms.flatMap((room) =>
    ["fr", "en"].map((locale) => ({ locale, slug: room.slug }))
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const room = await getRoomType(slug);
  if (!room) return {};

  const c = room.content[locale as Locale] ?? room.content.fr;
  return { title: c.name, description: c.short ?? c.description };
}

/* =============================================================================
   FICHE CHAMBRE — la page de décision

   Le visiteur arrive ici presque convaincu ; il lui manque des faits et un
   bouton. La page les donne dans cet ordre, sans détour :

     - les chiffres d'abord, en bandeau : capacité, surface, couchage, tarif.
       Ce sont les quatre questions qui décident, elles ne doivent pas être
       cherchées au milieu d'un paragraphe ;
     - la grande photographie ensuite, sommée de l'arche de la maison ;
     - le texte et les équipements en vis-à-vis ;
     - l'encart de réservation reste visible pendant toute la lecture.
   ============================================================================= */

export default async function RoomDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const lang = locale as Locale;

  const room = await getRoomType(slug);
  if (!room) notFound();

  const t = await getTranslations("rooms");
  const tCommon = await getTranslations("common");
  const tHome = await getTranslations("home");

  const [photos, settings] = await Promise.all([
    getMedia({ roomTypeId: room.id }),
    getPublicSettings(),
  ]);

  const c = room.content[lang] ?? room.content.fr;
  const cover = photos.find((m) => m.is_cover) ?? photos[0];
  const rest = photos.filter((m) => m.id !== cover?.id);

  const facts = [
    {
      label: t("capacity"),
      value: t("capacityValue", {
        adults: room.max_adults,
        children: room.max_children,
      }),
    },
    {
      label: t("surface"),
      value: room.surface_m2 ? `${room.surface_m2} m²` : "—",
    },
    { label: t("bed"), value: room.bed_config ?? "—" },
    {
      label: tCommon("from"),
      value: formatXof(room.base_price_xof, lang),
      accent: true,
    },
  ];

  return (
    <>
      {/* --- Titre et faits ------------------------------------------------- */}
      <section className="mx-auto max-w-5xl px-5 pt-16 lg:px-8 lg:pt-20">
        <Link
          href="/chambres"
          className="inline-flex items-center gap-2 text-sm text-brown-soft transition-colors hover:text-bronze"
        >
          <ArrowLeft size={15} />
          {tCommon("backToRooms")}
        </Link>

        <h1 className="mt-7 font-display text-4xl leading-[1.1] text-balance sm:text-5xl">
          {c.name}
        </h1>
        {c.short ? (
          <p className="signature mt-2 text-3xl">{c.short}</p>
        ) : null}

        <dl className="mt-10 grid grid-cols-2 divide-ivory-line border-y border-ivory-line sm:grid-cols-4 sm:divide-x">
          {facts.map((fact) => (
            <div key={fact.label} className="px-1 py-5 sm:px-5 sm:first:pl-0">
              <dt className="text-xs uppercase tracking-wider text-brown-soft">
                {fact.label}
              </dt>
              <dd
                className={
                  fact.accent
                    ? "numeric mt-2 text-xl font-medium text-bronze"
                    : "mt-2 text-[15px]"
                }
              >
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* --- Photographie principale ---------------------------------------- */}
      <div className="mx-auto mt-12 max-w-5xl px-5 lg:px-8">
        <div className="arch aspect-4/3 bg-ivory-line sm:aspect-16/9">
          {cover ? (
            <HotelImage
              basePath={cover.storage_path}
              alt={cover.alt[lang] ?? c.name}
              sizes="(min-width: 1024px) 960px, 100vw"
              priority
            />
          ) : null}
        </div>
      </div>

      {/* --- Texte, équipements et réservation ------------------------------ */}
      <section className="mx-auto max-w-5xl px-5 py-section lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1fr_320px] lg:gap-16">
          <div>
            {c.description ? (
              <p className="text-[17px] leading-[1.75] text-brown-soft">
                {c.description}
              </p>
            ) : null}

            {room.amenities.length > 0 ? (
              <>
                <h2 className="mt-12 text-2xl">{t("amenitiesTitle")}</h2>
                <ul className="mt-6 grid gap-x-8 gap-y-3 border-t border-ivory-line pt-6 sm:grid-cols-2">
                  {room.amenities.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2.5 text-[15px] text-brown-soft"
                    >
                      <Check size={16} className="mt-0.5 shrink-0 text-bronze" />
                      {item}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>

          {/* L'encart suit la lecture : le tarif et le bouton ne sortent
              jamais de l'écran (CDC §5.4). */}
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="border border-ivory-line bg-cream p-7">
              <p className="text-sm text-brown-soft">{tCommon("from")}</p>
              <p className="mt-1">
                <span className="numeric text-3xl font-medium text-bronze">
                  {formatXof(room.base_price_xof, lang)}
                </span>
                <span className="text-sm text-brown-soft">
                  {" "}
                  {tCommon("perNight")}
                </span>
              </p>

              <Link
                href={{ pathname: "/reserver", query: { room: room.slug } }}
                className="btn btn-primary mt-7 w-full"
              >
                {tCommon("bookThisRoom")}
              </Link>

              <p className="mt-5 border-t border-ivory-line pt-5 text-xs leading-relaxed text-brown-soft">
                {tHome("depositNote", {
                  percent: settings.deposit_percent,
                  hours: settings.free_cancellation_hours,
                })}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-brown-soft">
                {t("checkAvailability")} —{" "}
                <Link href="/reserver" className="text-bronze hover:underline">
                  {tCommon("book")}
                </Link>
              </p>
            </div>
          </aside>
        </div>
      </section>

      {/* --- Galerie --------------------------------------------------------
          Première image en pleine largeur, les suivantes en trio : une
          composition, pas une grille régulière.
          -------------------------------------------------------------------- */}
      {rest.length > 0 ? (
        <section className="border-t border-ivory-line bg-ivory-deep py-section">
          <div className="mx-auto max-w-5xl px-5 lg:px-8">
            <h2 className="text-2xl">{t("galleryTitle")}</h2>

            <div className="mt-8 space-y-4">
              <div className="aspect-16/9 overflow-hidden">
                <HotelImage
                  basePath={rest[0]!.storage_path}
                  alt={rest[0]!.alt[lang] ?? c.name}
                  sizes="(min-width: 1024px) 960px, 100vw"
                />
              </div>

              {rest.length > 1 ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  {rest.slice(1, 4).map((photo) => (
                    <div
                      key={photo.id}
                      className="aspect-4/3 overflow-hidden"
                    >
                      <HotelImage
                        basePath={photo.storage_path}
                        alt={photo.alt[lang] ?? c.name}
                        sizes="(min-width: 640px) 33vw, 100vw"
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
