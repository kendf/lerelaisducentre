import { AlertTriangle, Ban, CheckCircle2, Clock, UserX } from "lucide-react";
import type { ReservationStatus } from "@/types/database";

/**
 * Statut d'une réservation.
 *
 * Le CDC §3.3 n'expose que trois libellés (en attente / confirmée / annulée) :
 * les sept états techniques y sont ramenés. « Expirée » est présentée comme
 * annulée — pour la réception, une chambre relâchée est une réservation qui
 * n'existe plus, la nuance interne ne lui sert à rien.
 *
 * Jamais de couleur seule : chaque statut porte une icône ET un mot. Un tableau
 * de réservations lu en diagonale ne doit pas dépendre de la perception des
 * couleurs.
 */
const MAP: Record<
  ReservationStatus,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  confirmed: { label: "Confirmée", icon: CheckCircle2, className: "text-success" },
  completed: { label: "Terminée", icon: CheckCircle2, className: "text-brown-soft" },
  pending: { label: "En attente", icon: Clock, className: "text-warning" },
  pending_payment: { label: "En attente", icon: Clock, className: "text-warning" },
  cancelled: { label: "Annulée", icon: Ban, className: "text-danger" },
  expired: { label: "Annulée", icon: AlertTriangle, className: "text-danger" },
  no_show: { label: "Non présenté", icon: UserX, className: "text-danger" },
};

export function StatusBadge({ status }: { status: ReservationStatus }) {
  const entry = MAP[status];
  const Icon = entry.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${entry.className}`}>
      <Icon size={14} className="shrink-0" />
      {entry.label}
    </span>
  );
}
