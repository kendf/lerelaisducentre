import { NextResponse } from "next/server";
import { MockPaymentProvider } from "@/lib/payments/mock";
import { isMockPayment } from "@/lib/payments";

/**
 * Faux guichet Mobile Money.
 *
 * Reproduit le comportement d'un agrégateur : le visiteur quitte le site, agit
 * sur une page tierce, et c'est une notification SERVEUR — pas son retour dans
 * le navigateur — qui confirme la réservation. C'est ce qui permet de tester
 * pour de vrai le chemin critique du paiement, y compris le refus, avant que
 * l'hôtel n'ait ouvert son compte marchand CinetPay.
 *
 * Refuse de répondre dès que PAYMENT_PROVIDER n'est pas « mock » : ce guichet
 * ne peut pas être atteint en production, même par accident.
 */

function guard(): NextResponse | null {
  if (!isMockPayment()) {
    return NextResponse.json({ error: "MOCK_DISABLED" }, { status: 404 });
  }
  return null;
}

export async function GET(request: Request) {
  const blocked = guard();
  if (blocked) return blocked;

  const url = new URL(request.url);
  const reservation = url.searchParams.get("reservation") ?? "";
  const ref = url.searchParams.get("ref") ?? "";
  const amount = url.searchParams.get("amount") ?? "0";
  const returnUrl = url.searchParams.get("return") ?? "/";

  const amountLabel = new Intl.NumberFormat("fr-FR").format(Number(amount));

  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Guichet de paiement (simulation)</title>
  <style>
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
         background:#1f2937;font-family:system-ui,-apple-system,sans-serif;padding:20px;}
    .card{background:#fff;border-radius:10px;max-width:400px;width:100%;padding:32px;
          box-shadow:0 20px 50px rgba(0,0,0,.35);}
    .tag{display:inline-block;background:#fef3c7;color:#92400e;font-size:11px;font-weight:600;
         letter-spacing:.08em;text-transform:uppercase;padding:5px 10px;border-radius:4px;}
    h1{font-size:19px;margin:18px 0 6px;color:#111827;}
    p{color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 6px;}
    .amount{font-size:32px;font-weight:700;color:#111827;margin:20px 0 4px;}
    .ref{font-family:ui-monospace,monospace;font-size:12px;color:#9ca3af;}
    form{margin-top:26px;display:flex;flex-direction:column;gap:10px;}
    button{padding:14px;border:0;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;}
    .ok{background:#059669;color:#fff;} .ok:hover{background:#047857;}
    .ko{background:#fff;color:#b91c1c;border:1px solid #fecaca;} .ko:hover{background:#fef2f2;}
    .note{margin-top:20px;font-size:12px;color:#9ca3af;line-height:1.6;}
  </style>
</head>
<body>
  <div class="card">
    <span class="tag">Simulation — aucun paiement réel</span>
    <h1>Paiement de l'acompte</h1>
    <p>Hôtel Le Relais du Centre</p>
    <div class="amount">${amountLabel} F CFA</div>
    <div class="ref">${ref}</div>
    <form method="post">
      <input type="hidden" name="reservation" value="${reservation}">
      <input type="hidden" name="ref" value="${ref}">
      <input type="hidden" name="amount" value="${amount}">
      <input type="hidden" name="return" value="${returnUrl}">
      <button class="ok" name="outcome" value="succeeded">Valider le paiement</button>
      <button class="ko" name="outcome" value="failed">Simuler un échec</button>
    </form>
    <p class="note">Ce guichet remplace Orange Money / Wave tant que le compte
    marchand CinetPay de l'hôtel n'est pas ouvert. Il notifie le serveur
    exactement comme le ferait l'agrégateur.</p>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function POST(request: Request) {
  const blocked = guard();
  if (blocked) return blocked;

  const form = await request.formData();
  const reservationId = String(form.get("reservation") ?? "");
  const providerRef = String(form.get("ref") ?? "");
  const amountXof = Number(form.get("amount") ?? 0);
  const outcome = String(form.get("outcome") ?? "succeeded");
  const returnUrl = String(form.get("return") ?? "/");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const provider = new MockPaymentProvider(
    siteUrl,
    process.env.CRON_SECRET ?? "mock-secret-dev"
  );

  const body = JSON.stringify({
    reservationId,
    providerRef,
    amountXof,
    outcome,
    method: "orange_money",
  });

  // Appel serveur à serveur, signé — exactement le chemin qu'emprunte une vraie
  // notification d'agrégateur. Le navigateur du visiteur n'y participe pas.
  await fetch(`${siteUrl}/api/payments/mock/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-mock-signature": provider.sign(body),
    },
    body,
  }).catch((err) => console.error("[mock] notification :", err));

  return NextResponse.redirect(returnUrl, { status: 303 });
}
