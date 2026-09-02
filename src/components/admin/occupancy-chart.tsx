"use client";

import { useState } from "react";
import type { OccupancyBucket } from "@/lib/admin/queries";

/**
 * Occupation hebdomadaire — CDC §3.3, « évolution dans le temps ».
 *
 * CHOIX DE FORME : des barres, pas une courbe. Chaque semaine est une quantité
 * mesurée et indépendante, pas un signal continu — une ligne suggérerait une
 * interpolation entre deux mardis qui n'existe pas.
 *
 * CHOIX DE COULEUR : une seule série, donc une seule teinte et aucune légende.
 * J'ai vérifié le bronze et le vert palmier de la charte comme paire de séries :
 * ΔE 3,9 en protanopie et 10,7 en vision normale — sous le plancher de 15. Ces
 * deux couleurs sont indissociables pour une part des lecteurs. Le passé et
 * l'avenir sont donc séparés par un repère daté, jamais par la couleur.
 *
 * Construit en HTML plutôt qu'avec une bibliothèque de graphiques : douze barres
 * ne justifient pas 100 ko de JavaScript sur un écran que la réception ouvre
 * toute la journée.
 */
export function OccupancyChart({
  buckets,
  today,
}: {
  buckets: OccupancyBucket[];
  today: string;
}) {
  const [active, setActive] = useState<number | null>(null);

  if (buckets.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-brown-soft">
        Pas encore de données sur cette période.
      </p>
    );
  }

  const rates = buckets.map((b) =>
    b.capacity > 0 ? (b.nights_sold / b.capacity) * 100 : 0
  );
  const peak = Math.max(...rates, 1);
  // Échelle arrondie à la dizaine supérieure : l'axe reste lisible et la barre
  // la plus haute ne touche jamais le plafond du cadre.
  const scale = Math.min(100, Math.ceil(peak / 10) * 10 + 10);

  const firstFutureIndex = buckets.findIndex((b) => b.bucket_end > today);

  const fmtDay = (iso: string) =>
    new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "short",
      timeZone: "Africa/Abidjan",
    }).format(new Date(`${iso}T12:00:00Z`));

  return (
    <figure className="m-0">
      <div className="relative">
        {/* Grille très discrète : elle aide à lire, elle ne doit pas se voir. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          {[100, 75, 50, 25, 0].map((step) => (
            <div key={step} className="flex items-center gap-2">
              <span className="numeric w-8 shrink-0 text-right text-[10px] text-brown-soft/70">
                {Math.round((scale * step) / 100)}%
              </span>
              <span className="h-px flex-1 bg-ivory-line/70" />
            </div>
          ))}
        </div>

        <div className="relative ml-10 flex h-48 items-end gap-[2px]">
          {buckets.map((bucket, i) => {
            const rate = rates[i] ?? 0;
            const height = Math.max((rate / scale) * 100, rate > 0 ? 1.5 : 0);
            const isFuture = i >= firstFutureIndex && firstFutureIndex !== -1;

            return (
              <div
                key={bucket.bucket_start}
                className="group relative flex h-full flex-1 items-end"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                tabIndex={0}
                role="img"
                aria-label={`Semaine du ${fmtDay(bucket.bucket_start)} : ${Math.round(rate)} % d'occupation, ${bucket.nights_sold} nuitées, ${bucket.reservations} arrivées`}
              >
                <div
                  className="w-full rounded-t-[4px] bg-bronze transition-opacity"
                  style={{
                    height: `${height}%`,
                    opacity: active === null || active === i ? 1 : 0.45,
                  }}
                />
                {/* Repère de la semaine en cours : un trait daté sépare le
                    constaté du prévisionnel, sans recourir à une seconde
                    couleur que tout le monde ne distinguerait pas. */}
                {isFuture && i === firstFutureIndex ? (
                  <span
                    className="pointer-events-none absolute -top-1 bottom-0 -left-px w-px bg-brown/40"
                    aria-hidden
                  />
                ) : null}
              </div>
            );
          })}
        </div>

        {active !== null && buckets[active] ? (
          <div
            className="pointer-events-none absolute top-0 right-0 border border-ivory-line bg-cream px-3 py-2 text-xs shadow-sm"
            role="status"
          >
            <p className="font-medium text-brown">
              Semaine du {fmtDay(buckets[active].bucket_start)}
            </p>
            <p className="mt-1 text-brown-soft">
              {Math.round(rates[active] ?? 0)} % d&apos;occupation
            </p>
            <p className="text-brown-soft">
              {buckets[active].nights_sold} nuitées ·{" "}
              {buckets[active].reservations} arrivée
              {buckets[active].reservations > 1 ? "s" : ""}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-2 ml-10 flex gap-[2px]">
        {buckets.map((bucket, i) => (
          <span
            key={bucket.bucket_start}
            className="flex-1 text-center text-[10px] text-brown-soft"
          >
            {/* Une étiquette sur trois : douze dates collées seraient illisibles. */}
            {i % 3 === 0 ? fmtDay(bucket.bucket_start) : ""}
          </span>
        ))}
      </div>

      {firstFutureIndex > 0 ? (
        <p className="mt-3 ml-10 text-[11px] text-brown-soft">
          Le trait vertical marque la semaine en cours : à sa droite, les
          réservations déjà enregistrées pour les semaines à venir.
        </p>
      ) : null}

      {/* Repli tabulaire : lisible au lecteur d'écran, et utile pour recopier
          un chiffre exact. */}
      <details className="mt-4 ml-10">
        <summary className="cursor-pointer text-xs text-brown-soft hover:text-bronze">
          Voir les chiffres
        </summary>
        <table className="mt-3 w-full text-xs">
          <thead>
            <tr className="border-b border-ivory-line text-left text-brown-soft">
              <th className="py-1.5 font-normal">Semaine</th>
              <th className="py-1.5 text-right font-normal">Occupation</th>
              <th className="py-1.5 text-right font-normal">Nuitées</th>
              <th className="py-1.5 text-right font-normal">Arrivées</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((bucket, i) => (
              <tr key={bucket.bucket_start} className="border-b border-ivory-line/50">
                <td className="py-1.5">{fmtDay(bucket.bucket_start)}</td>
                <td className="numeric py-1.5 text-right">{Math.round(rates[i] ?? 0)} %</td>
                <td className="numeric py-1.5 text-right">{bucket.nights_sold}</td>
                <td className="numeric py-1.5 text-right">{bucket.reservations}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
