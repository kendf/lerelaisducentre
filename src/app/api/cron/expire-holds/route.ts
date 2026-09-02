import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Libération des chambres dont l'acompte n'a jamais été réglé.
 *
 * Appelée toutes les 5 minutes par un cron Vercel. Volontairement PAS branchée
 * sur pg_cron : une route serveur ne dépend d'aucune extension Postgres et se
 * comporte à l'identique en local, en démonstration et en production.
 *
 * Sans ce mécanisme, un visiteur qui abandonne au moment de payer immobilise
 * une chambre indéfiniment — l'hôtel afficherait complet sans l'être.
 */
export async function GET(request: Request) {
  // La route modifie l'inventaire : elle ne doit pas être déclenchable par
  // n'importe qui. Vercel Cron envoie l'en-tête Authorization avec CRON_SECRET.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = request.headers.get("authorization");
    if (header !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("expire_stale_holds");

  if (error) {
    console.error("[cron] expire_stale_holds:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ expired: data ?? 0, at: new Date().toISOString() });
}
