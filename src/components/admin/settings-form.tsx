"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import {
  updateSettings,
  type SettingsState,
} from "@/app/admin/(dashboard)/parametres/actions";

const INITIAL: SettingsState = { status: "idle" };

interface Values {
  deposit_percent: number;
  hold_minutes: number;
  min_nights: number;
  max_nights: number;
  max_advance_days: number;
  free_cancellation_hours: number;
  check_in_time: string;
  check_out_time: string;
  demo_mode: boolean;
  contact: {
    phone: string;
    whatsapp: string;
    email: string;
    address: string;
    maps_query: string;
  };
}

function Save() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? "Enregistrement…" : "Enregistrer les réglages"}
    </button>
  );
}

function NumberField({
  name,
  label,
  hint,
  defaultValue,
  min,
  max,
  suffix,
}: {
  name: string;
  label: string;
  hint: string;
  defaultValue: number;
  min: number;
  max: number;
  suffix: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wider text-brown-soft">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          name={name}
          defaultValue={defaultValue}
          min={min}
          max={max}
          required
          className="field"
        />
        <span className="shrink-0 text-xs text-brown-soft">{suffix}</span>
      </div>
      <span className="mt-1 block text-xs leading-relaxed text-brown-soft">
        {hint}
      </span>
    </label>
  );
}

/**
 * Réglages métier du CDC §9.
 *
 * Ces valeurs vivent en base et non dans le code : le jour où l'hôtel arrête sa
 * politique d'annulation définitive, c'est une saisie ici — pas un déploiement,
 * pas une intervention de MapDevs.
 */
export function SettingsForm({ values }: { values: Values }) {
  const [state, formAction] = useActionState(updateSettings, INITIAL);

  return (
    <form action={formAction} className="space-y-6">
      <section className="border border-ivory-line bg-cream p-6">
        <h2 className="font-display text-lg">Règles de réservation</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <NumberField
            name="deposit_percent"
            label="Acompte demandé"
            hint="Part du séjour réglée en ligne pour confirmer. Le solde est perçu à l'arrivée."
            defaultValue={values.deposit_percent}
            min={0}
            max={100}
            suffix="%"
          />
          <NumberField
            name="hold_minutes"
            label="Durée de blocage"
            hint="Temps pendant lequel la chambre est réservée au client le temps de payer. Au-delà, elle repart à la vente."
            defaultValue={values.hold_minutes}
            min={5}
            max={120}
            suffix="minutes"
          />
          <NumberField
            name="min_nights"
            label="Séjour minimum"
            hint="Nombre de nuits en dessous duquel la réservation en ligne est refusée."
            defaultValue={values.min_nights}
            min={1}
            max={30}
            suffix="nuits"
          />
          <NumberField
            name="max_nights"
            label="Séjour maximum"
            hint="Au-delà, le visiteur est invité à contacter l'hôtel directement."
            defaultValue={values.max_nights}
            min={1}
            max={365}
            suffix="nuits"
          />
          <NumberField
            name="max_advance_days"
            label="Fenêtre de réservation"
            hint="Jusqu'à combien de jours à l'avance on peut réserver."
            defaultValue={values.max_advance_days}
            min={1}
            max={1095}
            suffix="jours"
          />
          <NumberField
            name="free_cancellation_hours"
            label="Annulation sans frais"
            hint="Délai avant l'arrivée pendant lequel l'annulation reste gratuite. Affiché au client dans le tunnel."
            defaultValue={values.free_cancellation_hours}
            min={0}
            max={720}
            suffix="heures avant"
          />
        </div>
      </section>

      <section className="border border-ivory-line bg-cream p-6">
        <h2 className="font-display text-lg">Horaires</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-wider text-brown-soft">
              Heure d&apos;arrivée
            </span>
            <input
              type="time"
              name="check_in_time"
              defaultValue={values.check_in_time}
              required
              className="field"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-wider text-brown-soft">
              Heure de départ
            </span>
            <input
              type="time"
              name="check_out_time"
              defaultValue={values.check_out_time}
              required
              className="field"
            />
          </label>
        </div>
      </section>

      <section className="border border-ivory-line bg-cream p-6">
        <h2 className="font-display text-lg">Coordonnées publiques</h2>
        <p className="mt-1 text-xs text-brown-soft">
          Affichées dans le pied de page, sur la page Contact et dans les
          confirmations envoyées aux clients.
        </p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-wider text-brown-soft">
              Téléphone
            </span>
            <input
              name="contact_phone"
              defaultValue={values.contact.phone}
              className="field"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-wider text-brown-soft">
              WhatsApp
            </span>
            <input
              name="contact_whatsapp"
              defaultValue={values.contact.whatsapp}
              className="field"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-wider text-brown-soft">
              Adresse e-mail
            </span>
            <input
              type="email"
              name="contact_email"
              defaultValue={values.contact.email}
              className="field"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-wider text-brown-soft">
              Adresse postale
            </span>
            <input
              name="contact_address"
              defaultValue={values.contact.address}
              className="field"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs uppercase tracking-wider text-brown-soft">
              Recherche Google Maps
            </span>
            <input
              name="contact_maps"
              defaultValue={values.contact.maps_query}
              className="field"
            />
            <span className="mt-1 block text-xs text-brown-soft">
              Texte utilisé pour centrer la carte de la page Contact.
            </span>
          </label>
        </div>
      </section>

      <section className="border border-ivory-line bg-cream p-6">
        <h2 className="font-display text-lg">Affichage</h2>
        <label className="mt-5 flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="demo_mode"
            defaultChecked={values.demo_mode}
            className="mt-0.5 size-4 accent-[var(--color-bronze)]"
          />
          <span>
            Mode démonstration
            <span className="mt-1 block text-xs leading-relaxed text-brown-soft">
              Affiche sur tout le site la mention « visuels d&apos;illustration ».
              À décocher le jour où les photographies définitives de
              l&apos;établissement sont en ligne.
            </span>
          </span>
        </label>
      </section>

      {state.status !== "idle" ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`flex items-start gap-2 border p-4 text-sm ${
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

      <Save />
    </form>
  );
}
