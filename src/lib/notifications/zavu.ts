import "server-only";

/**
 * Client Zavu — WhatsApp, SMS et e-mail derrière une seule API.
 * POST https://api.zavu.dev/v1/messages, authentification par jeton Bearer.
 *
 * POURQUOI CE PRESTATAIRE (CDC §7.4) ?
 * Le cahier des charges impose des confirmations par e-mail ET par SMS. En
 * Côte d'Ivoire, l'homologation d'un identifiant d'expéditeur SMS auprès des
 * opérateurs prend des semaines. Zavu couvre les trois canaux d'un seul
 * contrat et bascule automatiquement en SMS quand WhatsApp échoue : on tient
 * l'engagement du CDC sans dépendre d'une seule passerelle.
 *
 * Le client reste volontairement mince et isolé : si Zavu disparaît ou déçoit,
 * on réécrit ce fichier (Twilio, Brevo) sans toucher au moteur de réservation.
 */

const API_URL = "https://api.zavu.dev/v1/messages";

export type ZavuChannel = "whatsapp" | "sms" | "email";

export interface ZavuSendParams {
  to: string;
  channel: ZavuChannel;
  text: string;
  subject?: string;
  htmlBody?: string;
  /** Identifiant de template Meta — obligatoire pour un WhatsApp sortant. */
  templateId?: string;
  templateVariables?: Record<string, string>;
  /** Empêche un double envoi si l'appelant est rejoué. */
  idempotencyKey?: string;
}

export interface ZavuSendResult {
  ok: boolean;
  providerRef?: string;
  status?: string;
  error?: string;
}

export function isZavuConfigured(): boolean {
  return Boolean(process.env.ZAVU_API_KEY);
}

export async function zavuSend(params: ZavuSendParams): Promise<ZavuSendResult> {
  const apiKey = process.env.ZAVU_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "ZAVU_NOT_CONFIGURED" };
  }

  // Un message WhatsApp vers quelqu'un qui ne nous a jamais écrit sort de la
  // fenêtre de 24 h de Meta : il exige un template approuvé. Sans template
  // configuré, l'API répondrait 400 — on le dit clairement plutôt que de
  // laisser échouer l'envoi sans explication.
  const isTemplate = params.channel === "whatsapp" && Boolean(params.templateId);

  const body: Record<string, unknown> = {
    to: params.to,
    channel: params.channel,
    messageType: isTemplate ? "template" : "text",
    text: params.text,
  };

  if (isTemplate) {
    body.content = {
      templateId: params.templateId,
      templateVariables: params.templateVariables ?? {},
    };
  }

  if (params.channel === "email") {
    body.subject = params.subject;
    if (params.htmlBody) body.htmlBody = params.htmlBody;
  }

  if (params.idempotencyKey) body.idempotencyKey = params.idempotencyKey;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  // Sélectionne l'expéditeur déclaré dans Zavu (numéro WhatsApp professionnel
  // de l'hôtel, domaine e-mail authentifié). Optionnel : sans lui, Zavu utilise
  // l'expéditeur par défaut du projet.
  const senderId = process.env.ZAVU_SENDER_ID;
  if (senderId) headers["Zavu-Sender"] = senderId;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      // Une notification lente ne doit jamais retarder la réponse au webhook
      // du prestataire de paiement, qui réessaierait pour rien.
      signal: AbortSignal.timeout(10_000),
    });

    const payload = (await response.json().catch(() => null)) as {
      message?: { id?: string; status?: string };
      error?: string;
      message_error?: string;
    } | null;

    if (!response.ok) {
      return {
        ok: false,
        error: `HTTP_${response.status}${payload?.error ? `:${payload.error}` : ""}`,
      };
    }

    return {
      ok: true,
      providerRef: payload?.message?.id,
      status: payload?.message?.status,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "NETWORK_ERROR",
    };
  }
}
