import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MessageCircle, Phone } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { getFaq } from "@/lib/faq";
import { getPublicSettings } from "@/lib/content";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "faq" });
  return { title: t("title"), description: t("lead") };
}

/* =============================================================================
   QUESTIONS FRÉQUENTES

   Une page qu'on ne lit jamais en entier : on y cherche UNE réponse. Elle est
   donc construite pour le balayage, pas pour la lecture suivie —

     - les questions sont visibles d'un coup d'œil, les réponses dépliées à la
       demande, avec `<details>` natif : ça fonctionne sans JavaScript, c'est
       accessible au clavier, et la recherche du navigateur (Ctrl+F) y trouve
       le texte replié dans les navigateurs récents ;
     - trois groupes seulement, dans l'ordre où les questions se posent :
       avant de réserver, pendant le séjour, pour venir ;
     - les chiffres viennent des réglages du back-office, jamais du texte.
   ============================================================================= */

export default async function FaqPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("faq");
  const tCommon = await getTranslations("common");
  const [groups, settings] = await Promise.all([getFaq(), getPublicSettings()]);

  const contact = settings.hotel_contact;
  const phoneDigits = contact.phone.replace(/[^0-9+]/g, "");
  const whatsapp = contact.whatsapp.replace(/[^0-9]/g, "");

  return (
    <>
      <section className="mx-auto max-w-3xl px-5 pt-20 pb-14 text-center lg:pt-28">
        <p className="eyebrow">{t("subtitle")}</p>
        <h1 className="mt-6 font-display text-4xl leading-[1.1] text-balance sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-7 max-w-xl text-[17px] leading-relaxed text-brown-soft">
          {t("lead")}
        </p>
      </section>

      <div className="mx-auto max-w-3xl px-5 pb-section">
        {groups.map((group) => (
          <section key={group.title} className="mt-14 first:mt-0">
            <h2 className="text-2xl">{group.title}</h2>

            <div className="mt-6 border-t border-ivory-line">
              {group.items.map((item) => (
                <details
                  key={item.q}
                  className="group border-b border-ivory-line"
                >
                  <summary className="flex cursor-pointer items-start justify-between gap-6 py-5 text-[15px] font-medium marker:content-none">
                    {item.q}
                    {/* Signe qui bascule : plus lisible qu'un chevron pivotant
                        sur un écran de téléphone en plein soleil. */}
                    <span
                      aria-hidden
                      className="mt-0.5 shrink-0 text-lg leading-none text-bronze"
                    >
                      <span className="group-open:hidden">+</span>
                      <span className="hidden group-open:inline">−</span>
                    </span>
                  </summary>
                  <p className="pb-6 text-[15px] leading-relaxed text-brown-soft">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </section>
        ))}

        {/* --- Reste une question ------------------------------------------ */}
        <section className="mt-16 border border-ivory-line bg-cream p-8 text-center">
          <h2 className="font-display text-xl">{t("stillHere")}</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-brown-soft">
            {t("stillHereBody")}
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-4">
            <a href={`tel:${phoneDigits}`} className="btn btn-outline">
              <Phone size={15} />
              {tCommon("call")}
            </a>
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline"
            >
              <MessageCircle size={15} />
              {tCommon("whatsapp")}
            </a>
            <Link href="/contact" className="btn btn-primary">
              {tCommon("seeMore")}
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
