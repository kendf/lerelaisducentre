import "server-only";
import { redirect } from "next/navigation";
import { createUserClient } from "@/lib/supabase/server";
import type { StaffRole } from "@/types/database";

export interface StaffMember {
  id: string;
  full_name: string;
  email: string;
  role: StaffRole;
}

/**
 * Récupère le membre de l'équipe connecté, ou null.
 *
 * `getUser()` valide le jeton auprès du serveur d'authentification plutôt que
 * de se fier au cookie. Le profil est ensuite lu en base : c'est lui qui porte
 * le rôle, jamais une donnée venue du client.
 */
export async function getStaffMember(): Promise<StaffMember | null> {
  const supabase = await createUserClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  // Un compte désactivé par le gérant perd l'accès immédiatement, sans
  // attendre l'expiration de sa session.
  if (!data || !data.is_active) return null;

  return {
    id: data.id,
    full_name: data.full_name,
    email: data.email,
    role: data.role as StaffRole,
  };
}

/** Exige une session valide. Redirige vers la connexion sinon. */
export async function requireStaff(): Promise<StaffMember> {
  const staff = await getStaffMember();
  if (!staff) redirect("/admin/login");
  return staff;
}

/**
 * Exige au moins le rôle gérant.
 *
 * Cette garde protège l'AFFICHAGE. Les écritures correspondantes sont, elles,
 * protégées par les policies RLS et par les vérifications internes des
 * fonctions SQL : masquer un bouton n'a jamais protégé une donnée.
 */
export async function requireManager(): Promise<StaffMember> {
  const staff = await requireStaff();
  if (!isManager(staff)) redirect("/admin");
  return staff;
}

/**
 * Exige le rôle administrateur.
 *
 * L'administrateur centralise ce qui touche aux ACCÈS eux-mêmes : création de
 * comptes, changement de rôle, désactivation. Le gérant pilote l'exploitation
 * — tarifs, chambres, réglages commerciaux — mais ne distribue pas les clés.
 * Séparer les deux évite qu'un compte d'exploitation, volé ou prêté, ouvre
 * aussi la porte à la création de nouveaux accès.
 */
export async function requireAdmin(): Promise<StaffMember> {
  const staff = await requireStaff();
  if (!isAdmin(staff)) redirect("/admin");
  return staff;
}

/** Gérance et administration : tout ce qui dépasse la réception. */
export function isManager(staff: StaffMember): boolean {
  return staff.role === "manager" || staff.role === "admin";
}

export function isAdmin(staff: StaffMember): boolean {
  return staff.role === "admin";
}

export function isReceptionist(staff: StaffMember): boolean {
  return staff.role === "receptionist";
}
