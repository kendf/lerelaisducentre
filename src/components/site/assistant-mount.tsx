import { getFaq } from "@/lib/faq";
import { getPublicSettings } from "@/lib/content";
import { Assistant } from "./assistant";

/**
 * Alimente l'assistant depuis le serveur.
 *
 * Les questions et les coordonnées sont résolues au rendu, donc la bulle
 * s'ouvre déjà remplie : aucun appel réseau au clic, et les réponses portent
 * les valeurs réelles des réglages (acompte, horaires, délai d'annulation).
 *
 * Cinq questions seulement — celles qui décident d'une réservation. Une bulle
 * n'est pas une page : y déverser les douze entrées de la FAQ la rendrait
 * illisible, et le lien vers la page complète est là pour le reste.
 */
export async function AssistantMount() {
  const [groups, settings] = await Promise.all([getFaq(), getPublicSettings()]);

  const questions = groups.flatMap((group) => group.items).slice(0, 5);

  return (
    <Assistant
      questions={questions}
      phone={settings.hotel_contact.phone}
      whatsapp={settings.hotel_contact.whatsapp}
    />
  );
}
