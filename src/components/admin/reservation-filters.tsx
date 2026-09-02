"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

const STATUSES = [
  { value: "all", label: "Tous les statuts" },
  { value: "confirmed", label: "Confirmées" },
  { value: "pending", label: "En attente" },
  { value: "pending_payment", label: "Paiement en cours" },
  { value: "cancelled", label: "Annulées" },
  { value: "completed", label: "Terminées" },
  { value: "no_show", label: "Non présentés" },
];

/**
 * Filtres de la liste des réservations.
 *
 * L'état vit dans l'URL : une réceptionniste peut mettre en favori « les
 * arrivées en attente de la semaine », partager le lien avec sa collègue, et
 * le bouton retour du navigateur se comporte comme elle l'attend. Un état
 * gardé en mémoire côté client ne permettrait rien de tout cela.
 */
export function ReservationFilters() {
  const router = useRouter();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    // Tout changement de filtre ramène à la première page : rester en page 4
    // d'un résultat qui n'en compte plus qu'une afficherait un écran vide.
    next.delete("p");
    router.push(`/admin/reservations?${next.toString()}`);
  }

  const hasFilters = ["statut", "q", "du", "au"].some((k) => params.get(k));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        update("q", String(data.get("q") ?? ""));
      }}
      className="grid gap-3 border border-ivory-line bg-cream p-4 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto]"
    >
      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-brown-soft"
        />
        <input
          name="q"
          type="search"
          defaultValue={params.get("q") ?? ""}
          placeholder="Référence, nom ou téléphone"
          className="field pl-9"
        />
      </div>

      <select
        value={params.get("statut") ?? "all"}
        onChange={(e) => update("statut", e.target.value === "all" ? "" : e.target.value)}
        className="field"
        aria-label="Filtrer par statut"
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <input
        type="date"
        value={params.get("du") ?? ""}
        onChange={(e) => update("du", e.target.value)}
        className="field"
        aria-label="Arrivée à partir du"
      />

      <div className="flex gap-2">
        <input
          type="date"
          value={params.get("au") ?? ""}
          onChange={(e) => update("au", e.target.value)}
          className="field"
          aria-label="Arrivée jusqu'au"
        />
        {hasFilters ? (
          <button
            type="button"
            onClick={() => router.push("/admin/reservations")}
            className="shrink-0 px-2 text-brown-soft transition-colors hover:text-bronze"
            aria-label="Effacer les filtres"
            title="Effacer les filtres"
          >
            <X size={16} />
          </button>
        ) : null}
      </div>
    </form>
  );
}
