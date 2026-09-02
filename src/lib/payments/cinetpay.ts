import { timingSafeEqual } from "node:crypto";
import type {
  PaymentInitParams,
  PaymentInitResult,
  PaymentProvider,
  WebhookRequest,
  WebhookResult,
} from "./provider";
import { PaymentError } from "./provider";

/* =============================================================================
   Adaptateur CinetPay — API v1

   POURQUOI PAS LE SDK OFFICIEL. Le paquet `cinetpay-js` existe et son code est
   publié sous l'organisation GitHub vérifiée de CinetPay. Mais sur npm il est
   en 0.1.1, deux versions publiées, sans mise à jour depuis cinq mois, et
   maintenu depuis une adresse personnelle sans champ `repository`. Pour le
   chemin qui manipule l'argent des clients de l'hôtel, une dépendance dans cet
   état est un risque de chaîne d'approvisionnement mal payé : cent cinquante
   lignes ici nous coûtent moins qu'une version compromise là-bas.

   Ce fichier a donc été écrit à partir du SDK pris comme SPÉCIFICATION —
   endpoints, noms de champs sur le fil et bornes de validation en sont issus.

   DEUX GÉNÉRATIONS D'API. La documentation publique de CinetPay décrit l'API
   « Checkout » (api-checkout.cinetpay.com/v2, `apikey` + `site_id`, signature
   HMAC). Ce n'est PAS celle des comptes actuels. L'API v1 utilise :
     - api.cinetpay.net en bac à sable, api.cinetpay.co en production ;
     - un couple `api_key` / `api_password` échangé contre un jeton JWT ;
     - une vérification de notification par jeton partagé, pas par signature.
   ============================================================================= */

const SANDBOX_BASE = "https://api.cinetpay.net";
const PRODUCTION_BASE = "https://api.cinetpay.co";

const TEST_PREFIX = "sk_test_";
const LIVE_PREFIX = "sk_live_";

/** Bornes imposées par l'API. Les dépasser fait échouer l'appel. */
const MIN_AMOUNT_XOF = 100;
const MAX_AMOUNT_XOF = 2_500_000;
const MAX_MERCHANT_REF = 30;
const MAX_URL = 120;

interface CinetPayConfig {
  apiKey: string;
  apiPassword: string;
  /** Code pays ISO du jeu d'identifiants. Le compte est rattaché à un pays. */
  country: string;
}

interface LoginResponse {
  access_token?: string;
}

interface PaymentInitResponse {
  code?: number;
  status?: string;
  payment_url?: string;
  payment_token?: string;
  notify_token?: string;
  transaction_id?: string;
  merchant_transaction_id?: string;
  description?: string;
  message?: string;
}

interface PaymentStatusResponse {
  code?: number;
  status?: string;
  transaction_id?: string;
  merchant_transaction_id?: string;
  amount?: number | string;
  user?: { payment_method?: string; phone_number?: string };
  message?: string;
}

interface NotificationBody {
  notify_token?: string;
  merchant_transaction_id?: string;
  transaction_id?: string;
}

export class CinetPayProvider implements PaymentProvider {
  readonly name = "cinetpay";

  private readonly baseUrl: string;

  /**
   * Jeton d'accès en mémoire.
   *
   * L'API délivre un JWT de durée limitée. On le garde entre deux appels
   * plutôt que de se réauthentifier à chaque fois — mais sans jamais le
   * persister : un jeton en base est un secret de plus à protéger, pour une
   * valeur qui expire de toute façon.
   */
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private readonly config: CinetPayConfig) {
    if (config.apiKey.startsWith(LIVE_PREFIX)) {
      this.baseUrl = PRODUCTION_BASE;
    } else if (config.apiKey.startsWith(TEST_PREFIX)) {
      this.baseUrl = SANDBOX_BASE;
    } else {
      throw new PaymentError(
        "Clé CinetPay non reconnue : elle doit commencer par sk_test_ ou sk_live_.",
        "INVALID_KEY_PREFIX"
      );
    }
  }

  /** Vrai quand l'adaptateur parle au bac à sable — affiché dans le tunnel. */
  get isSandbox(): boolean {
    return this.baseUrl === SANDBOX_BASE;
  }

  // --- Authentification ----------------------------------------------------

  private async getToken(force = false): Promise<string> {
    // Marge de 60 secondes : un jeton qui expire pendant l'appel produirait
    // une erreur incompréhensible au client, en plein paiement.
    if (!force && this.token && this.token.expiresAt > Date.now() + 60_000) {
      return this.token.value;
    }

    const response = await fetch(`${this.baseUrl}/v1/oauth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: this.config.apiKey,
        api_password: this.config.apiPassword,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const data = (await response.json().catch(() => null)) as LoginResponse | null;

    if (!response.ok || !data?.access_token) {
      throw new PaymentError(
        "Authentification CinetPay refusée : vérifiez la clé et le mot de passe API.",
        "AUTH_FAILED"
      );
    }

    // Durée de vie non annoncée par la réponse : on retient prudemment cinq
    // minutes et on renouvelle sur rejet, plutôt que de parier sur une valeur.
    this.token = { value: data.access_token, expiresAt: Date.now() + 5 * 60_000 };
    return this.token.value;
  }

  /** Appel authentifié, avec une seule reprise si le jeton a expiré. */
  private async call<T>(
    path: string,
    init: { method: "GET" | "POST"; body?: unknown }
  ): Promise<{ status: number; data: T | null }> {
    const send = async (token: string) =>
      fetch(`${this.baseUrl}${path}`, {
        method: init.method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(init.body ? { "Content-Type": "application/json" } : {}),
        },
        body: init.body ? JSON.stringify(init.body) : undefined,
        signal: AbortSignal.timeout(20_000),
      });

    let response = await send(await this.getToken());

    if (response.status === 401) {
      response = await send(await this.getToken(true));
    }

    return {
      status: response.status,
      data: (await response.json().catch(() => null)) as T | null,
    };
  }

  // --- Initialisation ------------------------------------------------------

  async initPayment(params: PaymentInitParams): Promise<PaymentInitResult> {
    // Les bornes de l'API sont vérifiées ICI plutôt que découvertes au guichet.
    // Un refus en pleine réservation coûte un client ; un refus ici est un bug
    // que nous voyons en test.
    if (
      !Number.isInteger(params.amountXof) ||
      params.amountXof < MIN_AMOUNT_XOF ||
      params.amountXof > MAX_AMOUNT_XOF
    ) {
      throw new PaymentError(
        `Montant hors bornes CinetPay (${MIN_AMOUNT_XOF} à ${MAX_AMOUNT_XOF} FCFA) : ${params.amountXof}`,
        "INVALID_AMOUNT"
      );
    }
    if (params.reference.length > MAX_MERCHANT_REF) {
      throw new PaymentError(
        `Référence trop longue pour CinetPay (${MAX_MERCHANT_REF} caractères) : ${params.reference}`,
        "REFERENCE_TOO_LONG"
      );
    }
    for (const [label, url] of [
      ["notifyUrl", params.notifyUrl],
      ["returnUrl", params.returnUrl],
    ] as const) {
      if (url.length > MAX_URL) {
        throw new PaymentError(
          `URL ${label} trop longue pour CinetPay (${MAX_URL} caractères) : ${url.length}`,
          "URL_TOO_LONG"
        );
      }
    }

    const { status, data } = await this.call<PaymentInitResponse>("/v1/payment", {
      method: "POST",
      body: {
        currency: "XOF",
        merchant_transaction_id: params.reference,
        amount: params.amountXof,
        lang: params.locale === "en" ? "en" : "fr",
        designation: `Acompte reservation ${params.reference}`,
        client_email: params.customer.email,
        client_first_name: params.customer.firstName,
        client_last_name: params.customer.lastName,
        client_phone_number: params.customer.phone,
        success_url: params.returnUrl,
        failed_url: params.returnUrl,
        notify_url: params.notifyUrl,
        // PUSH : le client reçoit la demande de paiement sur son téléphone.
        // C'est le mode attendu pour le Mobile Money en Afrique de l'Ouest.
        channel: "PUSH",
      },
    });

    if (status >= 400 || !data?.payment_url) {
      throw new PaymentError(
        `CinetPay a refusé l'initialisation (${status}) : ${data?.message ?? data?.description ?? "réponse inattendue"}`,
        "INIT_FAILED"
      );
    }

    return {
      paymentUrl: data.payment_url,
      providerRef: data.transaction_id ?? data.payment_token ?? params.reference,
      // Conservé par l'appelant : c'est la seule preuve d'authenticité de la
      // notification à venir.
      notifyToken: data.notify_token,
    };
  }

  // --- Notification --------------------------------------------------------

  async verifyWebhook(request: WebhookRequest): Promise<WebhookResult> {
    let body: NotificationBody;
    try {
      body = JSON.parse(request.rawBody) as NotificationBody;
    } catch {
      // Certains prestataires notifient en formulaire : on retente.
      body = Object.fromEntries(
        new URLSearchParams(request.rawBody)
      ) as NotificationBody;
    }

    const reference = body.merchant_transaction_id;
    if (!reference) return { ok: false, reason: "MISSING_MERCHANT_REFERENCE" };
    if (!request.lookup) return { ok: false, reason: "NO_LOOKUP_PROVIDED" };

    const context = await request.lookup(reference);
    if (!context) return { ok: false, reason: "UNKNOWN_TRANSACTION" };

    // 1) Le jeton partagé, comparé à temps constant.
    if (!context.notifyToken || !body.notify_token) {
      return { ok: false, reason: "MISSING_NOTIFY_TOKEN" };
    }
    if (!constantTimeEquals(context.notifyToken, body.notify_token)) {
      return { ok: false, reason: "BAD_NOTIFY_TOKEN" };
    }

    // 2) Le statut réel, redemandé à l'API. Un jeton partagé prouve seulement
    //    que l'émetteur le connaît — pas que le paiement a eu lieu, ni pour
    //    quel montant. Seule la réponse de l'API fait foi.
    const { status, data } = await this.call<PaymentStatusResponse>(
      `/v1/payment/${encodeURIComponent(reference)}`,
      { method: "GET" }
    );

    if (status >= 400 || !data) {
      return { ok: false, reason: `STATUS_CHECK_FAILED_${status}` };
    }

    const succeeded = data.status === "SUCCESS";
    const pending = data.status === "PENDING" || data.status === "WAITING";

    return {
      ok: true,
      event: {
        reservationId: context.reservationId,
        providerRef: data.transaction_id ?? body.transaction_id ?? reference,
        amountXof: Math.round(Number(data.amount ?? 0)),
        method: data.user?.payment_method ?? null,
        status: succeeded ? "succeeded" : pending ? "pending" : "failed",
        failureReason: succeeded || pending ? undefined : (data.status ?? data.message),
        raw: { notification: body, check: data },
      },
    };
  }
}

/** Comparaison à temps constant, tolérante aux longueurs différentes. */
function constantTimeEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
