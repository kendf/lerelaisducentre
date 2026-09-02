/**
 * Traduction des erreurs du moteur SQL en clés de message.
 *
 * Les fonctions Postgres lèvent des exceptions dont le message est un code
 * stable (`ROOM_UNAVAILABLE`, `MIN_NIGHTS`…). On ne montre JAMAIS le message
 * brut au visiteur : il serait en anglais, technique, et divulguerait des
 * détails d'implémentation. On le transforme ici en clé de traduction, avec
 * repli sur un message générique si le code est inconnu.
 */

const KNOWN_CODES = [
  "INVALID_DATES",
  "DATE_IN_PAST",
  "MIN_NIGHTS",
  "MAX_NIGHTS",
  "TOO_FAR_AHEAD",
  "CAPACITY_EXCEEDED",
  "ROOM_UNAVAILABLE",
  "ROOM_TYPE_NOT_FOUND",
  "INVALID_GUEST_DETAILS",
  "HOLD_EXPIRED",
] as const;

export type BookingErrorCode = (typeof KNOWN_CODES)[number] | "GENERIC";

const KNOWN = new Set<string>(KNOWN_CODES);

export function toBookingErrorCode(message: string | undefined): BookingErrorCode {
  if (!message) return "GENERIC";

  // Supabase préfixe parfois le message de la fonction : on cherche le code
  // parmi les mots plutôt que de supposer sa position.
  const found = message
    .toUpperCase()
    .split(/[^A-Z_]+/)
    .find((word) => KNOWN.has(word));

  return (found as BookingErrorCode) ?? "GENERIC";
}

/**
 * `ROOM_UNAVAILABLE` mérite un traitement à part : ce n'est pas une erreur de
 * saisie mais une course perdue contre un autre visiteur. L'interface doit
 * renvoyer le client vers la recherche, pas lui demander de corriger un champ.
 */
export function isRetryableWithNewSearch(code: BookingErrorCode): boolean {
  return code === "ROOM_UNAVAILABLE" || code === "HOLD_EXPIRED";
}
