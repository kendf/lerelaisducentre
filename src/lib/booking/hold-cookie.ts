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

/**
 * Coordonnées saisies à l'étape 2, conservées pour les REPRÉSENTER si le
 * visiteur revient corriger quelque chose depuis le récapitulatif.
 *
 * POURQUOI PAS RELIRE LA RÉSERVATION. Le jeton public ne donne accès qu'à ce
 * que `get_reservation_public` accepte d'exposer : le prénom, et rien d'autre.
 * C'est délibéré — ce jeton voyage dans une URL de confirmation, et un lien
 * transféré ne doit pas livrer le téléphone et l'adresse du client. Élargir
 * cette fonction pour un confort de formulaire reviendrait à ouvrir une fuite
 * pour économiser un cookie.
 *
 * Les données restent donc sur l'appareil de leur propriétaire : cookie
 * httpOnly, invisible au JavaScript de la page, et de durée de vie limitée à
 * celle du blocage.
 */
export const GUEST_COOKIE = "rdc_guest";
