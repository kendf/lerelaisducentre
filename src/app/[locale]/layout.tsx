import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Playfair_Display, Great_Vibes, Inter } from "next/font/google";

import { routing } from "@/i18n/routing";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { DemoBanner } from "@/components/site/demo-banner";
import { AssistantMount } from "@/components/site/assistant-mount";
import "../globals.css";

/**
 * Typographies du CDC §5.3.
 * `display: swap` affiche immédiatement la police de repli puis substitue :
 * le texte est lisible dès la première image, ce qui compte sur une connexion
 * mobile lente (CDC §8).
 */
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-playfair",
  display: "swap",
});

const greatVibes = Great_Vibes({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-great-vibes",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
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
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
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
