import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "../globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-playfair",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
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
    <html lang="fr" className={`${playfair.variable} ${inter.variable}`}>
      <body className="bg-ivory-deep">{children}</body>
    </html>
  );
}
