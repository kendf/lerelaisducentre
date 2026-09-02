/**
 * Cookie qui lie le navigateur du visiteur à sa pré-réservation en cours.
 *
 * Isolé dans son propre module parce qu'un fichier « use server » ne peut
 * exporter que des fonctions asynchrones : une constante partagée entre une
 * action et une page doit vivre ailleurs.
 *
 * Contenu : le `public_token` de la réservation (aléatoire), jamais sa
 * référence séquentielle. httpOnly, donc invisible au JavaScript de la page.
 */
export const HOLD_COOKIE = "rdc_hold";

/** Durée de vie du cookie — délibérément plus longue que le hold lui-même. */
export const HOLD_COOKIE_MAX_AGE = 60 * 60 * 2;
