"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Plus, X } from "lucide-react";
import {
  createRoomType,
  updateRoomType,
  type RoomTypeState,
} from "@/app/admin/(dashboard)/chambres/actions";

const INITIAL: RoomTypeState = { status: "idle" };

export interface RoomTypeValues {
  id?: string;
  slug: string;
  nameFr: string;
  nameEn: string;
  shortFr: string;
  shortEn: string;
  descriptionFr: string;
  descriptionEn: string;
  basePriceXof: number;
  maxAdults: number;
  maxChildren: number;
  totalUnits: number;
  surfaceM2: number | null;
  bedConfig: string;
  amenities: string[];
  sortOrder: number;
  isPublished: boolean;
}

export const EMPTY_ROOM_TYPE: RoomTypeValues = {
  slug: "",
  nameFr: "",
  nameEn: "",
  shortFr: "",
  shortEn: "",
  descriptionFr: "",
  descriptionEn: "",
  basePriceXof: 20000,
  maxAdults: 2,
  maxChildren: 0,
  totalUnits: 1,
  surfaceM2: null,
  bedConfig: "",
  amenities: [],
  sortOrder: 0,
  isPublished: false,
};

/**
 * Équipements les plus fréquents, proposés en un clic.
 * Ils ne sont pas imposés : la liste reste entièrement libre, l'hôtel ajoute ce
 * qu'il veut. L'objectif est d'éviter la page blanche et les formulations
 * divergentes d'une catégorie à l'autre (« Wifi » ici, « Wi-Fi gratuit » là).
 */
const SUGGESTIONS = [
  "Climatisation",
  "Wi-Fi gratuit",
  "Télévision écran plat",
  "Salle d'eau privative",
  "Douche italienne",
  "Sèche-cheveux",
  "Bureau",
  "Coin salon",
  "Mini-bar",
  "Réfrigérateur",
  "Coffre-fort",
  "Plateau de courtoisie",
  "Terrasse privative",
  "Vue jardin",
  "Accès PMR",
];

function Save({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? "Enregistrement…" : label}
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
 * Création et modification d'une catégorie de chambre.
 *
 * Même formulaire pour les deux : les règles de validation, l'ordre des champs
 * et les libellés doivent être identiques, sinon ils divergent au premier
 * ajustement. Seules l'action appelée et l'intitulé du bouton changent.
 *
 * Les contenus sont saisis dans les DEUX langues sur le même écran plutôt que
 * dans deux onglets séparés : c'est ce qui rend visible l'oubli d'une
 * traduction, la cause la plus fréquente d'une fiche à moitié anglaise.
 */
export function RoomTypeForm({
  values,
  mode,
}: {
  values: RoomTypeValues;
  mode: "create" | "edit";
}) {
  const action = mode === "create" ? createRoomType : updateRoomType;
  const [state, formAction] = useActionState(action, INITIAL);
  const [amenities, setAmenities] = useState<string[]>(
    values.amenities.length > 0 ? values.amenities : [""]
  );

  const addAmenity = (value = "") => setAmenities((list) => [...list, value]);
  const removeAmenity = (index: number) =>
    setAmenities((list) => list.filter((_, i) => i !== index));
  const setAmenity = (index: number, value: string) =>
    setAmenities((list) => list.map((item, i) => (i === index ? value : item)));

  const unused = SUGGESTIONS.filter(
    (s) => !amenities.some((a) => a.toLowerCase() === s.toLowerCase())
  );

  return (
    <form action={formAction} className="space-y-6">
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <section className="border border-ivory-line bg-cream p-6">
        <h2 className="font-display text-lg">Identité</h2>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="Nom (français)">
            <input
              name="name_fr"
              defaultValue={values.nameFr}
              required
              minLength={3}
              maxLength={80}
              placeholder="Chambre Supérieure"
              className="field"
            />
          </Field>
          <Field label="Nom (anglais)">
            <input
              name="name_en"
              defaultValue={values.nameEn}
              required
              minLength={3}
              maxLength={80}
              placeholder="Superior Room"
              className="field"
            />
          </Field>

          <Field
            label="Accroche (français)"
            hint="Une phrase courte, affichée sous le nom sur la liste des chambres."
          >
            <input
              name="short_fr"
              defaultValue={values.shortFr}
              maxLength={160}
              placeholder="Plus d'espace, plus de calme."
              className="field"
            />
          </Field>
          <Field label="Accroche (anglais)">
            <input
              name="short_en"
              defaultValue={values.shortEn}
              maxLength={160}
              placeholder="More space, more quiet."
              className="field"
            />
          </Field>

          <Field
            label="Description (français)"
            hint="Le texte long de la fiche. Décrivez le couchage, la vue, l'ambiance."
          >
            <textarea
              name="description_fr"
              defaultValue={values.descriptionFr}
              rows={6}
              maxLength={2000}
              className="field resize-y"
            />
          </Field>
          <Field label="Description (anglais)">
            <textarea
              name="description_en"
              defaultValue={values.descriptionEn}
              rows={6}
              maxLength={2000}
              className="field resize-y"
            />
          </Field>
        </div>
      </section>

      <section className="border border-ivory-line bg-cream p-6">
        <h2 className="font-display text-lg">Tarif et capacité</h2>

        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Tarif par nuit (FCFA)">
            <input
              type="number"
              name="base_price_xof"
              defaultValue={values.basePriceXof}
              min={1}
              step={100}
              required
              className="field numeric"
            />
          </Field>
          <Field
            label="Chambres vendables"
            hint="Nombre d'unités de cette catégorie proposées en ligne."
          >
            <input
              type="number"
              name="total_units"
              defaultValue={values.totalUnits}
              min={1}
              max={200}
              required
              className="field numeric"
            />
          </Field>
          <Field label="Surface (m²)" hint="Facultatif.">
            <input
              type="number"
              name="surface_m2"
              defaultValue={values.surfaceM2 ?? ""}
              min={1}
              max={999}
              className="field numeric"
            />
          </Field>
          <Field label="Adultes maximum">
            <input
              type="number"
              name="max_adults"
              defaultValue={values.maxAdults}
              min={1}
              max={10}
              required
              className="field numeric"
            />
          </Field>
          <Field label="Enfants maximum">
            <input
              type="number"
              name="max_children"
              defaultValue={values.maxChildren}
              min={0}
              max={10}
              required
              className="field numeric"
            />
          </Field>
          <Field label="Couchage" hint="Ex. « Lit queen 160×200 »">
            <input
              name="bed_config"
              defaultValue={values.bedConfig}
              maxLength={120}
              className="field"
            />
          </Field>
        </div>
      </section>

      <section className="border border-ivory-line bg-cream p-6">
        <h2 className="font-display text-lg">Équipements</h2>
        <p className="mt-1 text-xs leading-relaxed text-brown-soft">
          Affichés en liste sur la fiche de la chambre. Ajoutez-en autant que
          nécessaire — c&apos;est ici que se met à jour une chambre qui vient
          d&apos;être rééquipée.
        </p>

        <ul className="mt-5 space-y-2">
          {amenities.map((amenity, index) => (
            <li key={index} className="flex gap-2">
              <input
                name="amenity"
                value={amenity}
                onChange={(e) => setAmenity(index, e.target.value)}
                maxLength={80}
                placeholder="Climatisation"
                className="field"
              />
              <button
                type="button"
                onClick={() => removeAmenity(index)}
                className="shrink-0 px-2.5 text-brown-soft transition-colors hover:text-danger"
                aria-label={`Retirer « ${amenity || "cet équipement"} »`}
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => addAmenity()}
          className="mt-3 inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-bronze transition-colors hover:text-bronze-dark"
        >
          <Plus size={14} />
          Ajouter une ligne
        </button>

        {unused.length > 0 ? (
          <div className="mt-5 border-t border-ivory-line pt-4">
            <p className="text-xs text-brown-soft">Suggestions :</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {unused.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() =>
                    setAmenities((list) => {
                      // Réutilise une ligne vide plutôt que d'en empiler une
                      // nouvelle : cliquer trois suggestions ne doit pas laisser
                      // trois champs vides derrière.
                      const empty = list.findIndex((a) => a.trim() === "");
                      if (empty === -1) return [...list, suggestion];
                      return list.map((a, i) => (i === empty ? suggestion : a));
                    })
                  }
                  className="border border-ivory-line px-2.5 py-1 text-xs text-brown-soft transition-colors hover:border-bronze hover:text-bronze"
                >
                  + {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="border border-ivory-line bg-cream p-6">
        <h2 className="font-display text-lg">Publication</h2>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field
            label="Identifiant d'adresse"
            hint="Laissez vide pour le déduire du nom français. Modifiable tant que la fiche n'est pas en ligne — le changer plus tard casse les liens existants."
          >
            <input
              name="slug"
              defaultValue={values.slug}
              maxLength={60}
              placeholder="chambre-superieure"
              className="field"
            />
          </Field>
          <Field
            label="Ordre d'affichage"
            hint="Plus le nombre est petit, plus la catégorie apparaît haut."
          >
            <input
              type="number"
              name="sort_order"
              defaultValue={values.sortOrder}
              min={0}
              max={999}
              className="field numeric"
            />
          </Field>
        </div>

        <label className="mt-5 flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="is_published"
            defaultChecked={values.isPublished}
            className="mt-0.5 size-4 accent-[var(--color-bronze)]"
          />
          <span>
            Visible sur le site
            <span className="mt-1 block text-xs leading-relaxed text-brown-soft">
              Décochée, la catégorie reste modifiable ici mais n&apos;apparaît ni
              sur le site, ni dans les résultats de disponibilité. Pratique pour
              préparer une fiche avant son ouverture à la vente.
            </span>
          </span>
        </label>
      </section>

      {state.status !== "idle" ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`flex items-start gap-2 border p-4 text-sm leading-relaxed ${
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

      <Save label={mode === "create" ? "Créer la catégorie" : "Enregistrer"} />
    </form>
  );
}
