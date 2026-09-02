"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";
import {
  createDeskReservation,
  type DeskReservationState,
} from "@/app/admin/(dashboard)/reservations/nouvelle/actions";
import { addDaysIso, formatXof, hotelToday, nightsBetween } from "@/lib/utils";

const INITIAL: DeskReservationState = { status: "idle" };

export interface DeskRoomType {
  id: string;
  name: string;
  basePriceXof: number;
  maxAdults: number;
  maxChildren: number;
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? "Enregistrement…" : "Enregistrer la réservation"}
    </button>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wider text-brown-soft">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="mt-1 block text-xs leading-relaxed text-brown-soft">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

/**
 * Saisie d'une réservation reçue au téléphone ou au comptoir.
 *
 * L'estimation de prix affichée ici est INDICATIVE : elle aide la
 * réceptionniste à annoncer un montant au client pendant l'appel. Le montant
 * qui fait foi est recalculé par la base au moment de l'enregistrement, à
 * partir des tarifs et des éventuelles surcharges du calendrier. Les deux
 * coïncident dans le cas courant ; en cas d'écart, c'est la base qui a raison.
 */
export function DeskReservationForm({
  roomTypes,
}: {
  roomTypes: DeskRoomType[];
}) {
  const [state, formAction] = useActionState(createDeskReservation, INITIAL);
  const today = hotelToday();

  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(addDaysIso(today, 1));
  const [roomTypeId, setRoomTypeId] = useState(roomTypes[0]?.id ?? "");
  const [confirmed, setConfirmed] = useState(false);

  const room = roomTypes.find((r) => r.id === roomTypeId);
  const nights = Math.max(0, nightsBetween(checkIn, checkOut));
  const estimate = room ? room.basePriceXof * nights : 0;

  function onCheckInChange(value: string) {
    setCheckIn(value);
    if (checkOut <= value) setCheckOut(addDaysIso(value, 1));
  }

  return (
    <form action={formAction} className="space-y-6">
      <section className="border border-ivory-line bg-cream p-6">
        <h2 className="font-display text-lg">Séjour</h2>

        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Arrivée">
            <input
              type="date"
              name="check_in"
              value={checkIn}
              min={today}
              onChange={(e) => onCheckInChange(e.target.value)}
              required
              className="field numeric"
            />
          </Field>
          <Field label="Départ">
            <input
              type="date"
              name="check_out"
              value={checkOut}
              min={addDaysIso(checkIn, 1)}
              onChange={(e) => setCheckOut(e.target.value)}
              required
              className="field numeric"
            />
          </Field>
          <Field label="Adultes">
            <input
              type="number"
              name="adults"
              defaultValue={2}
              min={1}
              max={room?.maxAdults ?? 6}
              required
              className="field numeric"
            />
          </Field>
          <Field label="Enfants">
            <input
              type="number"
              name="children"
              defaultValue={0}
              min={0}
              max={room?.maxChildren ?? 4}
              className="field numeric"
            />
          </Field>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="Catégorie">
            <select
              name="room_type_id"
              value={roomTypeId}
              onChange={(e) => setRoomTypeId(e.target.value)}
              required
              className="field"
            >
              {roomTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.name} — {formatXof(rt.basePriceXof)} / nuit
                </option>
              ))}
            </select>
          </Field>
          <Field label="Origine">
            <select name="source" defaultValue="phone" className="field">
              <option value="phone">Téléphone ou WhatsApp</option>
              <option value="desk">Au comptoir</option>
            </select>
          </Field>
        </div>

        {nights > 0 && room ? (
          <p className="mt-5 border-t border-ivory-line pt-4 text-sm text-brown-soft">
            Estimation :{" "}
            <span className="numeric font-medium text-bronze">
              {formatXof(estimate)}
            </span>{" "}
            pour {nights} nuit{nights > 1 ? "s" : ""}. Le montant définitif est
            calculé à l&apos;enregistrement.
          </p>
        ) : null}
      </section>

      <section className="border border-ivory-line bg-cream p-6">
        <h2 className="font-display text-lg">Client</h2>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="Prénom">
            <input name="first_name" required maxLength={80} className="field" />
          </Field>
          <Field label="Nom">
            <input name="last_name" required maxLength={80} className="field" />
          </Field>
          <Field
            label="Téléphone"
            hint="Le seul moyen sûr de retrouver le client s'il rappelle."
          >
            <input
              type="tel"
              name="phone"
              required
              maxLength={30}
              placeholder="+225 07 00 00 00 00"
              className="field"
            />
          </Field>
          <Field
            label="Adresse e-mail"
            hint="Facultative. Sans elle, pas de confirmation écrite."
          >
            <input type="email" name="email" maxLength={200} className="field" />
          </Field>
          <Field label="Langue du client">
            <select name="locale" defaultValue="fr" className="field">
              <option value="fr">Français</option>
              <option value="en">Anglais</option>
            </select>
          </Field>
          <Field label="Demande particulière">
            <input name="notes" maxLength={400} className="field" />
          </Field>
        </div>
      </section>

      <section className="border border-ivory-line bg-cream p-6">
        <h2 className="font-display text-lg">Encaissement</h2>
        <p className="mt-1 text-xs leading-relaxed text-brown-soft">
          Laissez à zéro si le client règle à l&apos;arrivée : la réservation
          sera enregistrée « en attente ».
        </p>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="Montant déjà encaissé (FCFA)">
            <input
              type="number"
              name="amount_paid"
              defaultValue={0}
              min={0}
              step={100}
              className="field numeric"
            />
          </Field>
        </div>

        <label className="mt-5 flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="mark_confirmed"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 size-4 accent-[var(--color-bronze)]"
          />
          <span>
            Marquer la réservation confirmée
            <span className="mt-1 block text-xs leading-relaxed text-brown-soft">
              À cocher quand l&apos;acompte est encaissé ou que vous garantissez
              la chambre. Dans les deux cas la chambre est bloquée : ce réglage
              ne change que le statut affiché.
            </span>
          </span>
        </label>
      </section>

      {state.status === "error" ? (
        <p
          role="alert"
          className="flex items-start gap-2 border border-danger/30 bg-danger/8 p-4 text-sm leading-relaxed"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-danger" />
          {state.message}
        </p>
      ) : null}

      <Submit />
    </form>
  );
}
