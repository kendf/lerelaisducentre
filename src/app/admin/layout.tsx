import type { Metadata } from "next";
import localFont from "next/font/local";
import "../globals.css";

/**
 * Mêmes fichiers de police que le site public, versionnés dans le dépôt plutôt
 * que récupérés chez Google au moment de la construction. La raison est
 * détaillée dans src/app/[locale]/layout.tsx.
 */

const playfair = localFont({
  src: "../../fonts/playfair-display-latin.woff2",
  weight: "400 600",
  style: "normal",
  variable: "--font-playfair",
  display: "swap",
  adjustFontFallback: "Times New Roman",
  fallback: ["Georgia", "serif"],
});

const inter = localFont({
  src: "../../fonts/inter-latin.woff2",
  weight: "100 900",
  style: "normal",
  variable: "--font-inter",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "sans-serif"],
});

export const metadata: Metadata = {
  title: {
    default: "Administration — Le Relais du Centre",
    template: "%s — Administration",
  },
  // Le back-office ne doit jamais apparaître dans un moteur de recherche.
  robots: { index: false, follow: false },
};

/**
 * Racine du back-office.
 *
 * Volontairement séparée de celle du site public : l'espace d'administration
 * n'est pas traduit (CDC §2.2, équipe francophone), n'a pas de bandeau de
 * démonstration, pas d'en-tête marketing et pas de pied de page. La police
 * manuscrite du logo n'est pas chargée non plus — elle n'a rien à faire sur un
 * écran de travail utilisé toute la journée.
 */
export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="fr"
      data-scroll-behavior="smooth"
      className={`${playfair.variable} ${inter.variable}`}
    >
      <body className="bg-ivory-deep">{children}</body>
    </html>
  );
}
