import Link from "next/link";
import { ArrowRight, LogIn, LogOut } from "lucide-react";

import { getDashboardData } from "@/lib/admin/queries";
import { StatTile } from "@/components/admin/stat-tile";
import { StatusBadge } from "@/components/admin/status-badge";
import { OccupancyChart } from "@/components/admin/occupancy-chart";
import { CategoryBars } from "@/components/admin/category-bars";
import { formatXof } from "@/lib/utils";

// Le tableau de bord reflète l'état courant des réservations : aucun cache.
export const dynamic = "force-dynamic";

export const metadata = { title: "Tableau de bord" };

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Africa/Abidjan",
  }).format(new Date(`${iso}T12:00:00Z`));
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="w-full">
      <header>
        <h1 className="font-display text-2xl">Tableau de bord</h1>
        <p className="mt-1 text-sm text-brown-soft first-letter:uppercase">
          {formatDate(data.today)}
        </p>
      </header>

      {/* Le taux d'occupation est mis en avant : c'est le seul chiffre qui
          résume l'activité d'un hôtel en un coup d'œil (CDC §3.3). */}
      <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Occupation · 30 jours"
          value={`${data.occupancyRate} %`}
          hint={`${data.soldNights} nuitées vendues sur ${data.capacityNights}`}
          emphasis
        />
        <StatTile
          label="Réservations à venir"
          value={String(data.upcomingReservations)}
          hint={
            data.pendingCount > 0
              ? `dont ${data.pendingCount} en attente`
              : "aucune en attente"
          }
        />
        <StatTile
          label="Arrivées aujourd'hui"
          value={String(data.arrivalsToday.length)}
          hint={`${data.departuresToday} départ${data.departuresToday > 1 ? "s" : ""}`}
        />
        <StatTile
          label="Chiffre d'affaires · 30 jours"
          value={formatXof(data.revenueXof)}
          hint="séjours confirmés, acompte et solde"
        />
      </section>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="border border-ivory-line bg-cream p-6">
          <h2 className="font-display text-lg">Occupation par semaine</h2>
          <p className="mt-1 mb-6 text-xs text-brown-soft">
            Huit semaines écoulées et quatre à venir
          </p>
          <OccupancyChart buckets={data.series} today={data.today} />
        </section>

        <section className="border border-ivory-line bg-cream p-6">
          <h2 className="font-display text-lg">Par catégorie</h2>
          <p className="mt-1 mb-6 text-xs text-brown-soft">
            Nuitées vendues sur les 30 prochains jours
          </p>
          <CategoryBars rows={data.byRoomType} />
        </section>
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <section className="border border-ivory-line bg-cream p-6">
          <h2 className="flex items-center gap-2 font-display text-lg">
            <LogIn size={17} className="text-bronze" />
            Arrivées du jour
          </h2>

          {data.arrivalsToday.length === 0 ? (
            <p className="mt-5 text-sm text-brown-soft">
              Aucune arrivée prévue aujourd&apos;hui.
            </p>
          ) : (
            <ul className="mt-5 divide-y divide-ivory-line">
              {data.arrivalsToday.map((r) => (
                <li key={r.id} className="py-3">
                  <Link
                    href={`/admin/reservations/${r.id}`}
                    className="flex items-center justify-between gap-4 hover:text-bronze"
                  >
                    <span>
                      <span className="text-sm">
                        {r.guest_first_name} {r.guest_last_name}
                      </span>
                      <span className="mt-0.5 block text-xs text-brown-soft">
                        {r.room_types?.content.fr.name} ·{" "}
                        {r.nights} nuit{r.nights > 1 ? "s" : ""} ·{" "}
                        {r.guest_phone}
                      </span>
                    </span>
                    <StatusBadge status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border border-ivory-line bg-cream p-6">
          <h2 className="flex items-center gap-2 font-display text-lg">
            <LogOut size={17} className="text-bronze" />
            Prochaines arrivées
          </h2>
          <p className="mt-1 text-xs text-brown-soft">Sept prochains jours</p>

          {data.nextArrivals.length === 0 ? (
            <p className="mt-5 text-sm text-brown-soft">
              Aucune arrivée dans les sept prochains jours.
            </p>
          ) : (
            <ul className="mt-5 divide-y divide-ivory-line">
              {data.nextArrivals.map((r) => (
                <li key={r.id} className="py-3">
                  <Link
                    href={`/admin/reservations/${r.id}`}
                    className="flex items-center justify-between gap-4 hover:text-bronze"
                  >
                    <span>
                      <span className="text-sm">
                        {r.guest_first_name} {r.guest_last_name}
                      </span>
                      <span className="mt-0.5 block text-xs text-brown-soft">
                        {new Intl.DateTimeFormat("fr-FR", {
                          day: "numeric",
                          month: "short",
                          timeZone: "Africa/Abidjan",
                        }).format(new Date(`${r.check_in}T12:00:00Z`))}{" "}
                        · {r.room_types?.content.fr.name}
                      </span>
                    </span>
                    <StatusBadge status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <Link
            href="/admin/reservations"
            className="mt-5 inline-flex items-center gap-2 text-xs uppercase tracking-wider text-bronze hover:text-bronze-dark"
          >
            Toutes les réservations
            <ArrowRight size={14} />
          </Link>
        </section>
      </div>
    </div>
  );
}
