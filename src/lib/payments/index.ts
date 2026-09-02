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
export function getPaymentProvider(): PaymentProvider {
  const mode = process.env.PAYMENT_PROVIDER ?? "mock";
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

/** Vrai quand le simulateur est actif — affiche un avertissement dans le tunnel. */
export function isMockPayment(): boolean {
  return (process.env.PAYMENT_PROVIDER ?? "mock") === "mock";
}
