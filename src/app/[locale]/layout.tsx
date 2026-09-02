import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import localFont from "next/font/local";

import { routing } from "@/i18n/routing";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { DemoBanner } from "@/components/site/demo-banner";
import { AssistantMount } from "@/components/site/assistant-mount";
import "../globals.css";
import { getSiteUrl } from "@/lib/site-url";

/**
 * Typographies du CDC §5.3 — FICHIERS VERSIONNÉS, PAS TÉLÉCHARGÉS.
 *
 * POURQUOI PAS `next/font/google`. Ce chargeur va chercher les fichiers chez
 * Google AU MOMENT DE LA CONSTRUCTION. Quand cette récupération échoue, il
 * n'interrompt pas le build : il émet uniquement la police de substitution
 * métrique — Times New Roman à `size-adjust: 111.26 %` pour Playfair, Arial à
 * `107.12 %` pour Inter. Le site part alors en ligne dans la mauvaise
 * typographie, SANS AUCUNE ERREUR pour le signaler.
 *
 * Ce n'est pas une hypothèse. Le serveur de développement de ce projet a servi
 * pendant plusieurs jours un CSS dépourvu de toute règle `src: url()` : les
 * fichiers étaient bien téléchargés dans .next/dev/static/media, plus aucune
 * règle ne les appelait. L'en-tête passait à la ligne parce que le Times de
 * repli est 11 % plus large. Le même accident au moment d'un déploiement
 * aurait livré la démonstration client dans une police hors charte.
 *
 * Les trois fichiers sont donc dans le dépôt (sous-ensemble `latin`, 129 Ko au
 * total). La construction ne fait plus aucun appel réseau, et le rendu est
 * reproductible à l'identique en local, en préproduction et en production.
 *
 * Le sous-ensemble `latin` suffit aux deux langues du site : U+0000-00FF
 * couvre tous les accents français, U+0152-0153 la ligature œ.
 *
 * `display: swap` est conservé : le texte reste lisible dès la première image,
 * ce qui compte sur une connexion mobile lente (CDC §8).
 */

const playfair = localFont({
  // Fonte variable : un seul fichier couvre les graisses 400 à 600.
  src: "../../fonts/playfair-display-latin.woff2",
  weight: "400 600",
  style: "normal",
  variable: "--font-playfair",
  display: "swap",
  // Repli calé sur un serif et non sur Arial : c'est ce qui limite le
  // décalage de mise en page pendant le chargement.
  adjustFontFallback: "Times New Roman",
  fallback: ["Georgia", "serif"],
});

const greatVibes = localFont({
  src: "../../fonts/great-vibes-latin.woff2",
  weight: "400",
  style: "normal",
  variable: "--font-great-vibes",
  display: "swap",
  fallback: ["cursive"],
});

const inter = localFont({
  src: "../../fonts/inter-latin.woff2",
  weight: "100 900",
  style: "normal",
  variable: "--font-inter",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "sans-serif"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    title: {
      default: `${t("siteName")} — ${t("baseline")}`,
      template: `%s — ${t("siteName")}`,
    },
    description: t("defaultDescription"),
    metadataBase: new URL(getSiteUrl()),
    // Indique aux moteurs que les deux versions sont équivalentes : c'est ce
    // qui évite qu'ils considèrent la version anglaise comme du contenu dupliqué.
    alternates: {
      languages: { fr: "/fr", en: "/en" },
    },
    openGraph: {
      type: "website",
      siteName: t("siteName"),
      locale: locale === "fr" ? "fr_CI" : "en_GB",
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Autorise le rendu statique des pages : sans cet appel, next-intl bascule
  // tout le site en rendu dynamique et on perd le bénéfice SEO/performance.
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={`${playfair.variable} ${greatVibes.variable} ${inter.variable}`}
    >
      <body className="flex min-h-screen flex-col">
        <NextIntlClientProvider>
          <DemoBanner />
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          {/* Assistant préréglé : présent sur toutes les pages publiques, jamais
              dans le back-office — l'équipe n'a pas besoin qu'on lui explique
              l'hôtel. */}
          <AssistantMount />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
