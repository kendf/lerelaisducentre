import "server-only";
import { createPublicClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type {
  AvailabilityRow,
  MediaItem,
  PublicReservation,
  PublicSettings,
  RoomType,
  StayQuote,
} from "@/types/database";

/**
 * Accès en lecture au contenu du site vitrine.
 *
 * Toutes les fonctions renvoient une valeur utilisable même si Supabase n'est
 * pas encore configuré : le site se construit et s'affiche, les sections
 * dépendant des données montrent un état vide. C'est ce qui permet de
 * travailler le design avant que la base n'existe, sans code jetable — en
 * production la variable d'environnement est toujours présente.
 */

const FALLBACK_SETTINGS: PublicSettings = {
  deposit_percent: 30,
  hold_minutes: 20,
  min_nights: 1,
  check_in_time: "14:00",
  check_out_time: "12:00",
  free_cancellation_hours: 48,
  demo_mode: true,
  hotel_contact: {
    phone: "+225 27 30 00 00 00",
    whatsapp: "+225 07 00 00 00 00",
    email: "contact@lerelaisducentre.com",
    address: "Tiébissou, Côte d'Ivoire",
    maps_query: "Tiebissou, Cote d'Ivoire",
  },
};

export async function getPublicSettings(): Promise<PublicSettings> {
  if (!isSupabaseConfigured()) return FALLBACK_SETTINGS;

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("settings")
    .select("key, value")
    .eq("is_public", true);

  if (error || !data) return FALLBACK_SETTINGS;

  const map = Object.fromEntries(data.map((r) => [r.key, r.value]));
  return { ...FALLBACK_SETTINGS, ...map } as PublicSettings;
}

export async function getRoomTypes(): Promise<RoomType[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("room_types")
    .select("*")
    .eq("is_published", true)
    .order("sort_order");

  if (error) {
    console.error("[content] getRoomTypes:", error.message);
    return [];
  }
  return (data ?? []) as RoomType[];
}

export async function getRoomType(slug: string): Promise<RoomType | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("room_types")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (error) {
    console.error("[content] getRoomType:", error.message);
    return null;
  }
  return (data as RoomType) ?? null;
}

export async function getMedia(options: {
  section?: string;
  roomTypeId?: string;
  limit?: number;
}): Promise<MediaItem[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = createPublicClient();
  let query = supabase
    .from("media")
    .select("*")
    .eq("is_published", true)
    .order("sort_order");

  if (options.section) query = query.eq("section", options.section);
  if (options.roomTypeId) query = query.eq("room_type_id", options.roomTypeId);
  if (options.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) {
    console.error("[content] getMedia:", error.message);
    return [];
  }
  return (data ?? []) as MediaItem[];
}

/**
 * Disponibilité pour un séjour donné.
 *
 * Passe par la fonction SQL `get_availability` plutôt que par une requête
 * construite côté client : la règle de calcul (unités ouvertes moins unités
 * vendues, fermetures, capacité) vit à un seul endroit, et le navigateur ne
 * voit jamais la structure de l'inventaire.
 */
export async function getAvailability(params: {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
}): Promise<AvailabilityRow[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("get_availability", {
    p_check_in: params.checkIn,
    p_check_out: params.checkOut,
    p_adults: params.adults,
    p_children: params.children,
  });

  if (error) {
    console.error("[content] getAvailability:", error.message);
    throw new Error(error.message);
  }
  return (data ?? []) as AvailabilityRow[];
}

/**
 * Devis d'un séjour. Le montant affiché au visiteur vient toujours d'ici —
 * jamais d'un calcul côté navigateur — et sera recalculé une dernière fois par
 * `create_reservation_hold` au moment d'écrire la réservation. Un tarif modifié
 * au back-office entre l'affichage et la validation est donc pris en compte.
 */
export async function getQuote(params: {
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
}): Promise<StayQuote | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("quote_stay", {
    p_room_type_id: params.roomTypeId,
    p_check_in: params.checkIn,
    p_check_out: params.checkOut,
    p_adults: params.adults,
    p_children: params.children,
  });

  if (error) {
    console.error("[content] getQuote:", error.message);
    return null;
  }
  return data as StayQuote;
}

/** Lecture d'une réservation par son jeton public (page de confirmation). */
export async function getReservationByToken(
  token: string
): Promise<PublicReservation | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("get_reservation_public", {
    p_token: token,
  });

  if (error) {
    console.error("[content] getReservationByToken:", error.message);
    return null;
  }
  return (data as PublicReservation) ?? null;
}
