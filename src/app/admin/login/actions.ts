"use server";

import { redirect } from "next/navigation";
import { createUserClient, isSupabaseConfigured } from "@/lib/supabase/server";

export interface LoginState {
  status: "idle" | "error";
  message?: string;
}

/**
 * Connexion au back-office (CDC §3.3, accès multi-utilisateurs sécurisé).
 *
 * Le message d'erreur reste volontairement identique que l'adresse existe ou
 * non : distinguer les deux cas permettrait d'énumérer les comptes du
 * personnel de l'hôtel.
 */
export async function signIn(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const suite = String(formData.get("suite") ?? "/admin");

  if (!email || !password) {
    return { status: "error", message: "Renseignez votre adresse et votre mot de passe." };
  }

  if (!isSupabaseConfigured()) {
    return { status: "error", message: "Connexion à la base indisponible." };
  }

  const supabase = await createUserClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { status: "error", message: "Identifiants incorrects." };
  }

  // On ne redirige que vers une route interne : sans ce contrôle, un lien
  // /admin/login?suite=https://site-malveillant.example renverrait un membre du
  // personnel vers une fausse page de connexion après authentification.
  const target = suite.startsWith("/admin") ? suite : "/admin";
  redirect(target);
}

export async function signOut(): Promise<void> {
  const supabase = await createUserClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
