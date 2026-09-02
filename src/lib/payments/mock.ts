import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  PaymentInitParams,
  PaymentInitResult,
  PaymentProvider,
  WebhookRequest,
  WebhookResult,
} from "./provider";

/**
 * Simulateur de guichet Mobile Money.
 *
 * Ce n'est pas un bouchon jetable : c'est l'outil qui rend testables les cas
 * limites que le CDC nous impose d'anticiper et qu'aucun bac à sable ne
 * reproduit à la demande — paiement refusé, webhook rejoué, abandon en cours
 * de règlement, notification falsifiée. Il reste dans le projet après la mise
 * en production, au service des tests automatisés.
 *
 * Il n'est activable qu'en positionnant PAYMENT_PROVIDER=mock : en production
 * la variable vaut cinetpay_live, et ce fichier n'est jamais instancié.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";

  constructor(
    private readonly siteUrl: string,
    private readonly secret: string
  ) {}

  async initPayment(params: PaymentInitParams): Promise<PaymentInitResult> {
    const providerRef = `MOCK-${params.reference}`;
    const url = new URL("/api/mock-checkout", this.siteUrl);
    url.searchParams.set("reservation", params.reservationId);
    url.searchParams.set("ref", providerRef);
    url.searchParams.set("amount", String(params.amountXof));
    url.searchParams.set("return", params.returnUrl);

    return { paymentUrl: url.toString(), providerRef };
  }

  async verifyWebhook(request: WebhookRequest): Promise<WebhookResult> {
    const signature = request.headers.get("x-mock-signature");
    if (!signature || !this.isSignatureValid(request.rawBody, signature)) {
      return { ok: false, reason: "BAD_SIGNATURE" };
    }

    let payload: {
      reservationId?: string;
      providerRef?: string;
      amountXof?: number;
      outcome?: "succeeded" | "failed";
      method?: string;
    };

    try {
      payload = JSON.parse(request.rawBody);
    } catch {
      return { ok: false, reason: "INVALID_JSON" };
    }

    if (!payload.reservationId || !payload.providerRef) {
      return { ok: false, reason: "MISSING_FIELDS" };
    }

    return {
      ok: true,
      event: {
        reservationId: payload.reservationId,
        providerRef: payload.providerRef,
        amountXof: Number(payload.amountXof ?? 0),
        method: payload.method ?? "orange_money",
        status: payload.outcome === "failed" ? "failed" : "succeeded",
        failureReason:
          payload.outcome === "failed" ? "Simulation de refus" : undefined,
        raw: payload,
      },
    };
  }

  /** Signe un corps de notification — utilisé par la page de simulation. */
  sign(body: string): string {
    return createHmac("sha256", this.secret).update(body).digest("hex");
  }

  private isSignatureValid(body: string, signature: string): boolean {
    const expected = this.sign(body);
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signature, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
