import { requireAdmin } from "@/lib/auth";
import { createUserClient } from "@/lib/supabase/server";
import { StaffList } from "@/components/admin/staff-list";
import { CreateStaffForm } from "@/components/admin/create-staff-form";
import type { StaffRole } from "@/types/database";

export const dynamic = "force-dynamic";
export const metadata = { title: "Utilisateurs" };

export default async function StaffPage() {
  const current = await requireAdmin();

  const supabase = await createUserClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, is_active, created_at")
    .order("created_at");

  const members = (data ?? []) as Array<{
    id: string;
    full_name: string;
    email: string;
    role: StaffRole;
    is_active: boolean;
    created_at: string;
  }>;

  return (
    <div className="mx-auto max-w-4xl">
      <header>
        <h1 className="font-display text-2xl">Utilisateurs</h1>
        <p className="mt-1 text-sm text-brown-soft">
          Membres de l&apos;équipe ayant accès au back-office. Vous seul pouvez en créer.
        </p>
      </header>

      <section className="mt-6">
        <StaffList members={members} currentId={current.id} />
      </section>

      <section className="mt-8 border border-ivory-line bg-cream p-6">
        <h2 className="font-display text-lg">Ajouter un membre</h2>
        <p className="mt-1 mb-5 text-xs leading-relaxed text-brown-soft">
          Le compte est actif immédiatement. Communiquez le mot de passe de vive
          voix et demandez à la personne de le changer à sa première connexion.
        </p>
        <CreateStaffForm />
      </section>

      <p className="mt-6 text-xs leading-relaxed text-brown-soft">
        Un compte n&apos;est jamais supprimé : les réservations qu&apos;il a
        traitées et le journal des actions y font référence. La désactivation
        coupe l&apos;accès immédiatement, sans effacer cet historique.
      </p>
    </div>
  );
}
