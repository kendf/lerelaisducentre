import { requireStaff, isReceptionist } from "@/lib/auth";
import { AdminNav } from "@/components/admin/admin-nav";

/**
 * Coque du back-office.
 *
 * `requireStaff()` s'exécute ici, donc AVANT le rendu de n'importe quelle page
 * du groupe : aucune donnée n'est lue si la session est absente ou le compte
 * désactivé. Le middleware fait déjà une première barrière, mais il peut être
 * contourné par un appel direct au rendu serveur — la garde doit vivre au plus
 * près des données.
 *
 * La disposition suit le rôle : onglets horizontaux pour la réception
 * (4 entrées), colonne latérale pour la gérance et l'administration. Voir
 * AdminNav.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await requireStaff();
  const horizontal = isReceptionist(staff);

  const nav = (
    <AdminNav
      fullName={staff.full_name}
      role={staff.role}
      sidebar={!horizontal}
    />
  );

  if (horizontal) {
    return (
      <div className="min-h-screen">
        {nav}
        {/* Marges latérales resserrées : sans colonne à gauche, la largeur
            disponible doit servir aux tableaux, pas au vide. */}
        <main className="mx-auto max-w-[1400px] px-4 py-8 lg:px-6 lg:py-9">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:flex">
      {nav}
      <main className="min-w-0 flex-1 px-5 py-8 lg:px-8 lg:py-10">
        <div className="mx-auto w-full max-w-[1400px]">
          {children}
        </div>
      </main>
    </div>
  );
}
