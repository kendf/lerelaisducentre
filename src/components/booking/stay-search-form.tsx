"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { addDaysIso, hotelToday } from "@/lib/utils";
import { cn } from "@/lib/utils";

/** Catégorie proposée au filtre, déjà traduite par la page appelante. */
export interface SearchRoomOption {
  id: string;
  name: string;
}

interface StaySearchFormProps {
  defaults: {
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
    /** Catégorie présélectionnée. Chaîne vide = toutes. */
    roomTypeId?: string;
  };
  /**
   * Catégories de l'établissement. Omises, le champ n'apparaît pas : une liste
   * déroulante vide vaudrait moins que pas de liste du tout.
   */
  roomTypes?: SearchRoomOption[];
  /**
   * `page`  : encadré posé dans le flux, sur la page Réserver.
   * `panel` : compact sur deux rangées, pour le panneau d'ouverture de
   *           l'accueil où la largeur est comptée.
   * `bar`   : rangée unique, sans cadre — le conteneur porte déjà le fond et
   *           les filets (barre collante de la page Chambres).
   * Même logique, même URL produite — seule la présentation change.
   */
  variant?: "page" | "panel" | "bar";
}

/**
 * Étape 1 du tunnel : dates et voyageurs (CDC §5.4, 3 étapes maximum).
 *
 * L'état vit dans l'URL, pas dans un store côté client. Trois conséquences
 * concrètes : le visiteur peut partager ou mettre en favori une recherche,
 * le bouton « retour » du navigateur fonctionne comme il l'attend, et la
 * recherche de disponibilité est rendue côté serveur — donc jamais un
 * affichage périmé issu d'un cache local.
 */
export function StaySearchForm({
  defaults,
  roomTypes,
  variant = "page",
}: StaySearchFormProps) {
  const t = useTranslations("booking");
  const router = useRouter();
  const today = hotelToday();

  const [checkIn, setCheckIn] = useState(defaults.checkIn);
  const [checkOut, setCheckOut] = useState(defaults.checkOut);
  const [adults, setAdults] = useState(defaults.adults);
  const [children, setChildren] = useState(defaults.children);
  const [roomTypeId, setRoomTypeId] = useState(defaults.roomTypeId ?? "");

  const showRoomTypes = Boolean(roomTypes && roomTypes.length > 0);

  // La date de départ suit toujours celle d'arrivée : on corrige plutôt que
  // d'afficher une erreur après coup.
  function onCheckInChange(value: string) {
    setCheckIn(value);
    if (checkOut <= value) setCheckOut(addDaysIso(value, 1));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push({
      pathname: "/reserver",
      query: {
        checkIn,
        checkOut,
        adults: String(adults),
        children: String(children),
        // Absente de l'URL quand aucune catégorie n'est choisie : une adresse
        // partagée ne doit pas porter un filtre que personne n'a demandé.
        ...(roomTypeId ? { room: roomTypeId } : {}),
      },
    });
  }

  const panel = variant === "panel";
  const bar = variant === "bar";

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "grid gap-4",
        // Dans le panneau d'ouverture : deux rangées de deux, le bouton sur
        // toute la largeur. Aucune bordure ni fond — le formulaire fait partie
        // du panneau ivoire, il ne s'y superpose pas.
        panel && "grid-cols-2",
        // En barre : une seule rangée, alignée sur la ligne de base des champs.
        // Le bouton prend la largeur de son libellé, pas une fraction de la
        // grille : « Voir les disponibilités » ne tient pas dans un sixième de
        // barre et passait à la ligne. Les champs se partagent le reste.
        bar &&
          cn(
            "grid-cols-2 gap-3 sm:grid-cols-4 lg:items-end",
            showRoomTypes
              ? "lg:grid-cols-[repeat(5,minmax(0,1fr))_auto]"
              : "lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]"
          ),
        !panel &&
          !bar &&
          cn(
            "border border-ivory-line bg-cream p-6 sm:grid-cols-2 lg:items-end",
            showRoomTypes
              ? "lg:grid-cols-[repeat(5,minmax(0,1fr))_auto]"
              : "lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]"
          )
      )}
    >
      <label className="block">
        <span className="mb-1.5 block text-xs uppercase tracking-wider text-brown-soft">
          {t("checkIn")}
        </span>
        <input
          type="date"
          value={checkIn}
          min={today}
          onChange={(e) => onCheckInChange(e.target.value)}
          className="field numeric"
          required
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs uppercase tracking-wider text-brown-soft">
          {t("checkOut")}
        </span>
        <input
          type="date"
          value={checkOut}
          min={addDaysIso(checkIn, 1)}
          onChange={(e) => setCheckOut(e.target.value)}
          className="field numeric"
          required
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs uppercase tracking-wider text-brown-soft">
          {t("adults")}
        </span>
        <select
          value={adults}
          onChange={(e) => setAdults(Number(e.target.value))}
          className="field"
        >
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs uppercase tracking-wider text-brown-soft">
          {t("children")}
        </span>
        <select
          value={children}
          onChange={(e) => setChildren(Number(e.target.value))}
          className="field"
        >
          {[0, 1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      {showRoomTypes ? (
        <label className={cn("block", panel && "col-span-2")}>
          <span className="mb-1.5 block text-xs tracking-wider text-brown-soft uppercase">
            {t("roomTypeLabel")}
          </span>
          <select
            value={roomTypeId}
            onChange={(e) => setRoomTypeId(e.target.value)}
            className="field"
          >
            {/* « Toutes » en tête et par défaut : le filtre est une aide, il ne
                doit jamais restreindre une recherche que le visiteur n'a pas
                lui-même restreinte. */}
            <option value="">{t("anyRoom")}</option>
            {roomTypes!.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <button
        type="submit"
        className={cn(
          "btn btn-primary w-full whitespace-nowrap",
          panel && "col-span-2 mt-1",
          bar && "col-span-2 sm:col-span-4 lg:col-span-1 lg:w-auto"
        )}
      >
        <Search size={15} />
        {t("search")}
      </button>
    </form>
  );
}
