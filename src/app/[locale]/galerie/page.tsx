import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { GalleryGrid, type GalleryItem } from "@/components/site/gallery-grid";
import { getMedia } from "@/lib/content";
import type { Locale } from "@/types/database";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "gallery" });
  return { title: t("title"), description: t("lead") };
}

/** Regroupement des sections de la base vers les filtres affichés. */
const GROUP_OF: Record<string, GalleryItem["group"]> = {
  room: "rooms",
  hotel: "hotel",
  restaurant: "restaurant",
  bar: "restaurant",
  lounge: "hotel",
  grounds: "grounds",
};

export default async function GalleryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const lang = locale as Locale;

  const t = await getTranslations("gallery");
  const media = await getMedia({});

  const items: GalleryItem[] = media.map((m) => ({
    id: m.id,
    basePath: m.storage_path,
    alt: m.alt[lang] ?? m.alt.fr ?? "",
    group: GROUP_OF[m.section] ?? "hotel",
  }));

  return (
    <>
      {/* Ouverture typographique : sur une page de photographies, une image de
          plus en tête ne dirait rien — elle entrerait en concurrence avec la
          planche elle-même. */}
      <section className="mx-auto max-w-3xl px-5 pt-20 pb-12 text-center lg:pt-28">
        <p className="eyebrow">{t("subtitle")}</p>
        <h1 className="mt-6 font-display text-4xl leading-[1.1] text-balance sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-7 max-w-xl text-[17px] leading-relaxed text-brown-soft">
          {t("lead")}
        </p>
      </section>

      <div className="mx-auto max-w-6xl px-5 pb-section lg:px-8">
        {items.length === 0 ? (
          <p className="border border-dashed border-ivory-line bg-cream p-8 text-center text-sm text-brown-soft">
            Galerie indisponible : la base de données n&apos;est pas encore
            connectée à cet environnement.
          </p>
        ) : (
          <GalleryGrid items={items} />
        )}
      </div>
    </>
  );
}
