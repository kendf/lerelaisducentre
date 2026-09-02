import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { updateAdminSession } from "@/lib/supabase/middleware";

const handleI18n = createMiddleware(routing);

/**
 * Deux régimes dans un seul middleware, car Next.js n'en accepte qu'un.
 *
 *  - /admin  : rafraîchissement de la session du personnel et garde d'accès.
 *              Volontairement NON traduit (équipe francophone, CDC §2.2) : pas
 *              de préfixe de langue dans ces URLs.
 *  - le reste : routage bilingue avec chemins traduits.
 */
export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    return updateAdminSession(request);
  }

  return handleI18n(request) as NextResponse;
}

export const config = {
  matcher: [
    "/",
    "/admin/:path*",
    "/(fr|en)/:path*",
    // Exclut les routes d'API, les fichiers internes de Next et les fichiers
    // servis tels quels (images, polices) : le middleware ne doit pas s'exécuter
    // à chaque vignette de la galerie.
    "/((?!api|admin|_next|_vercel|images|.*\..*).*)",
  ],
};
