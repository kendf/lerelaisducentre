import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Trois clients, trois niveaux de privilège. Ne jamais les confondre.
 *
 *  - `createPublicClient()`  : clé anon, lecture du catalogue et appel des RPC
 *                              publiques. Soumis aux policies RLS.
 *  - `createUserClient()`    : clé anon + session du membre du personnel.
 *                              Soumis aux policies RLS, avec son rôle.
 *  - `createServiceClient()` : clé service_role, CONTOURNE TOUTES LES RLS.
 *                              Réservée aux webhooks et au cron, jamais
 *                              importée depuis un composant client.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Permet au site de se construire et de s'afficher avant que le projet
 * Supabase n'existe (phase de design). Les pages qui dépendent des données
 * affichent un état vide plutôt que de faire échouer le build.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}

function requireConfig(): { url: string; anonKey: string } {
  if (!url || !anonKey) {
    throw new Error(
      "Supabase n'est pas configuré : renseignez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local"
    );
  }
  return { url, anonKey };
}

/** Client public, sans session. Pour les pages du site vitrine. */
export function createPublicClient() {
  const cfg = requireConfig();
  return createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Client porteur de la session du membre du personnel (back-office). */
export async function createUserClient() {
  const cfg = requireConfig();
  const cookieStore = await cookies();

  return createServerClient(cfg.url, cfg.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Appelé depuis un Server Component : le rafraîchissement de session
          // est alors assuré par le middleware. Rien à faire ici.
        }
      },
    },
  });
}

/**
 * Client privilégié — contourne les RLS.
 *
 * N'EST UTILISÉ QUE PAR : le webhook de paiement (confirmation d'un acompte)
 * et le cron d'expiration des holds. Ces deux opérations doivent aboutir sans
 * session utilisateur, puisqu'il n'y a personne devant l'écran.
 * La clé n'est jamais exposée au navigateur : elle n'a pas de préfixe
 * NEXT_PUBLIC_, donc Next.js refuse de l'inclure dans un bundle client.
 */
export function createServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const cfg = requireConfig();
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante (opération serveur uniquement)");
  }
  return createClient(cfg.url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
