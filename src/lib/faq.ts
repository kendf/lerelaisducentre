import "server-only";
import { getTranslations } from "next-intl/server";
import { getPublicSettings } from "@/lib/content";

export interface FaqItem {
  q: string;
  a: string;
}

export interface FaqGroup {
  title: string;
  items: FaqItem[];
}

/**
 * Contenu de la foire aux questions, avec les valeurs réelles substituées.
 *
 * UNE SEULE SOURCE. La page Questions et l'assistant flottant lisent tous deux
 * cette fonction : deux jeux de réponses divergeraient au premier ajustement,
 * et le visiteur lirait une chose dans la bulle et une autre sur la page.
 *
 * Les chiffres — acompte, délai d'annulation, horaires — viennent des réglages
 * du back-office, jamais du texte. Le jour où le gérant passe l'acompte à
 * 40 %, la réponse suit toute seule. C'est la seule façon d'éviter une FAQ qui
 * ment poliment quelques mois après sa rédaction.
 */
export async function getFaq(): Promise<FaqGroup[]> {
  const [t, settings] = await Promise.all([
    getTranslations("faq"),
    getPublicSettings(),
  ]);

  const values: Record<string, string> = {
    percent: String(settings.deposit_percent),
    hours: String(settings.free_cancellation_hours),
    checkIn: settings.check_in_time,
    checkOut: settings.check_out_time,
  };

  const groups = t.raw("groups") as FaqGroup[];

  return groups.map((group) => ({
    title: group.title,
    items: group.items.map((item) => ({
      q: item.q,
      // Substitution manuelle plutôt que `t()` avec paramètres : le contenu
      // arrive en bloc via `t.raw()`, il n'est donc pas passé au formateur ICU.
      a: item.a.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match),
    })),
  }));
}
