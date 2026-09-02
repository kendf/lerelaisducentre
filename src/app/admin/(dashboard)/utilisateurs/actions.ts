"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient, createUserClient } from "@/lib/supabase/server";
import { getStaffMember, isAdmin } from "@/lib/auth";
import type { StaffRole } from "@/types/database";

export interface StaffState {
  status: "idle" | "error" | "success";
  message?: string;
}

// L'administrateur distribue les trois rôles, y compris le sien : c'est lui
// l'autorité centrale sur les accès. Sans cela, un seul administrateur devenu
// indisponible laisserait l'établissement sans moyen d'en désigner un autre.
const ROLES: StaffRole[] = ["receptionist", "manager", "admin"];

/**
 * Création d'un compte d'équipe (CDC §3.3, back-office multi-utilisateurs).
 *
 * RÉSERVÉ À L'ADMINISTRATEUR. Le gérant pilote l'exploitation — tarifs,
 * chambres, réglages — mais ne distribue pas les accès. Séparer les deux évite
 * qu'un compte d'exploitation, prêté ou compromis, serve à en créer d'autres.
 *
 * POURQUOI LA CLÉ service_role ICI ?
 * Créer un utilisateur passe par l'API d'administration de Supabase Auth : le
 * mot de passe doit être haché par le service d'authentification, avec son
 * propre algorithme et son propre sel. Aucun rôle applicatif ne peut le faire.
 *
 * Le contrôle d'accès est donc à notre charge et se fait AVANT : on vérifie que
 * le demandeur est bien gérant, à partir de sa session — jamais d'un paramètre
 * envoyé par le navigateur. Cette action ne s'exécute que côté serveur, la clé
 * n'atteint jamais le client.
 */
export async function createStaffAccount(
  _prev: StaffState,
  formData: FormData
): Promise<StaffState> {
  const staff = await getStaffMember();
  if (!staff || !isAdmin(staff)) {
    return { status: "error", message: "Réservé à l'administrateur." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "receptionist") as StaffRole;

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { status: "error", message: "Adresse e-mail invalide." };
  }
  if (fullName.length < 3) {
    return { status: "error", message: "Renseignez le nom complet." };
  }
  if (password.length < 10) {
    return {
      status: "error",
      message: "Le mot de passe doit faire au moins 10 caractères.",
    };
  }
  if (!ROLES.includes(role)) {
    return { status: "error", message: "Rôle non autorisé." };
  }

  const admin = createServiceClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });

  if (error) {
    if (/already/i.test(error.message)) {
      return { status: "error", message: "Un compte existe déjà avec cette adresse." };
    }
    return { status: "error", message: "La création du compte a échoué." };
  }

  const supabase = await createUserClient();
  await supabase.from("audit_log").insert({
    actor_id: staff.id,
    actor_label: staff.full_name,
    action: "staff.create",
    entity: "profiles",
    after: { email, full_name: fullName, role },
  });

  revalidatePath("/admin/utilisateurs");
  return {
    status: "success",
    message: `Compte créé pour ${fullName}. Communiquez-lui son mot de passe de vive voix, jamais par e-mail.`,
  };
}

/**
 * Activation ou désactivation d'un compte.
 *
 * On ne supprime jamais un compte : les réservations qu'il a créées ou
 * annulées le référencent, et le journal d'audit doit rester lisible. La
 * désactivation coupe l'accès immédiatement — `getStaffMember()` refuse un
 * profil inactif sans attendre l'expiration de sa session.
 */
export async function setStaffActive(
  _prev: StaffState,
  formData: FormData
): Promise<StaffState> {
  const staff = await getStaffMember();
  if (!staff || !isAdmin(staff)) {
    return { status: "error", message: "Réservé à l'administrateur." };
  }

  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";

  // Se désactiver soi-même fermerait la porte de l'intérieur : plus personne
  // pour rouvrir si c'est le seul gérant.
  if (id === staff.id) {
    return {
      status: "error",
      message: "Vous ne pouvez pas désactiver votre propre compte.",
    };
  }

  const supabase = await createUserClient();
  const { error } = await supabase
    .from("profiles")
    .update({ is_active: active })
    .eq("id", id);

  if (error) {
    return { status: "error", message: "La mise à jour a échoué." };
  }

  await supabase.from("audit_log").insert({
    actor_id: staff.id,
    actor_label: staff.full_name,
    action: active ? "staff.activate" : "staff.deactivate",
    entity: "profiles",
    entity_id: id,
  });

  revalidatePath("/admin/utilisateurs");
  return {
    status: "success",
    message: active ? "Compte réactivé." : "Compte désactivé.",
  };
}

export async function setStaffRole(
  _prev: StaffState,
  formData: FormData
): Promise<StaffState> {
  const staff = await getStaffMember();
  if (!staff || !isAdmin(staff)) {
    return { status: "error", message: "Réservé à l'administrateur." };
  }

  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "") as StaffRole;

  if (!ROLES.includes(role)) {
    return { status: "error", message: "Rôle non autorisé." };
  }
  if (id === staff.id) {
    return {
      status: "error",
      message: "Vous ne pouvez pas modifier votre propre rôle.",
    };
  }

  const supabase = await createUserClient();
  // Le déclencheur `tg_guard_role_change` vérifie de son côté que l'auteur du
  // changement est bien gérant : la protection ne dépend pas de cette action.
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", id);

  if (error) {
    return { status: "error", message: "Le changement de rôle a échoué." };
  }

  await supabase.from("audit_log").insert({
    actor_id: staff.id,
    actor_label: staff.full_name,
    action: "staff.role",
    entity: "profiles",
    entity_id: id,
    after: { role },
  });

  revalidatePath("/admin/utilisateurs");
  return { status: "success", message: "Rôle mis à jour." };
}
