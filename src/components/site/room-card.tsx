import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { HotelImage } from "@/components/site/hotel-image";
import { formatXof } from "@/lib/utils";
import type { Locale, MediaItem, RoomType } from "@/types/database";

interface RoomCardProps {
  room: RoomType;
  locale: Locale;
  cover?: MediaItem;
}

export async function RoomCard({ room, locale, cover }: RoomCardProps) {
  const t = await getTranslations("common");
  // `content` porte les deux langues ; on retombe sur le français si une
  // traduction manque, plutôt que d'afficher un blanc au visiteur.
  const c = room.content[locale] ?? room.content.fr;

  return (
    <article className="group flex flex-col">
      <Link href={{ pathname: "/chambres/[slug]", params: { slug: room.slug } }}>
        <div className="aspect-4/3 overflow-hidden bg-ivory-line">
          {cover ? (
            <HotelImage
              basePath={cover.storage_path}
              alt={cover.alt[locale] ?? c.name}
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
              className="transition-transform duration-700 group-hover:scale-[1.04]"
            />
          ) : null}
        </div>
      </Link>

      <div className="flex flex-1 flex-col pt-5">
        <h3 className="font-display text-xl">
          <Link
            href={{ pathname: "/chambres/[slug]", params: { slug: room.slug } }}
            className="transition-colors hover:text-bronze"
          >
            {c.name}
          </Link>
        </h3>
        {c.short ? (
          <p className="mt-2 flex-1 text-sm leading-relaxed text-brown-soft">
            {c.short}
          </p>
        ) : null}
        <p className="mt-4 text-sm text-brown">
          <span className="text-brown-soft">{t("from")} </span>
          <span className="font-display text-lg text-bronze">
            {formatXof(room.base_price_xof, locale)}
          </span>
          <span className="text-brown-soft"> {t("perNight")}</span>
        </p>
      </div>
    </article>
  );
}
