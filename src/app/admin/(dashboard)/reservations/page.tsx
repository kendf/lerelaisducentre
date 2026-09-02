import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { listReservations } from "@/lib/admin/queries";
import { requireStaff, isReceptionist } from "@/lib/auth";
import { ReservationFilters } from "@/components/admin/reservation-filters";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatXof } from "@/lib/utils";
import type { ReservationStatus } from "@/types/database";

export const dynamic = "force-dynamic";
export const metadata = { title: "Réservations" };

const SHORT_DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  timeZone: "Africa/Abidjan",
});

function short(iso: string) {
  return SHORT_DATE.format(new Date(`${iso}T12:00:00Z`));
}

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const str = (key: string) => (typeof sp[key] === "string" ? sp[key] : undefined);

  const { rows, total, page, pageCount } = await listReservations({
    status: (str("statut") as ReservationStatus | "all") ?? "all",
    search: str("q"),
    from: str("du"),
    to: str("au"),
    page: Number(str("p") ?? 1),
  });

  const buildPageHref = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) {
      if (typeof value === "string" && key !== "p") params.set(key, value);
    }
    params.set("p", String(target));
    return `/admin/reservations?${params.toString()}`;
  };

  return (
    <div className="w-full">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Réservations</h1>
          <p className="mt-1 text-sm text-brown-soft">
            {total} réservation{total > 1 ? "s" : ""}
          </p>
        </div>
        {/* La saisie d'un appel est un geste de réception. La garde réelle est
            sur la page cible et dans l'action serveur. */}
        {isReceptionist(staff) ? (
          <Link href="/admin/reservations/nouvelle" className="btn btn-primary">
            <Plus size={15} />
            Nouvelle réservation
          </Link>
        ) : null}
      </header>

      <div className="mt-6">
        <ReservationFilters />
      </div>

      {rows.length === 0 ? (
        <p className="mt-8 border border-dashed border-ivory-line bg-cream p-8 text-center text-sm text-brown-soft">
          Aucune réservation ne correspond à ces critères.
        </p>
      ) : (
        <>
          {/* Tableau sur grand écran, cartes sur mobile : la réception
              consulte aussi depuis une tablette ou un téléphone (CDC §3.1). */}
          <div className="mt-6 hidden overflow-x-auto border border-ivory-line bg-cream lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ivory-line text-left text-xs uppercase tracking-wider text-brown-soft">
                  <th className="px-4 py-3 font-normal">Référence</th>
                  <th className="px-4 py-3 font-normal">Client</th>
                  <th className="px-4 py-3 font-normal">Chambre</th>
                  <th className="px-4 py-3 font-normal">Séjour</th>
                  <th className="px-4 py-3 text-right font-normal">Montant</th>
                  <th className="px-4 py-3 font-normal">Statut</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-ivory-line/60 last:border-0 hover:bg-ivory-deep/40"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/reservations/${r.id}`}
                        className="numeric text-xs text-bronze hover:underline"
                      >
                        {r.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/reservations/${r.id}`} className="hover:text-bronze">
                        {r.guest_last_name.toUpperCase()} {r.guest_first_name}
                      </Link>
                      <span className="block text-xs text-brown-soft">
                        {r.guest_phone}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-brown-soft">
                      {r.room_types?.content.fr.name ?? "—"}
                    </td>
                    <td className="numeric px-4 py-3 whitespace-nowrap">
                      {short(r.check_in)} → {short(r.check_out)}
                      <span className="block text-xs text-brown-soft">
                        {r.nights} nuit{r.nights > 1 ? "s" : ""} ·{" "}
                        {r.adults + r.children} pers.
                      </span>
                    </td>
                    <td className="numeric px-4 py-3 text-right whitespace-nowrap">
                      {formatXof(r.total_amount_xof)}
                      {r.amount_paid_xof > 0 ? (
                        <span className="block text-xs text-brown-soft">
                          {formatXof(r.amount_paid_xof)} réglés
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mt-6 space-y-3 lg:hidden">
            {rows.map((r) => (
              <li key={r.id} className="border border-ivory-line bg-cream p-4">
                <Link href={`/admin/reservations/${r.id}`} className="block">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm">
                        {r.guest_last_name.toUpperCase()} {r.guest_first_name}
                      </p>
                      <p className="numeric text-xs text-bronze">{r.reference}</p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="mt-2.5 text-xs text-brown-soft">
                    {r.room_types?.content.fr.name} · {short(r.check_in)} →{" "}
                    {short(r.check_out)} · {formatXof(r.total_amount_xof)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          {pageCount > 1 ? (
            <nav
              className="mt-6 flex items-center justify-between text-sm"
              aria-label="Pagination"
            >
              {page > 1 ? (
                <Link
                  href={buildPageHref(page - 1)}
                  className="inline-flex items-center gap-1.5 text-brown-soft hover:text-bronze"
                >
                  <ChevronLeft size={15} />
                  Précédent
                </Link>
              ) : (
                <span />
              )}
              <span className="text-xs text-brown-soft">
                Page {page} sur {pageCount}
              </span>
              {page < pageCount ? (
                <Link
                  href={buildPageHref(page + 1)}
                  className="inline-flex items-center gap-1.5 text-brown-soft hover:text-bronze"
                >
                  Suivant
                  <ChevronRight size={15} />
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
