import "server-only";
import { CinetPayProvider } from "./cinetpay";
import { MockPaymentProvider } from "./mock";
import type { PaymentProvider } from "./provider";
import { getSiteUrl } from "@/lib/site-url";

export type { PaymentProvider, PaymentEvent } from "./provider";
export { PaymentError } from "./provider";

/**
 * Sélection du prestataire par variable d'environnement.
 *
 *   mock     → simulateur local (tests automatisés, démonstration)
 *   cinetpay → API v1 de CinetPay
 *
 * IL N'Y A PLUS DE CHOIX BAC À SABLE / PRODUCTION. L'API v1 déduit
 * l'environnement du PRÉFIXE DE LA CLÉ : `sk_test_` interroge
 * api.cinetpay.net, `sk_live_` api.cinetpay.co. Offrir un réglage séparé
 * créerait une seconde source de vérité — et donc la possibilité de les mettre
 * en contradiction, exactement l'erreur qu'on veut rendre impossible.
 *
 * Aucun appel n'est fait ici : la fabrique est appelée à la demande, pour que
 * l'absence de clés n'empêche pas le reste du site de fonctionner.
 */
/**
 * Mode de paiement, normalisé UNE SEULE FOIS pour tout le module.
 *
 * POURQUOI `||` ET NON `??`. `??` ne se déclenche que sur null ou undefined.
 * Une variable DÉCLARÉE MAIS VIDE le traverse et vaut la chaîne vide, qui
 * n'est ni « mock » ni « cinetpay ». C'est le cas produit par un import de
 * fichier .env dans un hébergeur, et c'est la troisième fois que ce défaut
 * frappe ce projet — après NEXT_PUBLIC_SITE_URL, qui faisait échouer la
 * construction, et le type des variables Supabase sur Vercel.
 *
 * L'effet ici était particulièrement trompeur : le tunnel MASQUAIT
 * l'avertissement « Mode simulation » (la valeur n'est pas « mock ») tout en
 * faisant LEVER la fabrique au clic sur « Payer ». Deux symptômes opposés pour
 * une seule cause.
 *
 * Cette fonction ne lève jamais : c'est la fabrique qui décide quoi faire
 * d'une valeur inconnue. `isMockPayment()` est appelée pendant le rendu d'une
 * page et ne doit pas pouvoir la casser.
 */
function resolveMode(): string {
  return process.env.PAYMENT_PROVIDER?.trim().toLowerCase() || "mock";
}

export function getPaymentProvider(): PaymentProvider {
  const mode = resolveMode();
  const siteUrl = getSiteUrl();

  if (mode === "mock") {
    return new MockPaymentProvider(
      siteUrl,
      // En développement, un secret par défaut suffit : le simulateur ne
      // manipule aucun argent réel et n'est jamais déployé en production.
      process.env.CRON_SECRET ?? "mock-secret-dev"
    );
  }

  if (mode !== "cinetpay") {
    throw new Error(
      `PAYMENT_PROVIDER=${mode} inconnu. Valeurs acceptées : mock, cinetpay.`
    );
  }

  const country = process.env.CINETPAY_COUNTRY ?? "CI";
  const apiKey = process.env[`CINETPAY_API_KEY_${country}`];
  const apiPassword = process.env[`CINETPAY_API_PASSWORD_${country}`];

  if (!apiKey || !apiPassword) {
    throw new Error(
      `PAYMENT_PROVIDER=cinetpay mais CINETPAY_API_KEY_${country} / CINETPAY_API_PASSWORD_${country} sont absentes.`
    );
  }

  // Garde-fou de mise en production : une clé de production sur un site qui
  // n'est pas le domaine définitif débiterait de vrais clients pendant une
  // démonstration. L'erreur se détecte ici, pas au premier paiement.
  if (apiKey.startsWith("sk_live_") && siteUrl.includes("localhost")) {
    throw new Error(
      "Clé CinetPay de PRODUCTION avec une URL locale — interrompu."
    );
  }

  return new CinetPayProvider({ apiKey, apiPassword, country });
}

/**
 * Vrai quand le simulateur est actif — affiche un avertissement dans le tunnel.
 * Partage `resolveMode()` avec la fabrique : les deux ne peuvent plus se
 * contredire sur ce que vaut PAYMENT_PROVIDER.
 */
export function isMockPayment(): boolean {
  return resolveMode() === "mock";
}
