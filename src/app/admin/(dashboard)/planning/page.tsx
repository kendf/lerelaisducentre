import { getPlanning } from "@/lib/admin/queries";
import { BlockDatesForm } from "@/components/admin/block-dates-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Planning" };

const DAY = new Intl.DateTimeFormat("fr-FR", {
  weekday: "narrow",
  timeZone: "Africa/Abidjan",
});
const NUM = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  timeZone: "Africa/Abidjan",
});
const MONTH = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  timeZone: "Africa/Abidjan",
});

export default async function PlanningPage() {
  const { rows, from } = await getPlanning(30);

  const nights = rows[0]?.nights ?? [];

  // Regroupement par mois pour l'en-tête : trente colonnes numérotées sans
  // repère de mois seraient illisibles à cheval sur deux mois.
  const months: Array<{ label: string; span: number }> = [];
  for (const night of nights) {
    const label = MONTH.format(new Date(`${night.night}T12:00:00Z`));
    const last = months[months.length - 1];
    if (last && last.label === label) last.span += 1;
    else months.push({ label, span: 1 });
  }

  return (
    <div className="w-full">
      <header>
        <h1 className="font-display text-2xl">Planning des disponibilités</h1>
        <p className="mt-1 text-sm text-brown-soft">
          Trente prochains jours, à partir du{" "}
          {new Intl.DateTimeFormat("fr-FR", {
            day: "numeric",
            month: "long",
            timeZone: "Africa/Abidjan",
          }).format(new Date(`${from}T12:00:00Z`))}
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="mt-8 border border-dashed border-ivory-line bg-cream p-8 text-center text-sm text-brown-soft">
          Aucune catégorie publiée.
        </p>
      ) : (
        <section className="mt-6 overflow-x-auto border border-ivory-line bg-cream">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-cream px-4 py-2 text-left font-normal text-brown-soft">
                  Catégorie
                </th>
                {months.map((m) => (
                  <th
                    key={m.label}
                    colSpan={m.span}
                    className="border-l border-ivory-line px-2 py-2 text-left font-normal text-brown-soft first-letter:uppercase"
                  >
                    {m.label}
                  </th>
                ))}
              </tr>
              <tr className="border-b border-ivory-line">
                <th className="sticky left-0 z-10 bg-cream px-4 py-1" />
                {nights.map((n) => {
                  const date = new Date(`${n.night}T12:00:00Z`);
                  const weekday = DAY.format(date);
                  const isWeekend = [0, 6].includes(date.getUTCDay());
                  return (
                    <th
                      key={n.night}
                      className={`px-1 py-1 text-center font-normal ${
                        isWeekend ? "text-bronze" : "text-brown-soft"
                      }`}
                    >
                      <span className="block">{weekday}</span>
                      <span className="block">{NUM.format(date)}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.room_type_id} className="border-b border-ivory-line/60 last:border-0">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-cream px-4 py-2.5 text-left font-normal whitespace-nowrap"
                  >
                    {row.name}
                    <span className="block text-[10px] text-brown-soft">
                      {row.total_units} chambres
                    </span>
                  </th>
                  {row.nights.map((n) => {
                    const full = n.units_free <= 0;
                    return (
                      <td
                        key={n.night}
                        // Le nombre est TOUJOURS écrit : la couleur n'est
                        // qu'un renfort, jamais le seul porteur d'information.
                        className={`px-1 py-2.5 text-center tabular-nums ${
                          n.is_closed
                            ? "bg-brown/10 text-brown-soft"
                            : full
                              ? "bg-danger/10 font-medium text-danger"
                              : n.units_free <= 2
                                ? "text-warning"
                                : "text-brown-soft"
                        }`}
                        title={`${n.night} — ${n.units_free} libre(s) sur ${n.units_open}${n.is_closed ? " · fermé à la vente" : ""}`}
                      >
                        {n.is_closed ? "×" : n.units_free}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <p className="mt-3 text-xs text-brown-soft">
        Chaque case indique le nombre de chambres encore vendables ce soir-là.
        <span className="ml-2 text-danger">0</span> = complet ·
        <span className="ml-2">×</span> = fermé à la vente.
      </p>

      <section className="mt-8 border border-ivory-line bg-cream p-6">
        <h2 className="font-display text-lg">Fermer ou ajuster des dates</h2>
        <p className="mt-1 mb-5 text-xs leading-relaxed text-brown-soft">
          Pour des travaux, un événement privé ou des chambres immobilisées. Les
          réservations déjà enregistrées ne sont pas affectées : seule la vente
          en ligne est bloquée.
        </p>
        <BlockDatesForm
          roomTypes={rows.map((r) => ({
            id: r.room_type_id,
            name: r.name,
            totalUnits: r.total_units,
          }))}
        />
      </section>
    </div>
  );
}
