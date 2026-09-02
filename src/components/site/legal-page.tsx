import { getTranslations } from "next-intl/server";
import { FileText } from "lucide-react";

/**
 * Gabarit commun aux trois pages réglementaires.
 *
 * Le contenu est à fournir par l'hôtel avant la mise en ligne (CDC §9 :
 * mentions légales, conditions de réservation, politique de confidentialité).
 * La page existe donc dès maintenant — les liens de pied de page ne mènent pas
 * à une erreur — mais elle annonce clairement qu'elle attend son texte, plutôt
 * que d'afficher un contenu inventé qui aurait valeur d'engagement.
 */
export async function LegalPage({ titleKey }: { titleKey: string }) {
  const t = await getTranslations("legal");

  return (
    <div className="mx-auto max-w-3xl px-5 py-section lg:px-8">
      <h1 className="text-4xl">{t(titleKey)}</h1>
      <div className="mt-10 flex items-start gap-3.5 border border-dashed border-ivory-line bg-cream p-7">
        <FileText size={18} className="mt-0.5 shrink-0 text-bronze-soft" />
        <p className="text-[15px] leading-relaxed text-brown-soft">
          {t("placeholder")}
        </p>
      </div>
    </div>
  );
}
