import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Clock, Mail, MapPin, MessageCircle } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { ContactForm } from "@/components/site/contact-form";
import { getPublicSettings } from "@/lib/content";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });
  return { title: t("title"), description: t("lead") };
}

/* =============================================================================
   CONTACT

   Deux visiteurs arrivent ici, avec des besoins opposés :
     - celui qui veut JOINDRE tout de suite — il cherche un numéro ;
     - celui qui a une demande à formuler — il veut écrire.

   Le numéro est donc posé en grand, en tête, avant toute autre chose : c'est
   l'information la plus demandée d'une page contact d'hôtel, et la faire
   chercher au milieu d'une colonne serait une faute. Le formulaire vient
   ensuite, pour l'autre visiteur.

   La carte ferme la page en pleine largeur : on ne la consulte qu'une fois la
   décision prise de venir.
   ============================================================================= */

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("contact");
  const tFaq = await getTranslations("faq");
  const settings = await getPublicSettings();
  const contact = settings.hotel_contact;

  const phoneHref = `tel:${contact.phone.replace(/[^0-9+]/g, "")}`;
  const whatsappHref = `https://wa.me/${contact.whatsapp.replace(/[^0-9]/g, "")}`;

  const rows = [
    {
      icon: MessageCircle,
      label: "WhatsApp",
      value: contact.whatsapp,
      href: whatsappHref,
      external: true,
    },
    {
      icon: Mail,
      label: t("email"),
      value: contact.email,
      href: `mailto:${contact.email}`,
      external: false,
    },
    {
      icon: MapPin,
      label: t("address"),
      value: contact.address,
      href: null,
      external: false,
    },
    {
      icon: Clock,
      label: t("hours"),
      value: t("hoursValue"),
      href: null,
      external: false,
    },
  ];

  return (
    <>
      {/* --- Le numéro, d'abord -------------------------------------------- */}
      <section className="mx-auto max-w-3xl px-5 pt-14 pb-10 text-center lg:pt-20">
        <p className="eyebrow">{t("subtitle")}</p>
        <h1 className="mt-6 font-display text-4xl leading-[1.1] text-balance sm:text-5xl">
          {t("title")}
        </h1>

        <a
          href={phoneHref}
          className="numeric mt-9 inline-block font-display text-3xl text-bronze transition-colors hover:text-bronze-dark sm:text-4xl"
        >
          {contact.phone}
        </a>
        <p className="mt-3 text-sm text-brown-soft">{t("hoursValue")}</p>
      </section>

      <div className="mx-auto max-w-5xl px-5 pb-section lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,20rem)_1fr] lg:gap-16">
          {/* --- Autres moyens de joindre ------------------------------------ */}
          <aside>
            <h2 className="text-2xl">{t("infoTitle")}</h2>

            <dl className="mt-7 divide-y divide-ivory-line border-y border-ivory-line">
              {rows.map((row) => (
                <div key={row.label} className="flex items-start gap-3.5 py-4">
                  <row.icon size={16} className="mt-1 shrink-0 text-bronze" />
                  <div className="min-w-0">
                    <dt className="text-xs uppercase tracking-wider text-brown-soft">
                      {row.label}
                    </dt>
                    <dd className="mt-1 text-[15px] break-words">
                      {row.href ? (
                        <a
                          href={row.href}
                          target={row.external ? "_blank" : undefined}
                          rel={row.external ? "noopener noreferrer" : undefined}
                          className="transition-colors hover:text-bronze"
                        >
                          {row.value}
                        </a>
                      ) : (
                        row.value
                      )}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>

            {/* Avant d'écrire, la réponse est peut-être déjà là : on évite au
                visiteur une attente inutile, et à la réception un message de
                plus. */}
            <div className="mt-8 border border-ivory-line bg-cream p-5">
              <p className="text-sm leading-relaxed text-brown-soft">
                {tFaq("lead")}
              </p>
              <Link
                href="/questions"
                className="mt-4 inline-block text-xs uppercase tracking-wider text-bronze transition-colors hover:text-bronze-dark"
              >
                {tFaq("title")}
              </Link>
            </div>
          </aside>

          {/* --- Le formulaire ---------------------------------------------- */}
          <div>
            <h2 className="text-2xl">{t("formTitle")}</h2>
            <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-brown-soft">
              {t("lead")}
            </p>
            <div className="mt-8">
              <ContactForm />
            </div>
          </div>
        </div>
      </div>

      {/* --- La carte, en clôture -------------------------------------------- */}
      <section className="border-t border-ivory-line">
        <h2 className="sr-only">{t("mapTitle")}</h2>
        <div className="h-[52vh] min-h-[320px] w-full">
          {/* Chargée en différé et sans cookie tiers : elle n'est téléchargée
              que si le visiteur descend jusqu'ici (CDC §8). */}
          <iframe
            title={t("mapTitle")}
            src={`https://www.google.com/maps?q=${encodeURIComponent(
              contact.maps_query
            )}&output=embed`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="h-full w-full border-0"
          />
        </div>
      </section>
    </>
  );
}
