import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Rafraîchissement de la session du personnel à chaque requête sur /admin.
 *
 * Les jetons Supabase expirent au bout d'une heure. Sans ce passage dans le
 * middleware, une réceptionniste qui laisse son écran ouvert pendant le service
 * serait déconnectée en pleine saisie. Le middleware renouvelle le jeton et
 * réécrit les cookies, de façon transparente.
 *
 * IMPORTANT : on utilise `getUser()` et non `getSession()`. `getSession()` lit
 * le cookie sans le vérifier — un cookie forgé passerait. `getUser()` valide le
 * jeton auprès du serveur d'authentification. Sur une page qui donne accès aux
 * coordonnées des clients et aux montants encaissés, la différence n'est pas
 * théorique.
 */
export async function updateAdminSession(
  request: NextRequest
): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Environnement non configuré : on laisse passer, les pages afficheront
  // l'erreur explicite plutôt qu'une redirection incompréhensible.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname === "/admin/login";

  if (!user && !isLoginPage) {
    const login = request.nextUrl.clone();
    login.pathname = "/admin/login";
    // Mémorise la page demandée : après connexion, on y revient au lieu de
    // renvoyer systématiquement au tableau de bord.
    login.searchParams.set("suite", pathname);
    return NextResponse.redirect(login);
  }

  if (user && isLoginPage) {
    const home = request.nextUrl.clone();
    home.pathname = "/admin";
    home.search = "";
    return NextResponse.redirect(home);
  }

  return response;
}
