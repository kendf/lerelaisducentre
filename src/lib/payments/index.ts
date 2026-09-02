import "server-only";
import { CinetPayProvider } from "./cinetpay";
import { MockPaymentProvider } from "./mock";
import type { PaymentProvider } from "./provider";

export type { PaymentProvider, PaymentEvent } from "./provider";
export { PaymentError } from "./provider";

/**
 * Sélection du prestataire par variable d'environnement.
 *
 *   mock             → simulateur local (tests automatisés, démonstration)
 *   cinetpay_sandbox → clés sk_test_, aucun compte marchand requis
 *   cinetpay_live    → clés sk_live_, exige le dossier KYC de l'hôtel
 *
 * Aucun appel n'est fait ici : la fabrique est appelée à la demande, pour que
 * l'absence de clés n'empêche pas le reste du site de fonctionner.
 */
export function getPaymentProvider(): PaymentProvider {
  const mode = process.env.PAYMENT_PROVIDER ?? "mock";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  if (mode === "mock") {
    return new MockPaymentProvider(
      siteUrl,
      // En développement, un secret par défaut suffit : le simulateur ne
      // manipule aucun argent réel et n'est jamais déployé en production.
      process.env.CRON_SECRET ?? "mock-secret-dev"
    );
  }

  const apiKey = process.env.CINETPAY_API_KEY;
  const siteId = process.env.CINETPAY_SITE_ID;

  if (!apiKey || !siteId) {
    throw new Error(
      `PAYMENT_PROVIDER=${mode} mais CINETPAY_API_KEY / CINETPAY_SITE_ID sont absentes.`
    );
  }

  // Garde-fou de mise en production : une clé de test en production
  // encaisserait dans le vide, une clé de production en démo débiterait de
  // vrais clients. Les deux erreurs se détectent ici, pas au premier paiement.
  if (mode === "cinetpay_live" && apiKey.startsWith("sk_test_")) {
    throw new Error("Clé CinetPay de TEST utilisée en mode live — interrompu.");
  }
  if (mode === "cinetpay_sandbox" && apiKey.startsWith("sk_live_")) {
    throw new Error("Clé CinetPay de PRODUCTION utilisée en bac à sable — interrompu.");
  }

  return new CinetPayProvider({
    apiKey,
    siteId,
    secretKey: process.env.CINETPAY_SECRET_KEY,
  });
}

/** Vrai quand le simulateur est actif — affiche un avertissement dans le tunnel. */
export function isMockPayment(): boolean {
  return (process.env.PAYMENT_PROVIDER ?? "mock") === "mock";
}
