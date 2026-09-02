import type { RoomTypeOccupancy } from "@/lib/admin/queries";

/**
 * Nuitées vendues par catégorie.
 *
 * Barres HORIZONTALES : les libellés sont des noms longs (« Chambre
 * Familiale »), qui se lisent naturellement à l'horizontale sans rotation ni
 * troncature.
 *
 * Une seule teinte pour toutes les barres : la catégorie est déjà portée par
 * son étiquette et par sa position. Attribuer quatre couleurs n'apporterait
 * aucune information et introduirait un risque de confusion pour les lecteurs
 * daltoniens — la charte de l'hôtel ne fournit pas quatre teintes
 * discernables.
 */
export function CategoryBars({ rows }: { rows: RoomTypeOccupancy[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-brown-soft">
        Aucune donnée sur cette période.
      </p>
    );
  }

  const peak = Math.max(...rows.map((r) => Number(r.nights_sold)), 1);

  return (
    <ul className="space-y-4">
      {rows.map((row) => {
        const sold = Number(row.nights_sold);
        const capacity = Number(row.capacity);
        const rate = capacity > 0 ? Math.round((sold / capacity) * 100) : 0;

        return (
          <li key={row.room_type_id}>
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span className="text-brown">{row.content.fr.name}</span>
              {/* Étiquette directe plutôt qu'un axe : quatre valeurs se lisent
                  mieux posées à côté de leur barre. */}
              <span className="numeric shrink-0 text-brown-soft">
                {sold} nuitées · {rate} %
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-[4px] bg-ivory-line/60">
              <div
                className="h-full rounded-[4px] bg-bronze"
                style={{ width: `${Math.max((sold / peak) * 100, sold > 0 ? 2 : 0)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
