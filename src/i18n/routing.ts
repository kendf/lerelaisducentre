import { defineRouting } from "next-intl/routing";

/**
 * Routage bilingue FR/EN — CDC §3.2 et §4.
 *
 * Les chemins sont TRADUITS et non simplement préfixés : `/en/rooms` plutôt
 * que `/en/chambres`. C'est ce qui permet à la version anglaise d'être
 * réellement indexée sur les requêtes anglophones (CDC §2.1 : « clientèle
 * internationale et non francophone »). Un simple préfixe de langue aurait
 * laissé des URLs françaises dans les résultats de recherche anglais.
 *
 * Le préfixe est toujours présent (`always`) : pas d'URL sans langue, donc
 * pas de contenu dupliqué à l'index ni d'ambiguïté sur la langue servie.
 */
export const routing = defineRouting({
  locales: ["fr", "en"],
  defaultLocale: "fr",
  localePrefix: "always",
  pathnames: {
    "/": "/",
    "/notre-maison": { fr: "/notre-maison", en: "/our-house" },
    "/chambres": { fr: "/chambres", en: "/rooms" },
    "/chambres/[slug]": { fr: "/chambres/[slug]", en: "/rooms/[slug]" },
    "/services": { fr: "/services", en: "/services" },
    "/galerie": { fr: "/galerie", en: "/gallery" },
    "/contact": { fr: "/contact", en: "/contact" },
    "/questions": { fr: "/questions", en: "/faq" },
    "/reserver": { fr: "/reserver", en: "/book" },
    "/reserver/informations": { fr: "/reserver/informations", en: "/book/details" },
    // Le récapitulatif est une ÉTAPE, pas un encart : il a donc son adresse.
    // Le visiteur peut y revenir, l'ouvrir dans un onglet, et le bouton
    // « précédent » du navigateur fait ce qu'il annonce.
    "/reserver/recapitulatif": { fr: "/reserver/recapitulatif", en: "/book/summary" },
    "/reserver/paiement": { fr: "/reserver/paiement", en: "/book/payment" },
    // Le segment porte le jeton aléatoire de la réservation, pas sa référence
    // séquentielle : voir le commentaire de `public_token` dans 0001_schema.sql.
    "/reserver/confirmation/[token]": {
      fr: "/reserver/confirmation/[token]",
      en: "/book/confirmation/[token]",
    },
    "/mentions-legales": { fr: "/mentions-legales", en: "/legal-notice" },
    "/conditions": { fr: "/conditions", en: "/booking-terms" },
    "/confidentialite": { fr: "/confidentialite", en: "/privacy" },
  },
});

export type Locale = (typeof routing.locales)[number];
export type AppPathname = keyof typeof routing.pathnames;

/**
 * Chemins sans segment dynamique — les seuls qu'un menu peut référencer par
 * une simple chaîne. Les routes paramétrées (`/chambres/[slug]`) exigent un
 * objet `{ pathname, params }`, et le typage l'impose au lieu de laisser
 * passer un lien cassé jusqu'à l'exécution.
 */
export type StaticPathname = Exclude<AppPathname, `${string}[${string}]${string}`>;
