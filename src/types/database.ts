/**
 * Types métier partagés.
 *
 * Écrits à la main pour l'instant : `supabase gen types typescript` les
 * régénérera à partir du schéma réel dès que le projet Supabase sera créé.
 * Les noms correspondent exactement aux colonnes des migrations.
 */

export type Locale = "fr" | "en";

export type StaffRole = "receptionist" | "manager" | "admin";

export type ReservationStatus =
  | "pending_payment"
  | "pending"
  | "confirmed"
  | "cancelled"
  | "expired"
  | "no_show"
  | "completed";

export type ReservationSource = "web" | "desk" | "phone" | "ota";

export interface LocalizedContent {
  name: string;
  short?: string;
  description?: string;
}

export interface RoomTypeContent {
  fr: LocalizedContent;
  en: LocalizedContent;
}

export interface RoomType {
  id: string;
  slug: string;
  content: RoomTypeContent;
  base_price_xof: number;
  max_adults: number;
  max_children: number;
  total_units: number;
  surface_m2: number | null;
  bed_config: string | null;
  amenities: string[];
  sort_order: number;
  is_published: boolean;
}

export interface MediaItem {
  id: string;
  storage_path: string;
  section: string;
  room_type_id: string | null;
  alt: Record<string, string>;
  sort_order: number;
  is_cover: boolean;
  is_placeholder: boolean;
}

/** Ligne renvoyée par la fonction SQL `get_availability`. */
export interface AvailabilityRow {
  room_type_id: string;
  slug: string;
  content: RoomTypeContent;
  base_price_xof: number;
  max_adults: number;
  max_children: number;
  units_free: number;
  total_price_xof: number;
  is_available: boolean;
  reason: "CLOSED" | "SOLD_OUT" | "CAPACITY" | null;
}

/** Objet renvoyé par la fonction SQL `quote_stay`. Le prix fait foi côté serveur. */
export interface StayQuote {
  room_type_id: string;
  room_type_slug: string;
  check_in: string;
  check_out: string;
  nights: number;
  currency: "XOF";
  breakdown: Array<{ night: string; price_xof: number }>;
  total_xof: number;
  deposit_xof: number;
  deposit_percent: number;
  balance_xof: number;
}

/**
 * Vue publique d'une réservation, telle que renvoyée par
 * `get_reservation_public`. Volontairement amputée du téléphone, de l'e-mail
 * et des notes : le lien de confirmation ne doit pas divulguer de coordonnées.
 */
export interface PublicReservation {
  reference: string;
  status: ReservationStatus;
  check_in: string;
  check_out: string;
  nights: number;
  adults: number;
  children: number;
  guest_first_name: string;
  locale: Locale;
  room_type: RoomTypeContent;
  room_type_slug: string;
  total_amount_xof: number;
  deposit_amount_xof: number;
  amount_paid_xof: number;
  hold_expires_at: string | null;
  /**
   * Verdict d'expiration rendu par l'horloge de la base — la même que celle
   * qui libère réellement les chambres. L'application ne le recalcule jamais.
   */
  is_expired: boolean;
}

export interface HoldResult {
  reservation_id: string;
  reference: string;
  public_token: string;
  hold_expires_at: string;
  quote: StayQuote;
}

export interface Reservation {
  id: string;
  reference: string;
  room_type_id: string;
  check_in: string;
  check_out: string;
  nights: number;
  adults: number;
  children: number;
  guest_first_name: string;
  guest_last_name: string;
  guest_email: string;
  guest_phone: string;
  guest_country: string | null;
  guest_notes: string | null;
  locale: Locale;
  status: ReservationStatus;
  source: ReservationSource;
  total_amount_xof: number;
  deposit_amount_xof: number;
  amount_paid_xof: number;
  assigned_room_id: string | null;
  hold_expires_at: string | null;
  version: number;
  created_at: string;
  confirmed_at: string | null;
  cancelled_at: string | null;
}

export interface PublicSettings {
  deposit_percent: number;
  hold_minutes: number;
  min_nights: number;
  check_in_time: string;
  check_out_time: string;
  free_cancellation_hours: number;
  demo_mode: boolean;
  hotel_contact: {
    phone: string;
    whatsapp: string;
    email: string;
    address: string;
    maps_query: string;
  };
}
