import { getTranslations } from "next-intl/server";
import { Info } from "lucide-react";
import { getPublicSettings } from "@/lib/content";

/**
 * Bandeau « visuels d'illustration ».
 *
 * Les photographies utilisées pendant la phase de validation proviennent d'un
 * autre établissement. Sans mention explicite, le client repart en croyant
 * avoir vu ses propres chambres — le malentendu se paie au moment de la
 * livraison. Le bandeau le dit à sa place, sur chaque page.
 *
 * Il disparaît en passant le réglage `demo_mode` à false dans le back-office :
 * aucune modification de code, aucun déploiement.
 */
export async function DemoBanner() {
  const settings = await getPublicSettings();
  if (!settings.demo_mode) return null;

  const t = await getTranslations("common");

  return (
    <div className="bg-brown px-5 py-2.5 text-center text-ivory">
      <p className="mx-auto flex max-w-4xl items-center justify-center gap-2 text-[11px] leading-relaxed tracking-wide">
        <Info size={13} className="hidden shrink-0 sm:block" aria-hidden />
        {t("demoNotice")}
      </p>
    </div>
  );
}
