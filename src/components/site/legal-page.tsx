import { getTranslations } from "next-intl/server";
import { AlertTriangle } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { getPublicSettings } from "@/lib/content";
import { cn } from "@/lib/utils";
import type { StaticPathname } from "@/i18n/routing";

/** Les trois documents réglementaires, identifiés par leur clé de traduction. */
export type LegalDoc = "notice" | "terms" | "privacy";

interface Section {
  heading: string;
  body: string[];
}

const DOCS: Array<{
  doc: LegalDoc;
  href: StaticPathname;
  titleKey: string;
  shortKey: string;
}> = [
  {
    doc: "notice",
    href: "/mentions-legales",
    titleKey: "noticeTitle",
    shortKey: "noticeShort",
  },
  {
    doc: "terms",
    href: "/conditions",
    titleKey: "termsTitle",
    shortKey: "termsShort",
  },
  {
    doc: "privacy",
    href: "/confidentialite",
    titleKey: "privacyTitle",
    shortKey: "privacyShort",
  },
];

/**
 * Ancre d'une section, dérivée de son intitulé.
 *
 * Écrite ici plutôt que saisie à la main dans les traductions : une ancre
 * recopiée finit toujours par diverger de son titre, et le lien du sommaire
 * pointe alors dans le vide sans que rien ne le signale. La normalisation
 * retire les accents — une ancre `#responsabilité` fonctionne, mais elle est
 * illisible une fois encodée dans une URL partagée.
 */
function anchor(heading: string): string {
  return heading
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/* =============================================================================
   GABARIT DES PAGES RÉGLEMENTAIRES

   LE TEXTE NE RÉPÈTE PAS LES RÈGLES, IL LES LIT. Le taux d'acompte, le délai
   d'annulation, la durée du blocage et les horaires d'arrivée ne sont pas écrits
   en toutes lettres : ce sont des jetons, remplacés au rendu par les valeurs que
   la gérance a réglées en back-office — les MÊMES que celles qui pilotent le
   moteur de réservation.

   Le jour où le gérant passera l'acompte de 30 à 40 %, il ne pensera pas à
   rouvrir les conditions générales. Un texte figé deviendrait alors faux, et un
   document contractuel faux sur le taux d'acompte est un litige qui attend son
   heure. Ici la contradiction est structurellement impossible : une seule
   source.

   Ce que le texte NE PEUT PAS deviner — numéro RCCM, forme juridique — est
   marqué comme tel, visiblement, plutôt qu'inventé. Un site de démonstration qui
   affiche un numéro d'immatriculation fictif est plus dangereux qu'une page
   vide : il a l'air vrai.
   ============================================================================= */

export async function LegalPage({ doc }: { doc: LegalDoc }) {
  const t = await getTranslations("legal");
  const settings = await getPublicSettings();
  const contact = settings.hotel_contact;

  const values: Record<string, string> = {
    percent: String(settings.deposit_percent),
    hours: String(settings.free_cancellation_hours),
    holdMinutes: String(settings.hold_minutes),
    checkIn: settings.check_in_time,
    checkOut: settings.check_out_time,
    address: contact.address,
    phone: contact.phone,
    email: contact.email,
  };

  const fill = (text: string) =>
    text.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);

  const sections = t.raw(`${doc}.sections`) as Section[];
  const current = DOCS.find((d) => d.doc === doc)!;

  return (
    <>
      {/* --- Bandeau titré ---------------------------------------------------
          Ces pages sont consultées quand quelque chose inquiète : on cherche
          une clause d'annulation, on veut savoir qui détient ses données. Le
          bandeau nomme le document sans détour, et donne sa date de révision —
          la première chose qu'on regarde sur un texte contractuel.
          -------------------------------------------------------------------- */}
      <section className="bg-brown py-14 text-center lg:py-16">
        <div className="mx-auto max-w-3xl px-5 lg:px-8">
          <h1 className="font-display text-4xl text-ivory">{t(current.titleKey)}</h1>
          <p className="mt-4 text-sm text-ivory/65">{t("updated")}</p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 py-section lg:px-8">
        {/* --- Passage d'un document à l'autre -------------------------------
            Les trois textes se lisent rarement seuls : qui vérifie la politique
            d'annulation regarde souvent, dans la foulée, ce qu'il advient de ses
            données. Redescendre au pied de page pour changer de document serait
            un aller-retour de trop.
            ------------------------------------------------------------------ */}
        <nav
          aria-label={t("docsNav")}
          className="flex gap-1 overflow-x-auto bg-ivory-deep p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {DOCS.map((item) => {
            const active = item.doc === doc;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex-1 px-4 py-2.5 text-center text-sm whitespace-nowrap transition-colors",
                  active
                    ? "bg-cream font-medium text-brown shadow-[0_1px_4px_rgba(59,42,30,0.10)]"
                    : "text-brown-soft hover:text-bronze"
                )}
              >
                {t(item.shortKey)}
              </Link>
            );
          })}
        </nav>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,14rem)_1fr] lg:gap-14">
          {/* --- Sommaire -----------------------------------------------------
              Masqué sous `lg` : sur un téléphone, une liste de neuf ancres avant
              le premier paragraphe repousse le texte hors de l'écran. On y lit
              le document au fil, on ne le consulte pas par section.
              ---------------------------------------------------------------- */}
          <aside className="hidden lg:block">
            <nav className="sticky top-28" aria-label={t("toc")}>
              <p className="text-xs font-semibold tracking-wider text-bronze uppercase">
                {t("toc")}
              </p>
              <ul className="mt-4 space-y-0.5">
                {sections.map((section) => (
                  <li key={section.heading}>
                    <a
                      href={`#${anchor(section.heading)}`}
                      className="block border-l-2 border-ivory-line py-1.5 pl-3 text-sm text-brown-soft transition-colors hover:border-bronze hover:text-brown"
                    >
                      {section.heading}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          <div className="min-w-0 max-w-3xl">
            {doc === "notice" ? (
              <p className="mb-11 flex items-start gap-3 border-l-2 border-warning bg-warning/8 px-5 py-4 text-[15px] leading-relaxed text-brown-soft">
                <AlertTriangle
                  size={17}
                  className="mt-0.5 shrink-0 text-warning"
                  aria-hidden
                />
                {t("toComplete")}
              </p>
            ) : null}

            <div className="space-y-11">
              {sections.map((section, index) => (
                <section
                  key={section.heading}
                  id={anchor(section.heading)}
                  // L'en-tête est collant : sans cette marge, une ancre amène la
                  // section JUSTE SOUS la barre, qui en masque le titre.
                  className="scroll-mt-28"
                >
                  <h2 className="flex items-baseline gap-3 text-2xl">
                    {/* La numérotation est une information, pas un ornement :
                        elle permet de renvoyer à « l'article 5 » dans un échange
                        avec un client, ce qu'un titre seul ne permet pas. */}
                    <span className="numeric text-base font-medium text-bronze">
                      {index + 1}.
                    </span>
                    {section.heading}
                  </h2>
                  <div className="mt-4 space-y-3.5">
                    {section.body.map((paragraph) => (
                      <p
                        key={paragraph}
                        className="text-[15px] leading-relaxed text-brown-soft"
                      >
                        {fill(paragraph)}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
