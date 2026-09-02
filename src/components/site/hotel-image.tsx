import { cn } from "@/lib/utils";

interface HotelImageProps {
  /** Chemin SANS suffixe de taille : `/images/chambres/standard/01` */
  basePath: string;
  alt: string;
  /** Indication de largeur d'affichage, pour que le navigateur choisisse bien. */
  sizes?: string;
  /** À réserver à l'image d'en-tête : elle est chargée sans attendre. */
  priority?: boolean;
  className?: string;
}

/**
 * Affichage d'un visuel de l'établissement.
 *
 * POURQUOI PAS next/image ?
 * Les visuels sont déjà déclinés à la source en 480 / 960 / 1440 px au format
 * webp. next/image les ré-optimiserait à la volée — une dépense de calcul
 * facturée sur Vercel, et une latence au premier affichage — pour un résultat
 * identique. On sert donc directement le bon fichier via srcSet natif :
 * chargement immédiat, cache immuable (voir next.config.ts), zéro traitement
 * serveur. C'est ce qui tient l'objectif « moins de 3 secondes sur connexion
 * mobile » du CDC §8.
 *
 * Le jour où l'hôtel enverra ses propres photos, elles passeront par le même
 * pipeline de génération des trois tailles.
 */
export function HotelImage({
  basePath,
  alt,
  sizes = "100vw",
  priority = false,
  className,
}: HotelImageProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- srcSet natif volontaire, voir commentaire ci-dessus
    <img
      src={`${basePath}-960.webp`}
      srcSet={`${basePath}-480.webp 480w, ${basePath}-960.webp 960w, ${basePath}-1440.webp 1440w`}
      sizes={sizes}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      className={cn("h-full w-full object-cover", className)}
    />
  );
}
