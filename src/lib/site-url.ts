/**
 * Adresse publique du site, résolue une fois pour toutes.
 *
 * LE DÉFAUT QUE CE FICHIER CORRIGE. Cinq endroits écrivaient :
 *
 *     process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
 *
 * `??` ne se déclenche que sur `null` ou `undefined`. Une variable DÉCLARÉE
 * MAIS VIDE — cas courant quand on ajoute la clé sans la remplir dans une
 * interface d'hébergement — traverse le repli, et `new URL("")` lève
 * `ERR_INVALID_URL`. C'est ce qui a fait échouer la construction sur Vercel, au
 * moment du pré-rendu des pages : une chaîne vide, pas une adresse fausse.
 *
 * Trois défenses, dans cet ordre :
 *   1. la valeur fournie, nettoyée et complétée du protocole si on l'a oublié
 *      (« mon-site.vercel.app » est une saisie naturelle, et elle est refusée
 *      par `new URL` sans schéma) ;
 *   2. l'adresse que Vercel injecte lui-même, pour qu'un déploiement
 *      fonctionne même si la variable a été oubliée ;
 *   3. le poste local.
 *
 * Une adresse invalide ne fait jamais tomber la construction : on retombe sur
 * le repli suivant. Un site qui refuse de se déployer à cause d'une coquille
 * dans une variable d'environnement est un site qu'on ne peut pas corriger.
 */

const LOCAL_FALLBACK = "http://localhost:3000";

function normalise(candidate: string | undefined): string | null {
  const value = candidate?.trim();
  if (!value) return null;

  // Un schéma manquant est l'erreur de saisie la plus fréquente.
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;

  try {
    const url = new URL(withScheme);
    // Sans barre oblique finale : toutes nos concaténations en ajoutent une.
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Origine du site, sans barre oblique finale.
 * Ex. `https://lerelaisducentre.vercel.app`
 */
export function getSiteUrl(): string {
  return (
    normalise(process.env.NEXT_PUBLIC_SITE_URL) ??
    // Vercel expose l'adresse stable du déploiement de production, puis celle
    // du déploiement courant. La première est préférable : les URL de retour de
    // paiement et les liens de confirmation ne doivent pas changer à chaque
    // mise en ligne.
    normalise(process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL) ??
    normalise(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
    normalise(process.env.NEXT_PUBLIC_VERCEL_URL) ??
    normalise(process.env.VERCEL_URL) ??
    LOCAL_FALLBACK
  );
}

/** Vrai quand le site tourne encore sur le poste de développement. */
export function isLocalSite(): boolean {
  return /localhost|127\.0\.0\.1/.test(getSiteUrl());
}
