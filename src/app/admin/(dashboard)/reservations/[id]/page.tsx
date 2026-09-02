import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, MessageCircle, Phone } from "lucide-react";

import { getReservation } from "@/lib/admin/queries";
import { StatusBadge } from "@/components/admin/status-badge";
import { ReservationActions } from "@/components/admin/reservation-actions";
import { formatXof } from "@/lib/utils";

export const dynamic = "force-dynamic";

const LONG = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Africa/Abidjan",
});

const STAMP = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Abidjan",
});

const PAYMENT_STATUS: Record<string, string> = {
  initiated: "Guichet ouvert",
  pending: "En cours",
  succeeded: "Encaissé",
  failed: "Échoué",
  cancelled: "Abandonné",
  refunded: "Remboursé",
};

const NOTIFICATION_STATUS: Record<string, string> = {
  queued: "En attente",
  sent: "Envoyée",
  delivered: "Reçue",
  failed: "Échec",
};

export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { reservation, payments, notifications } = await getReservation(id);

  if (!reservation) notFound();

  const breakdown = (reservation as unknown as {
    price_breakdown: Array<{ night: string; price_xof: number }> | null;
  }).price_breakdown;

  const balance = reservation.total_amount_xof - reservation.amount_paid_xof;
  const phoneDigits = reservation.guest_phone.replace(/[^0-9]/g, "");

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/admin/reservations"
        className="inline-flex items-center gap-2 text-sm text-brown-soft transition-colors hover:text-bronze"
      >
        <ArrowLeft size={15} />
        Toutes les réservations
      </Link>

      <header className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl">
            {reservation.guest_last_name.toUpperCase()}{" "}
            {reservation.guest_first_name}
          </h1>
          <p className="numeric mt-1 text-sm text-bronze">
            {reservation.reference}
          </p>
        </div>
        <StatusBadge status={reservation.status} />
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="border border-ivory-line bg-cream p-6">
            <h2 className="font-display text-lg">Séjour</h2>
            <dl className="mt-4 grid gap-x-8 gap-y-3.5 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wider text-brown-soft">
                  Arrivée
                </dt>
                <dd className="mt-1 first-letter:uppercase">
                  {LONG.format(new Date(`${reservation.check_in}T12:00:00Z`))}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-brown-soft">
                  Départ
                </dt>
                <dd className="mt-1 first-letter:uppercase">
                  {LONG.format(new Date(`${reservation.check_out}T12:00:00Z`))}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-brown-soft">
                  Chambre
                </dt>
                <dd className="mt-1">
                  {reservation.room_types?.content.fr.name ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-brown-soft">
                  Voyageurs
                </dt>
                <dd className="mt-1">
                  {reservation.adults} adulte{reservation.adults > 1 ? "s" : ""}
                  {reservation.children > 0
                    ? ` · ${reservation.children} enfant${reservation.children > 1 ? "s" : ""}`
                    : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-brown-soft">
                  Durée
                </dt>
                <dd className="mt-1">
                  {reservation.nights} nuit{reservation.nights > 1 ? "s" : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-brown-soft">
                  Origine
                </dt>
                <dd className="mt-1">
                  {reservation.source === "web"
                    ? "Site internet"
                    : reservation.source === "phone"
                      ? "Téléphone"
                      : reservation.source === "desk"
                        ? "Réception"
                        : reservation.source}
                </dd>
              </div>
            </dl>

            {reservation.guest_notes ? (
              <div className="mt-5 border-t border-ivory-line pt-4">
                <p className="text-xs uppercase tracking-wider text-brown-soft">
                  Demande particulière
                </p>
                <p className="mt-1.5 text-sm">{reservation.guest_notes}</p>
              </div>
            ) : null}
          </section>

          <section className="border border-ivory-line bg-cream p-6">
            <h2 className="font-display text-lg">Montants</h2>
            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-brown-soft">Total du séjour</dt>
                <dd>{formatXof(reservation.total_amount_xof)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-brown-soft">Acompte demandé</dt>
                <dd>{formatXof(reservation.deposit_amount_xof)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-brown-soft">Déjà réglé</dt>
                <dd className="text-success">
                  {formatXof(reservation.amount_paid_xof)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-ivory-line pt-2.5">
                <dt>Reste à percevoir à l&apos;arrivée</dt>
                <dd className="numeric text-lg font-medium text-bronze">
                  {formatXof(balance)}
                </dd>
              </div>
            </dl>

            {breakdown && breakdown.length > 0 ? (
              <details className="mt-5 border-t border-ivory-line pt-4">
                <summary className="cursor-pointer text-xs text-brown-soft hover:text-bronze">
                  Détail nuit par nuit
                </summary>
                {/* Tarif figé au moment de la réservation : il reste opposable
                    même si le tarif de base a changé depuis. */}
                <ul className="mt-3 space-y-1 text-xs">
                  {breakdown.map((line) => (
                    <li key={line.night} className="flex justify-between gap-4">
                      <span className="text-brown-soft">
                        {new Intl.DateTimeFormat("fr-FR", {
                          day: "2-digit",
                          month: "long",
                          timeZone: "Africa/Abidjan",
                        }).format(new Date(`${line.night}T12:00:00Z`))}
                      </span>
                      <span>{formatXof(line.price_xof)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </section>

          <section className="border border-ivory-line bg-cream p-6">
            <h2 className="font-display text-lg">Paiements</h2>
            {payments.length === 0 ? (
              <p className="mt-4 text-sm text-brown-soft">
                Aucune opération enregistrée.
              </p>
            ) : (
              <ul className="mt-4 space-y-3 text-sm">
                {payments.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-baseline justify-between gap-3 border-b border-ivory-line/60 pb-3 last:border-0 last:pb-0"
                  >
                    <span>
                      {PAYMENT_STATUS[p.status] ?? p.status}
                      <span className="ml-2 text-xs text-brown-soft">
                        {p.provider}
                        {p.method ? ` · ${p.method}` : ""}
                      </span>
                      {p.failure_reason ? (
                        <span className="mt-0.5 block text-xs text-danger">
                          {p.failure_reason}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-right">
                      {formatXof(p.amount_xof)}
                      <span className="block text-xs text-brown-soft">
                        {STAMP.format(new Date(p.created_at))}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="border border-ivory-line bg-cream p-6">
            <h2 className="font-display text-lg">Notifications</h2>
            <p className="mt-1 text-xs text-brown-soft">
              Trace des confirmations envoyées au client et à l&apos;hôtel
              (critère de recette §13).
            </p>
            {notifications.length === 0 ? (
              <p className="mt-4 text-sm text-brown-soft">
                Aucune notification enregistrée.
              </p>
            ) : (
              <ul className="mt-4 space-y-2 text-sm">
                {notifications.map((n) => (
                  <li key={n.id} className="flex flex-wrap justify-between gap-3">
                    <span>
                      {n.channel === "email"
                        ? "E-mail"
                        : n.channel === "whatsapp"
                          ? "WhatsApp"
                          : "SMS"}
                      <span className="ml-2 text-xs text-brown-soft">
                        {n.recipient}
                      </span>
                    </span>
                    <span
                      className={
                        n.status === "failed" ? "text-danger" : "text-brown-soft"
                      }
                    >
                      {NOTIFICATION_STATUS[n.status] ?? n.status}
                      {n.error ? ` — ${n.error}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="border border-ivory-line bg-cream p-6">
            <h2 className="font-display text-lg">Client</h2>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-start gap-2.5">
                <Phone size={15} className="mt-0.5 shrink-0 text-bronze" />
                <a href={`tel:${phoneDigits}`} className="hover:text-bronze">
                  {reservation.guest_phone}
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <MessageCircle size={15} className="mt-0.5 shrink-0 text-bronze" />
                <a
                  href={`https://wa.me/${phoneDigits}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-bronze"
                >
                  Écrire sur WhatsApp
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <Mail size={15} className="mt-0.5 shrink-0 text-bronze" />
                <a
                  href={`mailto:${reservation.guest_email}`}
                  className="break-all hover:text-bronze"
                >
                  {reservation.guest_email}
                </a>
              </li>
            </ul>
            {reservation.guest_country ? (
              <p className="mt-4 border-t border-ivory-line pt-3 text-xs text-brown-soft">
                Réside en {reservation.guest_country} · Répond en{" "}
                {reservation.locale === "en" ? "anglais" : "français"}
              </p>
            ) : null}
          </section>

          <ReservationActions
            id={reservation.id}
            version={reservation.version}
            status={reservation.status}
          />

          <p className="text-xs leading-relaxed text-brown-soft">
            Créée le {STAMP.format(new Date(reservation.created_at))}
            {reservation.confirmed_at
              ? ` · confirmée le ${STAMP.format(new Date(reservation.confirmed_at))}`
              : ""}
            {reservation.cancelled_at
              ? ` · annulée le ${STAMP.format(new Date(reservation.cancelled_at))}`
              : ""}
            {reservation.cancellation_reason
              ? ` — ${reservation.cancellation_reason}`
              : ""}
          </p>
        </aside>
      </div>
    </div>
  );
}
