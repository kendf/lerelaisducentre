"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Menu, Phone, X } from "lucide-react";
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
 * La page courante, du point de vue de la barre de navigation.
 *
 * Une simple égalité ne suffit pas : sur `/chambres/suite-relais`, le lien
 * « Chambres & Suites » doit rester actif — c'est bien là que le visiteur se
 * trouve. L'accueil est le seul chemin traité par égalité stricte, sans quoi
 * il serait actif partout.
 */
function isCurrent(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface HeaderProps {
  /** Coordonnées du bandeau supérieur, lues en base par le layout. */
  contact: { phone: string; address: string };
}

/**
 * En-tête du site.
 *
 * CDC §5.4 : le sélecteur de langue et le bouton « Réserver » doivent rester
 * accessibles depuis toutes les pages — ils sont donc dans l'en-tête, visibles
 * sur mobile comme sur ordinateur, jamais repliés dans le menu burger.
 */
export function Header({ contact }: HeaderProps) {
  const t = useTranslations("nav");
  const tMeta = useTranslations("meta");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  /**
   * L'en-tête se DÉTACHE de la page dès qu'on défile.
   *
   * Une barre collante posée sur un fond de la même teinte que le contenu
   * flotte sans qu'on sache si elle recouvre quelque chose. L'ombre n'apparaît
   * qu'une fois le défilement commencé : tant qu'on est en haut, il n'y a rien
   * dessous, et une ombre y serait un mensonge visuel.
   *
   * `passive: true` : ce gestionnaire ne bloque jamais le défilement, ce qui
   * compte sur un téléphone d'entrée de gamme.
   */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll(); // état correct si la page est rouverte à mi-hauteur
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* --- Bandeau d'informations ------------------------------------------
          Ce que cherche un voyageur en transit avant même de regarder les
          chambres : est-ce ouvert à l'heure où j'arriverai, où est-ce, et
          comment j'appelle. Masqué sur petit écran, où la place doit aller à
          la navigation elle-même.
          -------------------------------------------------------------------- */}
      <div className="hidden bg-brown text-ivory/80 lg:block">
        <div className="flex items-center justify-between gap-6 px-5 py-2 text-xs tracking-wide">
          <div className="flex items-center gap-6">
            <span>{t("deskOpen")}</span>
            <span className="text-ivory/60">{contact.address}</span>
          </div>
          <a
            href={`tel:${contact.phone.replace(/\s/g, "")}`}
            className="inline-flex items-center gap-2 transition-colors hover:text-bronze-tint"
          >
            <Phone size={13} className="text-bronze-soft" aria-hidden />
            <span className="numeric">{contact.phone}</span>
          </a>
        </div>
      </div>

      <header
        className={cn(
          "sticky top-0 z-50 bg-ivory/95 backdrop-blur transition-shadow duration-300",
          scrolled
            ? "shadow-[0_2px_16px_rgba(59,42,30,0.10)]"
            : "border-b border-ivory-line"
        )}
      >
        {/* Pleine largeur, sans conteneur centré : le nom de l'établissement et
            les actions se calent sur les bords de l'écran, seuls les liens de
            pages restent au centre. */}
        <div className="flex h-20 items-center justify-between gap-6 px-5">
          <Link
            href="/"
            className="flex flex-col leading-none"
            onClick={() => setOpen(false)}
          >
            <span className="font-display text-lg tracking-wide text-brown lg:text-xl">
              LE RELAIS <span className="text-bronze">DU CENTRE</span>
            </span>
            <span className="signature text-base lg:text-lg">
              {tMeta("baseline")}
            </span>
          </Link>

          <nav className="hidden items-center gap-7 lg:flex" aria-label={t("menu")}>
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isCurrent(pathname, link.href) ? "page" : undefined}
                className={cn(
                  "nav-link text-sm hover:text-bronze",
                  isCurrent(pathname, link.href)
                    ? "text-bronze"
                    : "text-brown-soft"
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
            <div className="px-5 py-4">
              {LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={isCurrent(pathname, link.href) ? "page" : undefined}
                  className={cn(
                    "block border-b border-ivory-line/60 py-3.5 font-display text-lg last:border-0",
                    isCurrent(pathname, link.href) ? "text-bronze" : "text-brown"
                  )}
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
    </>
  );
}
