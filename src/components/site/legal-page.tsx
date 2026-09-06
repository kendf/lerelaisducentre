import { getTranslations } from "next-intl/server";
import { AlertTriangle } from "lucide-react";

import { getPublicSettings } from "@/lib/content";

/** Les trois documents réglementaires, identifiés par leur clé de traduction. */
export type LegalDoc = "notice" | "terms" | "privacy";

interface Section {
  heading: string;
  body: string[];
}

/* =============================================================================
   GABARIT DES PAGES RÉGLEMENTAIRES

   LE TEXTE NE RÉPÈTE PAS LES RÈGLES, IL LES LIT. Le taux d'acompte, le délai
   d'annulation, la durée du blocage et les horaires d'arrivée ne sont pas écrits
   en toutes lettres dans les conditions : ce sont des jetons, remplacés au rendu
   par les valeurs que la gérance a réglées en back-office — les MÊMES que celles
   qui pilotent le moteur de réservation.

   La raison est simple. Le jour où le gérant passera l'acompte de 30 à 40 %, il
   ne pensera pas à rouvrir les conditions générales. Un texte figé deviendrait
   alors faux, et un document contractuel faux sur le taux d'acompte est un
   litige qui attend son heure. Ici la contradiction est structurellement
   impossible : il n'y a qu'une seule source.

   Ce que le texte NE PEUT PAS deviner — numéro RCCM, forme juridique — est
   marqué comme tel, visiblement, plutôt qu'inventé. Un site de démonstration
   qui affiche un numéro d'immatriculation fictif est plus dangereux qu'une page
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
  const titleKey =
    doc === "notice" ? "noticeTitle" : doc === "terms" ? "termsTitle" : "privacyTitle";

  return (
    <div className="mx-auto max-w-3xl px-5 py-section lg:px-8">
      <h1 className="text-4xl">{t(titleKey)}</h1>
      <p className="mt-4 text-xs tracking-wider text-brown-soft uppercase">
        {t("updated")}
      </p>

      {/* L'avertissement ne figure que sur les mentions légales : c'est le seul
          document dont l'exactitude dépend d'informations que l'hôtel n'a pas
          encore fournies. */}
      {doc === "notice" ? (
        <p className="mt-8 flex items-start gap-3 border-l-2 border-warning bg-warning/8 px-5 py-4 text-[15px] leading-relaxed text-brown-soft">
          <AlertTriangle
            size={17}
            className="mt-0.5 shrink-0 text-warning"
            aria-hidden
          />
          {t("toComplete")}
        </p>
      ) : null}

      <div className="mt-12 space-y-11">
        {sections.map((section, index) => (
          <section key={section.heading}>
            <h2 className="flex items-baseline gap-3 text-2xl">
              {/* La numérotation est une information, pas un ornement : elle
                  permet de renvoyer à « l'article 5 » dans un échange avec un
                  client, ce qu'un titre seul ne permet pas. */}
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
  );
}
