import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatage des montants en francs CFA. Le XOF n'a pas de décimales :
 * `1 234 567 F CFA`, jamais `1 234 567,00`.
 *
 * PAS DE VARIANTE PAR LANGUE. La version précédente passait la locale à
 * `Intl.NumberFormat`, ce qui produisait en anglais `F CFA 45,000` — symbole
 * devant et virgules — là où le français donne `45 000 F CFA`. Deux écritures
 * du même prix sur le même site, selon la page où l'on se trouve.
 *
 * Le franc CFA s'écrit de la même façon en Côte d'Ivoire quelle que soit la
 * langue du lecteur, et un visiteur anglophone qui compare un tarif entre la
 * version anglaise et la facture de l'hôtel doit lire la même chose. Le format
 * est donc unique, et la fonction ne prend plus de locale.
 */
export function formatXof(amount: number): string {
  const value = new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(amount);
  // Espace insécable avant l'unité : un montant ne doit jamais se couper en
  // fin de ligne entre le nombre et sa devise.
  return `${value} F CFA`;
}

/** Date ISO (YYYY-MM-DD) — le format d'échange avec Postgres pour les nuitées. */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Nombre de nuits entre deux dates ISO.
 * Calcul en UTC pour ne jamais dépendre du fuseau du navigateur : une nuitée
 * est une différence de calendrier, pas une durée en millisecondes.
 */
export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = Date.parse(`${checkIn}T00:00:00Z`);
  const b = Date.parse(`${checkOut}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Date du jour dans le fuseau de l'hôtel (Africa/Abidjan, UTC+0 sans DST). */
export function hotelToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Abidjan" });
}
