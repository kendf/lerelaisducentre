import { getTranslations } from "next-intl/server";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getPublicSettings } from "@/lib/content";
import type { StaticPathname } from "@/i18n/routing";

const NAV: Array<{ href: StaticPathname; key: string }> = [
  { href: "/chambres", key: "rooms" },
  { href: "/services", key: "services" },
  { href: "/galerie", key: "gallery" },
  { href: "/notre-maison", key: "hotel" },
  { href: "/questions", key: "faq" },
  { href: "/contact", key: "contact" },
];

const LEGAL: Array<{ href: StaticPathname; key: string }> = [
  { href: "/mentions-legales", key: "legal" },
  { href: "/conditions", key: "terms" },
  { href: "/confidentialite", key: "privacy" },
];

export async function Footer() {
  const t = await getTranslations("footer");
  const tNav = await getTranslations("nav");
  const settings = await getPublicSettings();
  const { hotel_contact: contact } = settings;
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-ivory-line bg-ivory-deep">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div>
          <p className="font-display text-lg tracking-wide text-brown">
            LE RELAIS <span className="text-bronze">DU CENTRE</span>
          </p>
          <p className="signature mt-1 text-xl">{t("tagline")}</p>
        </div>

        <nav aria-labelledby="footer-nav">
          <h2 id="footer-nav" className="eyebrow mb-4">{t("navTitle")}</h2>
          <ul className="space-y-2.5">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-sm text-brown-soft transition-colors hover:text-bronze"
                >
                  {tNav(item.key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="eyebrow mb-4">{t("contactTitle")}</h2>
          <ul className="space-y-2.5 text-sm text-brown-soft">
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
          <ul className="space-y-2.5">
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
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-xs text-brown-soft sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p>© {year} Hôtel Le Relais du Centre — {t("rights")}</p>
          <p>{t("madeBy")}</p>
        </div>
      </div>
    </footer>
  );
}
