"use client";

import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

/**
 * Sélecteur FR/EN — CDC §5.4 : « visible et accessible depuis toutes les pages ».
 *
 * Le changement de langue conserve la page courante ET ses paramètres : depuis
 * /fr/chambres/suite-relais, on arrive sur /en/rooms/suite-relais et non sur
 * l'accueil anglais. C'est ce qui rend le bilinguisme utilisable — un visiteur
 * anglophone qui bascule au milieu de sa lecture ne perd pas sa place.
 */
export function LanguageSwitcher() {
  const t = useTranslations("nav");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [isPending, startTransition] = useTransition();

  const other: Locale = locale === "fr" ? "en" : "fr";

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(() => {
          router.replace(
            // `params` porte les segments dynamiques ([slug], [token]).
            { pathname, params } as Parameters<typeof router.replace>[0],
            { locale: other }
          );
        })
      }
      className="px-2 py-1 text-xs font-medium uppercase tracking-[0.14em] text-brown-soft transition-colors hover:text-bronze disabled:opacity-50"
      aria-label={`${t("language")} — ${t("switchTo")}`}
    >
      {other.toUpperCase()}
    </button>
  );
}
