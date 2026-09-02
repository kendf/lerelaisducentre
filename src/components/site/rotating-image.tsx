"use client";

import { useEffect, useState } from "react";
import { HotelImage } from "./hotel-image";
import { cn } from "@/lib/utils";

/**
 * Fond photographique qui alterne lentement entre plusieurs visuels.
 *
 * Un hôtel se vend par ses images : une seule photographie fixe en tête de
 * page montre une chambre, une rotation lente en montre quatre sans demander
 * le moindre geste au visiteur.
 *
 * TROIS PRÉCAUTIONS qui font la différence entre un effet et une nuisance :
 *   - les visuels suivants ne sont montés qu'au PREMIER changement, donc bien
 *     après le premier affichage : le temps de chargement initial reste celui
 *     d'une image unique (CDC §8, « moins de 3 secondes sur mobile ») ;
 *   - la transition est un fondu long, jamais un défilement : rien ne bouge
 *     sous l'œil de quelqu'un qui lit le titre par-dessus ;
 *   - `prefers-reduced-motion` fige la rotation sur la première image.
 */
export function RotatingImage({
  images,
  alt,
  interval = 7000,
  priority = false,
  className,
}: {
  images: string[];
  alt: string;
  interval?: number;
  priority?: boolean;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  // Passe à vrai au premier changement, jamais avant : c'est ce drapeau qui
  // décide du montage des visuels suivants.
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (images.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => {
      // Ces appels vivent dans le callback du minuteur, pas dans le corps de
      // l'effet : aucun rendu en cascade au montage.
      setStarted(true);
      setIndex((i) => (i + 1) % images.length);
    }, interval);

    return () => window.clearInterval(timer);
  }, [images.length, interval]);

  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      {images.map((basePath, i) => {
        if (!started && i > 0) return null;

        return (
          <div
            key={basePath}
            className="absolute inset-0 transition-opacity duration-[1600ms] ease-in-out"
            style={{ opacity: i === index ? 1 : 0 }}
            aria-hidden={i !== index}
          >
            <HotelImage
              basePath={basePath}
              alt={i === 0 ? alt : ""}
              sizes="100vw"
              priority={priority && i === 0}
            />
          </div>
        );
      })}
    </div>
  );
}
