import { getTranslations } from "next-intl/server";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getPublicSettings } from "@/lib/content";
import type { StaticPathname } from "@/i18n/routing";

const LEGAL: Array<{ href: StaticPathname; key: string }> = [
  { href: "/mentions-legales", key: "legal" },
  { href: "/conditions", key: "terms" },
  { href: "/confidentialite", key: "privacy" },
];

export async function Footer() {
  const t = await getTranslations("footer");
  const settings = await getPublicSettings();
  const { hotel_contact: contact } = settings;
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-ivory-line bg-ivory-deep">
      {/* Pleine largeur, comme l'en-tête : le nom de l'établissement se cale
          à gauche de l'écran et le bloc « Informations » à droite. Un pied de
          page centré sur 1 150 px laissait deux vides latéraux qui n'avaient
          aucune raison d'être. Hauteur resserrée au passage. */}
      {/* TROIS COLONNES, PLUS DE MENU. Le pied de page reprenait les sept
          liens déjà présents dans l'en-tête, qui est collant et visible sur
          toute la hauteur de chaque page. Un visiteur ne descend pas au pied
          d'une page pour retrouver un menu qu'il a sous les yeux.

          Ce qu'on y cherche vraiment est resté : de quoi appeler, écrire ou
          situer l'établissement, et les documents d'information. Aucun lien
          n'est perdu pour autant — l'en-tête les porte tous, sur toutes les
          pages, y compris pour les moteurs de recherche.
          ---------------------------------------------------------------- */}
      <div className="grid gap-8 px-5 py-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-12">
        <div>
          <p className="font-display text-lg tracking-wide text-brown">
            LE RELAIS <span className="text-bronze">DU CENTRE</span>
          </p>
          <p className="signature mt-1 text-xl">{t("tagline")}</p>
        </div>


        <div>
          <h2 className="eyebrow mb-4">{t("contactTitle")}</h2>
          <ul className="space-y-2 text-sm text-brown-soft">
            <li className="flex items-start gap-2.5">
              <MapPin size={15} className="mt-0.5 shrink-0 text-bronze-soft" />
              <span>{contact.address}</span>
            </li>
            <li className="flex items-start gap-2.5">
              <Phone size={15} className="mt-0.5 shrink-0 text-bronze-soft" />
              <a
                href={`tel:${contact.phone.replace(/\s/g, "")}`}
                className="transition-colors hover:text-bronze"
              >
                {contact.phone}
              </a>
            </li>
            <li className="flex items-start gap-2.5">
              <MessageCircle size={15} className="mt-0.5 shrink-0 text-bronze-soft" />
              <a
                href={`https://wa.me/${contact.whatsapp.replace(/[^0-9]/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-bronze"
              >
                WhatsApp
              </a>
            </li>
            <li className="flex items-start gap-2.5">
              <Mail size={15} className="mt-0.5 shrink-0 text-bronze-soft" />
              <a
                href={`mailto:${contact.email}`}
                className="transition-colors hover:text-bronze"
              >
                {contact.email}
              </a>
            </li>
          </ul>
        </div>

        <nav aria-labelledby="footer-legal">
          <h2 id="footer-legal" className="eyebrow mb-4">{t("legalTitle")}</h2>
          <ul className="space-y-2">
            {LEGAL.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-sm text-brown-soft transition-colors hover:text-bronze"
                >
                  {t(item.key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-ivory-line/70">
        <div className="flex flex-col gap-2 px-5 py-4 text-xs text-brown-soft sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Hôtel Le Relais du Centre — {t("rights")}</p>
          <p>{t("madeBy")}</p>
        </div>
      </div>
    </footer>
  );
}
