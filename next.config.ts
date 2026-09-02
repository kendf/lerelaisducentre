import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

/**
 * GARDE-FOU DE DÉPLOIEMENT.
 *
 * Ce projet s'est fait piéger deux fois par le même mécanisme : une dépendance
 * externe manque, et la construction réussit quand même. Une police non
 * téléchargée devient un Times New Roman silencieux ; une variable Supabase
 * absente devient un catalogue vide en ligne. Dans les deux cas, le défaut ne
 * se voit qu'à l'œil, sur le site déjà publié.
 *
 * La cause est structurelle : Next REMPLACE les variables `NEXT_PUBLIC_*` par
 * leur valeur littérale pendant le build. Une variable absente ce jour-là
 * devient le mot `undefined`, gravé dans le bundle. La renseigner ensuite dans
 * l'hébergeur ne corrige pas un déploiement déjà construit — seule une nouvelle
 * construction le peut. Un déploiement peut donc rester cassé indéfiniment
 * alors que la configuration semble correcte dans l'interface.
 *
 * PORTÉE VOLONTAIREMENT ÉTROITE : le contrôle ne s'applique qu'aux
 * constructions de PRODUCTION sur Vercel. Les builds locaux et les
 * préproductions continuent de fonctionner sans base — c'est le choix assumé
 * de la phase de design (voir src/lib/supabase/server.ts), et le casser
 * empêcherait de travailler sur le site vitrine hors connexion.
 */
function assertProductionEnv(): void {
  if (process.env.VERCEL_ENV !== "production") return;

  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    // Non utilisée à la construction, mais indispensable au webhook de
    // paiement. Une réservation payée et jamais confirmée est plus coûteuse
    // qu'un déploiement refusé : autant l'apprendre ici.
    "SUPABASE_SERVICE_ROLE_KEY",
  ];

  // `.trim()` et non une simple présence : une variable DÉCLARÉE MAIS VIDE est
  // le cas réel qui a fait échouer un déploiement de ce projet.
  const missing = required.filter((name) => !process.env[name]?.trim());

  const malformed: string[] = [];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (url) {
    try {
      new URL(url);
    } catch {
      malformed.push("NEXT_PUBLIC_SUPABASE_URL");
    }
  }

  if (missing.length === 0 && malformed.length === 0) return;

  throw new Error(
    [
      "",
      "  Construction de production interrompue : configuration Supabase incomplète.",
      "",
      ...missing.map((n) => `    absente ou vide  : ${n}`),
      ...malformed.map((n) => `    valeur illisible : ${n}`),
      "",
      "  Renseignez ces variables dans Vercel > Settings > Environment Variables",
      "  (portée Production), puis relancez un déploiement. Les modifier sans",
      "  reconstruire ne change rien : leur valeur est figée au moment du build.",
      "",
    ].join("\n")
  );
}

assertProductionEnv();

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    // Les visuels sont déjà déclinés en 480/960/1440 webp à la source : on sert
    // les fichiers tels quels via srcSet plutôt que de payer une optimisation
    // à la volée. Objectif CDC §8 : moins de 3 s sur connexion mobile.
    formats: ["image/webp"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
      {
        // Les images sont immuables : leur nom change si leur contenu change.
        source: "/images/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
