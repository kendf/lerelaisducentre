import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  PaymentInitParams,
  PaymentInitResult,
  PaymentProvider,
  WebhookRequest,
  WebhookResult,
} from "./provider";
import { PaymentError } from "./provider";

const CHECKOUT_URL = "https://api-checkout.cinetpay.com/v2/payment";
const CHECK_URL = "https://api-checkout.cinetpay.com/v2/payment/check";

interface CinetPayConfig {
  apiKey: string;
  siteId: string;
  secretKey?: string;
}

/**
 * Adaptateur CinetPay — Orange Money, Wave, MTN Money, Moov Money.
 *
 * Le mode bac à sable (clés `sk_test_`) ne demande aucun compte marchand :
 * c'est ce qui permet de démontrer le tunnel complet avant l'ouverture du
 * dossier KYC de l'hôtel. Le passage en production se fait en changeant les
 * clés dans les variables d'environnement, sans toucher au code.
 */
export class CinetPayProvider implements PaymentProvider {
  readonly name = "cinetpay";

  constructor(private readonly config: CinetPayConfig) {}

  async initPayment(params: PaymentInitParams): Promise<PaymentInitResult> {
    // CinetPay impose des montants multiples de 5 en XOF. Notre acompte est
    // arrondi à la centaine supérieure côté base (fonction quote_stay), donc
    // la contrainte est satisfaite — on la vérifie quand même : un refus du
    // guichet en pleine réservation coûte un client.
    if (params.amountXof % 5 !== 0) {
      throw new PaymentError(
        `Montant non conforme à CinetPay (multiple de 5 attendu) : ${params.amountXof}`,
        "INVALID_AMOUNT"
      );
    }

    const payload = {
      apikey: this.config.apiKey,
      site_id: this.config.siteId,
      // La référence lisible sert d'identifiant de transaction : on la retrouve
      // à l'identique dans le tableau de bord CinetPay et au back-office.
      transaction_id: params.reference,
      amount: params.amountXof,
      currency: "XOF",
      description: `Acompte reservation ${params.reference}`,
      customer_name: params.customer.firstName,
      customer_surname: params.customer.lastName,
      customer_email: params.customer.email,
      customer_phone_number: params.customer.phone,
      channels: "MOBILE_MONEY",
      lang: params.locale === "en" ? "en" : "fr",
      return_url: params.returnUrl,
      notify_url: params.notifyUrl,
      // Renvoyé tel quel dans le webhook : évite de dépendre d'une recherche
      // par référence pour retrouver la réservation.
      metadata: params.reservationId,
    };

    const response = await fetch(CHECKOUT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = (await response.json()) as {
      code?: string;
      message?: string;
      data?: { payment_url?: string; payment_token?: string };
    };

    if (body.code !== "201" || !body.data?.payment_url) {
      throw new PaymentError(
        `CinetPay a refusé l'initialisation : ${body.code ?? "?"} ${body.message ?? ""}`,
        "INIT_FAILED"
      );
    }

    return {
      paymentUrl: body.data.payment_url,
      providerRef: body.data.payment_token ?? params.reference,
    };
  }

  async verifyWebhook(request: WebhookRequest): Promise<WebhookResult> {
    // CinetPay notifie en form-urlencoded.
    const fields = Object.fromEntries(new URLSearchParams(request.rawBody));
    const transactionId = fields.cpm_trans_id;

    if (!transactionId) {
      return { ok: false, reason: "MISSING_TRANSACTION_ID" };
    }

    // 1) Contrôle de signature quand la clé secrète est configurée.
    if (this.config.secretKey) {
      const token = request.headers.get("x-token");
      if (!token || !this.isSignatureValid(fields, token)) {
        return { ok: false, reason: "BAD_SIGNATURE" };
      }
    }

    // 2) Contre-appel systématique à l'API : c'est la SEULE source de vérité.
    //    Le corps du webhook est public — n'importe qui peut appeler cette URL
    //    en prétendant qu'un paiement a réussi. On ne confirme jamais une
    //    réservation sans avoir redemandé le statut à CinetPay.
    const response = await fetch(CHECK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: this.config.apiKey,
        site_id: this.config.siteId,
        transaction_id: transactionId,
      }),
    });

    const check = (await response.json()) as {
      code?: string;
      message?: string;
      data?: {
        amount?: number | string;
        status?: string;
        payment_method?: string;
        metadata?: string;
        operator_id?: string;
      };
    };

    const data = check.data;
    if (!data) {
      return { ok: false, reason: `CHECK_FAILED_${check.code ?? "UNKNOWN"}` };
    }

    const reservationId = data.metadata;
    if (!reservationId) {
      return { ok: false, reason: "MISSING_RESERVATION_REFERENCE" };
    }

    const accepted = check.code === "00" && data.status === "ACCEPTED";

    return {
      ok: true,
      event: {
        reservationId,
        providerRef: transactionId,
        amountXof: Math.round(Number(data.amount ?? 0)),
        method: data.payment_method ?? null,
        status: accepted ? "succeeded" : "failed",
        failureReason: accepted ? undefined : (data.status ?? check.message),
        raw: { webhook: fields, check },
      },
    };
  }

  /**
   * Signature HMAC-SHA256 des champs de notification, dans l'ordre imposé par
   * CinetPay. Comparaison à temps constant pour ne pas laisser fuiter
   * d'information par la durée de la vérification.
   */
  private isSignatureValid(
    fields: Record<string, string>,
    token: string
  ): boolean {
    const ordered = [
      "cpm_site_id",
      "cpm_trans_id",
      "cpm_trans_date",
      "cpm_amount",
      "cpm_currency",
      "signature",
      "payment_method",
      "cel_phone_num",
      "cpm_phone_prefixe",
      "cpm_language",
      "cpm_version",
      "cpm_payment_config",
      "cpm_page_action",
      "cpm_custom",
      "cpm_designation",
      "cpm_error_message",
    ]
      .map((key) => fields[key] ?? "")
      .join("");

    const expected = createHmac("sha256", this.config.secretKey!)
      .update(ordered)
      .digest("hex");

    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(token, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
