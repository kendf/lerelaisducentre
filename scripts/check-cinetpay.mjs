#!/usr/bin/env node
/**
 * Contrôle des identifiants CinetPay — sans jamais les afficher.
 *
 *   npm run cinetpay:check
 *
 * POURQUOI CE SCRIPT. Un secret qu'on colle dans une conversation, un ticket ou
 * une capture d'écran ne revient jamais en arrière : il faut le régénérer. Ce
 * projet en a déjà fait l'expérience avec la clé service_role de Supabase.
 *
 * Le script vérifie donc ce qui est vérifiable sans lire la valeur à voix
 * haute : présence, préfixe, longueur, environnement déduit. Il n'affiche que
 * les quatre derniers caractères, assez pour distinguer deux clés l'une de
 * l'autre, pas assez pour en faire quoi que ce soit.
 */

import fs from "node:fs";
import path from "node:path";

const file = path.resolve(process.cwd(), ".env.local");
if (!fs.existsSync(file)) {
  console.error("Fichier .env.local introuvable.");
  process.exit(1);
}

const env = Object.fromEntries(
  fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trimStart().startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

/**
 * Empreinte lisible d'un secret : longueur, fin, et surtout PRÉSENCE DE
 * CARACTÈRES NON ASCII.
 *
 * La longueur et les derniers caractères ne suffisent pas : « bacàsable1 » et
 * « bacasable1 » ont exactement la même empreinte. Sans le contrôle d'encodage,
 * impossible de dire si un mot de passe accentué a bien été remplacé — c'est
 * arrivé sur ce projet.
 */
function fingerprint(value) {
  const exotic = [...value].filter((c) => c.charCodeAt(0) > 127);
  const encodage = exotic.length
    ? ` · ⚠ ${exotic.length} caractère(s) non ASCII : ${exotic
        .map((c) => `${c} (U+${c.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")})`)
        .join(", ")}`
    : " · ASCII pur";
  return `${value.length} caractères, se termine par …${value.slice(-4)}${encodage}`;
}

const checks = [];

// --- Clé API ---------------------------------------------------------------
const key = env.CINETPAY_API_KEY_CI ?? "";
if (!key) {
  checks.push(["CINETPAY_API_KEY_CI", "ABSENTE", "à coller dans .env.local"]);
} else if (key.startsWith("sk_test_")) {
  checks.push([
    "CINETPAY_API_KEY_CI",
    "BAC À SABLE",
    `préfixe sk_test_ · ${fingerprint(key)}`,
  ]);
} else if (key.startsWith("sk_live_")) {
  checks.push([
    "CINETPAY_API_KEY_CI",
    "PRODUCTION",
    `préfixe sk_live_ · ${fingerprint(key)} — attention, argent réel`,
  ]);
} else {
  checks.push([
    "CINETPAY_API_KEY_CI",
    "PRÉFIXE INCONNU",
    `${fingerprint(key)} — ni sk_test_ ni sk_live_, à confirmer avec CinetPay`,
  ]);
}

// --- Mot de passe API ------------------------------------------------------
const password = env.CINETPAY_API_PASSWORD_CI ?? "";
checks.push([
  "CINETPAY_API_PASSWORD_CI",
  password ? "PRÉSENT" : "ABSENT",
  password ? fingerprint(password) : "à coller dans .env.local",
]);

// --- Sélection du prestataire ---------------------------------------------
const provider = env.PAYMENT_PROVIDER ?? "";
checks.push([
  "PAYMENT_PROVIDER",
  provider || "VIDE",
  provider === "mock"
    ? "simulateur — aucun appel à CinetPay"
    : provider === "cinetpay"
      ? "appels réels vers CinetPay"
      : "valeur inattendue",
]);

// --- URL publique du site --------------------------------------------------
// La notify_url doit être joignable depuis l'extérieur : CinetPay envoie un
// ping pour vérifier qu'elle répond. Une adresse locale ne le sera jamais.
const site = env.NEXT_PUBLIC_SITE_URL ?? "";
const local = /localhost|127\.0\.0\.1/.test(site);
checks.push([
  "NEXT_PUBLIC_SITE_URL",
  local ? "LOCALE" : site ? "PUBLIQUE" : "VIDE",
  local
    ? "CinetPay ne pourra PAS appeler le webhook — passer par ngrok ou un déploiement"
    : site || "à renseigner",
]);

const width = Math.max(...checks.map(([name]) => name.length));
console.log("");
for (const [name, status, detail] of checks) {
  console.log(`  ${name.padEnd(width)}  ${status.padEnd(16)} ${detail}`);
}
console.log("");

const blocking = checks.filter(([, status]) =>
  ["ABSENTE", "ABSENT", "PRÉFIXE INCONNU"].includes(status)
);

// Un identifiant machine n'a aucune raison de porter un accent : selon la
// chaîne d'encodage, il peut être transmis différemment de ce que la
// plateforme a enregistré. C'est un avertissement, pas un blocage.
const exotic = checks.filter(([, , detail]) => detail.includes("non ASCII"));
if (exotic.length > 0) {
  console.log(
    `  ⚠ ${exotic.length} identifiant(s) contiennent des caractères accentués.`
  );
  console.log(
    "    À régénérer en ASCII pur : l'encodage est une cause d'échec silencieux.\n"
  );
}

if (blocking.length > 0) {
  console.log(`  ${blocking.length} point(s) à traiter avant tout essai réel.\n`);
  process.exit(1);
}

console.log("  Identifiants exploitables.\n");
