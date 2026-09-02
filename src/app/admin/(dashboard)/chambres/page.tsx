import Link from "next/link";
import { EyeOff, Plus } from "lucide-react";

import { requireManager } from "@/lib/auth";
import { createUserClient } from "@/lib/supabase/server";
import { formatXof } from "@/lib/utils";
import type { RoomTypeContent } from "@/types/database";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chambres & tarifs" };

export default async function RoomTypesPage() {
  // Garde d'affichage. L'écriture est protégée indépendamment par la policy
  // RLS `room_types_write_manager` : si cette ligne disparaissait, la base
  // refuserait quand même.
  await requireManager();

  const supabase = await createUserClient();
  const { data } = await supabase
    .from("room_types")
    .select(
      "id, slug, content, base_price_xof, total_units, is_published, max_adults, max_children, surface_m2, amenities"
    )
    .order("sort_order");

  const rows = (data ?? []) as Array<{
    id: string;
    slug: string;
    content: RoomTypeContent;
    base_price_xof: number;
    total_units: number;
    is_published: boolean;
    max_adults: number;
    max_children: number;
    surface_m2: number | null;
    amenities: string[];
  }>;

  return (
    <div className="mx-auto max-w-4xl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl">Chambres &amp; tarifs</h1>
          <p className="mt-1 text-sm text-brown-soft">
            Catégories proposées à la réservation en ligne
          </p>
        </div>
        <Link href="/admin/chambres/nouvelle" className="btn btn-primary">
          <Plus size={15} />
          Nouvelle catégorie
        </Link>
      </header>

      <p className="mt-6 border border-ivory-line bg-cream p-4 text-xs leading-relaxed text-brown-soft">
        Un changement de tarif ne s&apos;applique qu&apos;aux réservations
        futures. Les séjours déjà enregistrés conservent le prix annoncé au
        client au moment de sa réservation.
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 border border-dashed border-ivory-line bg-cream p-8 text-center text-sm text-brown-soft">
          Aucune catégorie pour l&apos;instant. Créez la première pour ouvrir la
          réservation en ligne.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-ivory-line border border-ivory-line bg-cream">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={`/admin/chambres/${row.id}`}
                className="flex flex-wrap items-center justify-between gap-4 p-5 transition-colors hover:bg-ivory-deep/40"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2">
                    {row.content.fr.name}
                    {!row.is_published ? (
                      <span className="inline-flex items-center gap-1 text-xs text-brown-soft">
                        <EyeOff size={13} />
                        hors ligne
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-brown-soft">
                    {row.max_adults} adulte{row.max_adults > 1 ? "s" : ""}
                    {row.max_children > 0
                      ? ` + ${row.max_children} enfant${row.max_children > 1 ? "s" : ""}`
                      : ""}
                    {row.surface_m2 ? ` · ${row.surface_m2} m²` : ""} ·{" "}
                    {row.amenities.length} équipement
                    {row.amenities.length > 1 ? "s" : ""}
                  </p>
                </div>

                <div className="text-right">
                  <p className="numeric text-sm font-medium text-bronze">
                    {formatXof(row.base_price_xof)}
                  </p>
                  <p className="numeric text-xs text-brown-soft">
                    {row.total_units} chambre{row.total_units > 1 ? "s" : ""}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
