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

  // Une seule requête pour TOUS les visuels de chambres, plutôt qu'une par
  // catégorie : la page en a besoin deux fois — la galerie de cette chambre,
  // et les vignettes des autres en bas de page. Les 24 visuels du catalogue
  // tiennent dans une réponse ; trois requêtes de plus ne se justifieraient pas.
  const [roomMedia, allRooms, settings] = await Promise.all([
    getMedia({ section: "room" }),
    getRoomTypes(),
    getPublicSettings(),
  ]);

  const photos = roomMedia.filter((m) => m.room_type_id === room.id);
  const others = allRooms.filter((r) => r.id !== room.id);

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
      value: formatXof(room.base_price_xof),
      accent: true,
    },
  ];

  return (
    <>
      {/* --- HÉRO : le titre posé sur la chambre elle-même --------------------
          La version précédente empilait titre, tableau de faits, puis une
          photographie. Trois blocs pour une seule information : « voici cette
          chambre ». Le visiteur devait descendre pour découvrir ce qu'il venait
          voir. Ici la photographie EST la page, le nom et le tarif se lisent
          dessus, et la première chose à l'écran est la chambre.
          -------------------------------------------------------------------- */}
      <section className="relative flex min-h-[58svh] flex-col overflow-hidden lg:min-h-[64svh]">
        <div className="absolute inset-0 bg-ivory-line">
          {cover ? (
            <HotelImage
              basePath={cover.storage_path}
              alt={cover.alt[lang] ?? c.name}
              sizes="100vw"
              priority
            />
          ) : null}
        </div>

        {/* Voile indispensable : le tarif doit rester lisible qu'il tombe sur
            un mur clair ou sur une literie blanche. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-brown/90 via-brown/45 to-brown/55"
        />

        <div className="relative z-10 mx-auto w-full max-w-5xl px-5 pt-8 lg:px-8">
          <Link
            href="/chambres"
            className="inline-flex items-center gap-2 text-sm text-ivory/85 transition-colors hover:text-ivory"
          >
            <ArrowLeft size={15} />
            {tCommon("backToRooms")}
          </Link>
        </div>

        <div className="relative z-10 mx-auto mt-auto w-full max-w-5xl px-5 pb-12 lg:px-8 lg:pb-16">
          <h1 className="font-display text-4xl leading-[1.05] text-balance text-ivory sm:text-5xl lg:text-6xl">
            {c.name}
          </h1>
          {c.short ? (
            <p className="signature mt-2 text-3xl text-bronze-tint">{c.short}</p>
          ) : null}

          <dl className="mt-7 flex flex-wrap items-baseline gap-x-9 gap-y-3">
            {facts.map((fact) => (
              <div key={fact.label} className="flex items-baseline gap-2.5">
                <dt className="text-xs tracking-wider text-ivory/70 uppercase">
                  {fact.label}
                </dt>
                <dd
                  className={
                    fact.accent
                      ? "price text-2xl font-medium text-bronze-tint"
                      : "text-[15px] text-ivory"
                  }
                >
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* --- Le récit, et l'encart qui suit la lecture ------------------------ */}
      <section className="mx-auto max-w-5xl px-5 py-section lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1fr_320px] lg:gap-16">
          <div>
            <h2 className="text-2xl">{t("detailsTitle")}</h2>
            {c.description ? (
              <p className="mt-5 text-[17px] leading-[1.75] text-brown-soft">
                {c.description}
              </p>
            ) : null}
          </div>

          {/* L'encart suit la lecture : le tarif et le bouton ne sortent
              jamais de l'écran (CDC §5.4). */}
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="border border-ivory-line bg-cream p-7">
              <p className="text-sm text-brown-soft">{tCommon("from")}</p>
              <p className="mt-1">
                <span className="price text-3xl font-medium text-bronze">
                  {formatXof(room.base_price_xof)}
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

      {/* --- Équipements ------------------------------------------------------
          Sortis de la colonne de texte, où ils se lisaient comme une note de
          bas de page. Chaque équipement porte sa pastille : la liste se
          parcourt du regard au lieu de se lire ligne à ligne.
          -------------------------------------------------------------------- */}
      {room.amenities.length > 0 ? (
        <section className="mx-auto max-w-5xl px-5 py-section lg:px-8">
          <h2 className="text-2xl">{t("amenitiesTitle")}</h2>
          <ul className="mt-8 grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
            {room.amenities.map((item) => (
              <li
                key={item}
                className="flex items-center gap-3 text-[15px] text-brown-soft"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-bronze-tint text-bronze">
                  <Check size={17} aria-hidden />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* --- Autres chambres --------------------------------------------------
          Une fiche de chambre est une impasse : le visiteur que cette catégorie
          ne convainc pas doit remonter jusqu'à la navigation, puis rouvrir la
          liste. Les autres catégories sont donc posées ici, en fin de parcours,
          au moment exact où la question « et les autres ? » se pose.
          -------------------------------------------------------------------- */}
      {others.length > 0 ? (
        <section className="border-t border-ivory-line py-section">
          <div className="mx-auto max-w-5xl px-5 lg:px-8">
            <h2 className="text-2xl">{t("otherRooms")}</h2>

            <ul className="mt-9 grid gap-8 sm:grid-cols-3">
              {others.map((other) => {
                const oc = other.content[lang] ?? other.content.fr;
                const otherPhotos = roomMedia.filter(
                  (m) => m.room_type_id === other.id
                );
                const otherCover =
                  otherPhotos.find((m) => m.is_cover) ?? otherPhotos[0];

                return (
                  <li key={other.id}>
                    <Link
                      href={{
                        pathname: "/chambres/[slug]",
                        params: { slug: other.slug },
                      }}
                      className="group block text-center"
                    >
                      <div className="arch aspect-3/4 bg-ivory-line">
                        {otherCover ? (
                          <HotelImage
                            basePath={otherCover.storage_path}
                            alt=""
                            sizes="(min-width: 640px) 33vw, 100vw"
                            className="transition-transform duration-700 group-hover:scale-[1.04]"
                          />
                        ) : null}
                      </div>
                      <p className="mt-5 font-display text-lg transition-colors group-hover:text-bronze">
                        {oc.name}
                      </p>
                      <p className="price mt-1 text-sm text-brown-soft">
                        {formatXof(other.base_price_xof)}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ) : null}
    </>
  );
}
