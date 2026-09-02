"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { HotelImage } from "@/components/site/hotel-image";
import { cn } from "@/lib/utils";

export interface GalleryItem {
  id: string;
  basePath: string;
  alt: string;
  group: "rooms" | "hotel" | "restaurant" | "grounds";
}

const FILTERS = [
  { key: "all", label: "filterAll" },
  { key: "rooms", label: "filterRooms" },
  { key: "hotel", label: "filterHotel" },
  { key: "restaurant", label: "filterRestaurant" },
  { key: "grounds", label: "filterGrounds" },
] as const;

/**
 * Galerie filtrable avec agrandissement au clic.
 *
 * Accessibilité (CDC §8) : les vignettes sont des boutons, donc atteignables
 * au clavier ; la vue agrandie se ferme à la touche Échap et le défilement de
 * la page est bloqué tant qu'elle est ouverte.
 */
export function GalleryGrid({ items }: { items: GalleryItem[] }) {
  const t = useTranslations("gallery");
  const tNav = useTranslations("nav");
  const [filter, setFilter] = useState<string>("all");
  const [zoomed, setZoomed] = useState<GalleryItem | null>(null);

  useEffect(() => {
    if (!zoomed) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomed(null);
    };
    document.addEventListener("keydown", onKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [zoomed]);

  const visible =
    filter === "all" ? items : items.filter((item) => item.group === filter);

  return (
    <>
      <div className="flex flex-wrap justify-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={cn(
              "px-4 py-2 text-xs uppercase tracking-[0.14em] transition-colors",
              filter === f.key
                ? "bg-bronze text-ivory"
                : "text-brown-soft hover:text-bronze"
            )}
          >
            {t(f.label)}
          </button>
        ))}
      </div>

      {/* Mosaïque plutôt que damier : une image sur cinq occupe deux colonnes
          et deux rangées. Le rythme irrégulier fait respirer la planche et met
          en avant les meilleurs clichés, là où une grille régulière écrase tout
          au même niveau. */}
      <div className="mt-10 grid auto-rows-[minmax(0,14rem)] grid-cols-2 gap-3 lg:grid-cols-4">
        {visible.map((item, index) => {
          const wide = index % 5 === 0;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setZoomed(item)}
              className={cn(
                "group overflow-hidden bg-ivory-line",
                wide && "col-span-2 row-span-2"
              )}
            >
              <HotelImage
                basePath={item.basePath}
                alt={item.alt}
                sizes={
                  wide
                    ? "(min-width: 1024px) 50vw, 100vw"
                    : "(min-width: 1024px) 25vw, 50vw"
                }
                className="transition-transform duration-700 group-hover:scale-[1.04]"
              />
            </button>
          );
        })}
      </div>

      {zoomed ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={zoomed.alt}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-brown/92 p-4"
          onClick={() => setZoomed(null)}
        >
          <button
            type="button"
            onClick={() => setZoomed(null)}
            aria-label={tNav("close")}
            autoFocus
            className="absolute top-5 right-5 p-2 text-ivory transition-colors hover:text-bronze-tint"
          >
            <X size={26} />
          </button>
          <HotelImage
            basePath={zoomed.basePath}
            alt={zoomed.alt}
            sizes="100vw"
            className="max-h-[88vh] w-auto max-w-[92vw] object-contain"
          />
        </div>
      ) : null}
    </>
  );
}
