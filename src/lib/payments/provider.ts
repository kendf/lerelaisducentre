import type { Locale } from "@/types/database";

/**
 * Contrat commun à tous les prestataires de paiement.
 *
 * POURQUOI UNE INTERFACE PLUTÔT QU'UN APPEL DIRECT À CINETPAY ?
 * Trois raisons concrètes sur ce projet :
 *   1. La démo doit fonctionner de bout en bout AVANT que l'hôtel n'ait ouvert
 *      son compte marchand (dossier KYC : RCCM, DFE, pièce du gérant).
 *   2. Les cas limites — échec Mobile Money, webhook rejoué, abandon en cours
 *      de paiement — ne sont testables automatiquement qu'avec un simulateur.
 *   3. Si l'hôtel change d'agrégateur (PayDunya, Hub2) ou ajoute la carte
 *      bancaire (option CDC §3.4), on écrit un adaptateur, pas une migration.
 *
 * Le moteur de réservation ne connaît que ce contrat : il ignore totalement
 * qui encaisse.
 */

export interface PaymentInitParams {
  reservationId: string;
  reference: string;
  /** Montant de l'acompte en FCFA, entier. */
  amountXof: number;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  locale: Locale;
  /** Page sur laquelle le client revient après le guichet de paiement. */
  returnUrl: string;
  /** URL serveur appelée par le prestataire — c'est elle qui fait foi. */
  notifyUrl: string;
}

export interface PaymentInitResult {
  /** Page de paiement vers laquelle rediriger le visiteur. */
  paymentUrl: string;
  /** Identifiant de transaction côté prestataire. */
  providerRef: string;
  /**
   * Jeton à conserver pour authentifier la notification à venir.
   * Présent chez les prestataires qui vérifient par secret partagé plutôt que
   * par signature — CinetPay v1 notamment. À stocker, jamais à exposer.
   */
  notifyToken?: string;
}

export interface PaymentEvent {
  reservationId: string;
  providerRef: string;
  amountXof: number;
  method: string | null;
  status: "succeeded" | "failed" | "pending";
  failureReason?: string;
  raw: unknown;
}

export type WebhookResult =
  | { ok: true; event: PaymentEvent }
  | { ok: false; reason: string };

/** Contexte d'une transaction, retrouvé à partir de notre propre référence. */
export interface WebhookContext {
  reservationId: string;
  notifyToken: string | null;
}

export interface WebhookRequest {
  headers: Headers;
  rawBody: string;
  /**
   * Retrouve le contexte d'une transaction à partir de la référence marchand.
   *
   * Certains prestataires n'identifient la notification que par NOTRE
   * référence, et leur vérification exige un jeton conservé à l'initialisation.
   * L'adaptateur a donc besoin de consulter la base — mais il ne doit pas la
   * connaître. La route lui fournit cette fonction, et lui seul décide s'il
   * en a l'usage.
   */
  lookup?: (merchantReference: string) => Promise<WebhookContext | null>;
}

export interface PaymentProvider {
  readonly name: string;

  /** Crée la transaction et renvoie l'URL du guichet. */
  initPayment(params: PaymentInitParams): Promise<PaymentInitResult>;

  /**
   * Valide une notification entrante et en extrait l'événement.
   *
   * L'implémentation ne doit JAMAIS se contenter de croire le corps de la
   * requête : n'importe qui peut appeler cette URL. Elle vérifie la signature
   * puis, quand le prestataire le permet, réinterroge son API pour connaître
   * le statut réel de la transaction.
   */
  verifyWebhook(request: WebhookRequest): Promise<WebhookResult>;
}

/** Erreur métier de paiement, distinguée d'une panne technique. */
export class PaymentError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = "PaymentError";
  }
}
