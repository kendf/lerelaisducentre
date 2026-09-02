import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    // Fuseau de l'établissement : les dates affichées (arrivée, départ,
    // expiration d'un hold) doivent l'être en heure locale de Tiébissou,
    // pas dans celle du navigateur du visiteur.
    timeZone: "Africa/Abidjan",
    formats: {
      dateTime: {
        long: { day: "numeric", month: "long", year: "numeric" },
        short: { day: "2-digit", month: "2-digit", year: "numeric" },
      },
      number: {
        xof: { style: "currency", currency: "XOF", maximumFractionDigits: 0 },
      },
    },
  };
});
