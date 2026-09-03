"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Menu, X } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { LanguageSwitcher } from "./language-switcher";
import { cn } from "@/lib/utils";
import type { StaticPathname } from "@/i18n/routing";

const LINKS: Array<{ href: StaticPathname; key: string }> = [
  // Le logo ramène à l'accueil, mais rien ne l'annonce : un visiteur qui a
  // quitté la page d'accueil n'a aucun repère nommé pour y revenir. Le lien
  // est donc explicite, en tête de la barre.
  { href: "/", key: "home" },
  { href: "/chambres", key: "rooms" },
  { href: "/services", key: "services" },
  { href: "/galerie", key: "gallery" },
  { href: "/notre-maison", key: "hotel" },
  { href: "/questions", key: "faq" },
  { href: "/contact", key: "contact" },
];

/**
 * En-tête du site.
 *
 * CDC §5.4 : le sélecteur de langue et le bouton « Réserver » doivent rester
 * accessibles depuis toutes les pages — ils sont donc dans l'en-tête, visibles
 * sur mobile comme sur ordinateur, jamais repliés dans le menu burger.
 */
export function Header() {
  const t = useTranslations("nav");
  const tMeta = useTranslations("meta");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-ivory-line bg-ivory/95 backdrop-blur">
      {/* Pleine largeur, sans conteneur centré : le nom de l'établissement et
          les actions se calent sur les bords de l'écran, seuls les liens de
          pages restent au centre. Un en-tête de 1150 px flottant au milieu
          d'un écran de 1900 laisse deux vides latéraux que rien ne justifie. */}
      <div className="flex h-20 items-center justify-between gap-6 px-5">
        <Link
          href="/"
          className="flex flex-col leading-none"
          onClick={() => setOpen(false)}
        >
          <span className="font-display text-lg tracking-wide text-brown lg:text-xl">
            LE RELAIS <span className="text-bronze">DU CENTRE</span>
          </span>
          <span className="signature text-base lg:text-lg">{tMeta("baseline")}</span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex" aria-label={t("menu")}>
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm text-brown-soft transition-colors hover:text-bronze",
                pathname === link.href && "text-bronze"
              )}
            >
              {t(link.key)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Link href="/reserver" className="btn btn-primary hidden sm:inline-flex">
            {t("book")}
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="p-2 text-brown lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? t("close") : t("menu")}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          className="border-t border-ivory-line bg-ivory lg:hidden"
          aria-label={t("menu")}
        >
          <div className="mx-auto max-w-6xl px-5 py-4">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block border-b border-ivory-line/60 py-3.5 font-display text-lg text-brown last:border-0"
              >
                {t(link.key)}
              </Link>
            ))}
            <Link
              href="/reserver"
              onClick={() => setOpen(false)}
              className="btn btn-primary mt-4 w-full sm:hidden"
            >
              {t("book")}
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
