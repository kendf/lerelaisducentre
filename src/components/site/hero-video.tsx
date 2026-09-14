"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface HeroVideoProps {
  /** Fichier vidéo, servi depuis /public. */
  src: string;
  /** Image affichée avant la lecture — et à la place de la vidéo quand elle ne se lance pas. */
  poster: string;
  className?: string;
}

/**
 * Vidéo d'ouverture de l'accueil.
 *
 * LA VIDÉO NE SE TÉLÉCHARGE PAS D'OFFICE. `preload="none"` : tant que le
 * script n'a pas décidé de la lancer, seule l'image d'attente est chargée.
 * Le fichier pèse 5 Mo ; l'imposer à chaque visite reviendrait à renoncer à
 * l'objectif du CDC §8 — moins de 3 secondes sur une connexion mobile.
 *
 * Elle ne se lance PAS dans deux cas, et l'image d'attente tient alors lieu
 * d'ouverture :
 *   - `prefers-reduced-motion` : un fond qui bouge sous un titre est
 *     exactement ce que ce réglage demande d'éviter ;
 *   - le mode « économie de données » du navigateur : un visiteur qui paie
 *     son forfait au mégaoctet ne doit pas financer notre décor.
 *
 * La lecture est déclenchée sur l'élément, sans passer par un état React :
 * aucun rendu supplémentaire au montage, et rien à désynchroniser.
 */
export function HeroVideo({ src, poster, className }: HeroVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection?.saveData;
    if (reduceMotion || saveData) return;

    video.preload = "auto";
    // Un navigateur peut refuser la lecture automatique : l'image d'attente
    // reste alors en place, sans erreur visible pour le visiteur.
    video.play().catch(() => {});
  }, []);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload="none"
      aria-hidden="true"
      className={cn("h-full w-full object-cover", className)}
    />
  );
}
