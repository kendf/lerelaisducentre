#!/usr/bin/env node
/**
 * Création d'un compte du back-office.
 *
 *   node scripts/create-staff.mjs <email> <mot de passe> "<nom complet>" [role]
 *
 * role : receptionist (défaut) | manager | admin
 *
 * POURQUOI UN SCRIPT ET PAS DU SQL ?
 * Parce qu'un mot de passe doit être haché par le service d'authentification de
 * Supabase, avec son propre algorithme et son propre sel. Un INSERT direct dans
 * auth.users produirait un compte inutilisable — ou pire, un compte au mot de
 * passe mal protégé.
 *
 * Le profil (nom, rôle) est créé automatiquement par le déclencheur
 * on_auth_user_created, à partir des métadonnées passées ici.
 *
 * Ce script utilise la clé service_role : il ne s'exécute qu'en local, à la
 * main. Après la mise en production, les comptes se créeront depuis l'espace
 * Utilisateurs du back-office.
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const file = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return;

  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const [email, password, fullName, role = "receptionist"] = process.argv.slice(2);

if (!email || !password || !fullName) {
  console.error(
    'Usage : node scripts/create-staff.mjs <email> <mot de passe> "<nom complet>" [receptionist|manager|admin]'
  );
  process.exit(1);
}

if (!["receptionist", "manager", "admin"].includes(role)) {
  console.error(`Rôle inconnu : ${role}`);
  process.exit(1);
}

if (password.length < 8) {
  console.error("Le mot de passe doit faire au moins 8 caractères.");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requises (.env.local)."
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  // Comptes internes créés par l'hôtel : pas de parcours de confirmation par
  // e-mail à faire suivre à une réceptionniste.
  email_confirm: true,
  user_metadata: { full_name: fullName, role },
});

if (error) {
  console.error(`Échec : ${error.message}`);
  process.exit(1);
}

// Le déclencheur crée le profil avec le rôle demandé ; on relit pour confirmer
// plutôt que de le supposer.
const { data: profile } = await supabase
  .from("profiles")
  .select("full_name, email, role")
  .eq("id", data.user.id)
  .maybeSingle();

console.log(`Compte créé : ${profile?.email ?? email}`);
console.log(`  Nom  : ${profile?.full_name ?? fullName}`);
console.log(`  Rôle : ${profile?.role ?? role}`);
console.log(`  Connexion : ${url.replace(/\/$/, "")} → /admin/login`);
