"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import {
  blockDates,
  type PlanningState,
} from "@/app/admin/(dashboard)/planning/actions";

const INITIAL: PlanningState = { status: "idle" };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? "Application…" : "Appliquer"}
    </button>
  );
}

export function BlockDatesForm({
  roomTypes,
}: {
  roomTypes: Array<{ id: string; name: string; totalUnits: number }>;
}) {
  const [state, formAction] = useActionState(blockDates, INITIAL);
  const [mode, setMode] = useState("close");
  const [roomTypeId, setRoomTypeId] = useState(roomTypes[0]?.id ?? "");

  const selected = roomTypes.find((r) => r.id === roomTypeId);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-wider text-brown-soft">
            Catégorie
          </span>
          <select
            name="roomTypeId"
            value={roomTypeId}
            onChange={(e) => setRoomTypeId(e.target.value)}
            className="field"
            required
          >
            {roomTypes.map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-wider text-brown-soft">
            Du
          </span>
          <input type="date" name="from" required className="field" />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-wider text-brown-soft">
            Au (exclu)
          </span>
          <input type="date" name="to" required className="field" />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-wider text-brown-soft">
            Action
          </span>
          <select
            name="mode"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="field"
          >
            <option value="close">Fermer à la vente</option>
            <option value="reduce">Réduire le nombre de chambres</option>
            <option value="open">Rouvrir à la vente</option>
          </select>
        </label>
      </div>

      {mode === "reduce" ? (
        <label className="block max-w-xs">
          <span className="mb-1.5 block text-xs uppercase tracking-wider text-brown-soft">
            Chambres vendables sur la période
          </span>
          <input
            type="number"
            name="units"
            min={0}
            max={selected?.totalUnits ?? 20}
            defaultValue={Math.max(0, (selected?.totalUnits ?? 1) - 1)}
            className="field"
            required
          />
          <span className="mt-1 block text-xs text-brown-soft">
            Sur {selected?.totalUnits ?? "—"} au total.
          </span>
        </label>
      ) : null}

      <label className="block">
        <span className="mb-1.5 block text-xs uppercase tracking-wider text-brown-soft">
          Motif (visible en interne uniquement)
        </span>
        <input
          name="note"
          maxLength={200}
          placeholder="Réfection peinture, séminaire privé…"
          className="field"
        />
      </label>

      {state.status !== "idle" ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`flex items-start gap-2 border p-3 text-sm ${
            state.status === "error"
              ? "border-danger/30 bg-danger/8"
              : "border-palm/30 bg-palm/8"
          }`}
        >
          {state.status === "error" ? (
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-danger" />
          ) : (
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-palm" />
          )}
          {state.message}
        </p>
      ) : null}

      <Submit />
    </form>
  );
}
