import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatage des montants en francs CFA.
 * Le XOF n'a pas de décimales : `1 234 567 F CFA`, jamais `1 234 567,00`.
 */
export function formatXof(amount: number, locale: string = "fr"): string {
  return new Intl.NumberFormat(locale === "en" ? "en-GB" : "fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(amount);
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
