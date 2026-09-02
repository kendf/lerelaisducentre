import "server-only";
import { createUserClient } from "@/lib/supabase/server";
import { addDaysIso, hotelToday } from "@/lib/utils";
import type {
  Locale,
  ReservationStatus,
  RoomTypeContent,
} from "@/types/database";

/**
 * Lectures du back-office.
 *
 * Toutes passent par `createUserClient()` — donc avec la session du membre de
 * l'équipe et sous le contrôle des policies RLS. Jamais la clé `service_role` :
 * si une policy est mal écrite, l'erreur doit se voir ici, pas être masquée par
 * un contournement systématique des règles.
 */

export interface OccupancyBucket {
  bucket_start: string;
  bucket_end: string;
  nights_sold: number;
  capacity: number;
  reservations: number;
}

export interface RoomTypeOccupancy {
  room_type_id: string;
  slug: string;
  content: RoomTypeContent;
  nights_sold: number;
  capacity: number;
}

export interface ReservationRow {
  id: string;
  reference: string;
  check_in: string;
  check_out: string;
  nights: number;
  adults: number;
  children: number;
  guest_first_name: string;
  guest_last_name: string;
  guest_phone: string;
  guest_email: string;
  status: ReservationStatus;
  source: string;
  total_amount_xof: number;
  amount_paid_xof: number;
  created_at: string;
  room_types: { slug: string; content: RoomTypeContent } | null;
}

export interface DashboardData {
  today: string;
  occupancyRate: number;
  soldNights: number;
  capacityNights: number;
  upcomingReservations: number;
  revenueXof: number;
  arrivalsToday: ReservationRow[];
  departuresToday: number;
  pendingCount: number;
  series: OccupancyBucket[];
  byRoomType: RoomTypeOccupancy[];
  nextArrivals: ReservationRow[];
}

const RESERVATION_FIELDS =
  "id, reference, check_in, check_out, nights, adults, children, guest_first_name, guest_last_name, guest_phone, guest_email, status, source, total_amount_xof, amount_paid_xof, created_at, room_types(slug, content)";

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createUserClient();
  const today = hotelToday();

  // Fenêtre d'analyse : 30 jours à venir. C'est ce sur quoi un gérant peut
  // encore agir — le passé ne se pilote plus.
  const windowStart = today;
  const windowEnd = addDaysIso(today, 30);

  // Évolution : 8 semaines écoulées + 4 à venir, pour lire une tendance et non
  // un instantané (CDC §3.3 « évolution dans le temps »).
  const seriesStart = addDaysIso(today, -56);
  const seriesEnd = addDaysIso(today, 28);

  const [stats, series, byType, arrivals, departures, pending, nextArrivals] =
    await Promise.all([
      supabase.rpc("occupancy_stats", { p_from: windowStart, p_to: windowEnd }),
      supabase.rpc("occupancy_series", {
        p_from: seriesStart,
        p_to: seriesEnd,
        p_bucket_days: 7,
      }),
      supabase.rpc("occupancy_by_room_type", {
        p_from: windowStart,
        p_to: windowEnd,
      }),
      supabase
        .from("reservations")
        .select(RESERVATION_FIELDS)
        .eq("check_in", today)
        .in("status", ["confirmed", "pending"])
        .order("guest_last_name"),
      supabase
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("check_out", today)
        .in("status", ["confirmed", "completed"]),
      supabase
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("reservations")
        .select(RESERVATION_FIELDS)
        .gt("check_in", today)
        .lte("check_in", addDaysIso(today, 7))
        .in("status", ["confirmed", "pending"])
        .order("check_in")
        .limit(8),
    ]);

  const s = (stats.data ?? {}) as {
    occupancy_rate?: number;
    sold_nights?: number;
    capacity_nights?: number;
    reservations?: number;
    revenue_xof?: number;
  };

  return {
    today,
    occupancyRate: Number(s.occupancy_rate ?? 0),
    soldNights: Number(s.sold_nights ?? 0),
    capacityNights: Number(s.capacity_nights ?? 0),
    upcomingReservations: Number(s.reservations ?? 0),
    revenueXof: Number(s.revenue_xof ?? 0),
    arrivalsToday: (arrivals.data ?? []) as unknown as ReservationRow[],
    departuresToday: departures.count ?? 0,
    pendingCount: pending.count ?? 0,
    series: (series.data ?? []) as OccupancyBucket[],
    byRoomType: (byType.data ?? []) as RoomTypeOccupancy[],
    nextArrivals: (nextArrivals.data ?? []) as unknown as ReservationRow[],
  };
}

export interface ReservationFilters {
  status?: ReservationStatus | "all";
  search?: string;
  from?: string;
  to?: string;
  page?: number;
}

const PAGE_SIZE = 25;

export async function listReservations(filters: ReservationFilters) {
  const supabase = await createUserClient();
  const page = Math.max(1, filters.page ?? 1);

  let query = supabase
    .from("reservations")
    .select(RESERVATION_FIELDS, { count: "exact" })
    .order("check_in", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters.from) query = query.gte("check_in", filters.from);
  if (filters.to) query = query.lte("check_in", filters.to);

  // Recherche sur la référence, le nom ou le téléphone — les trois entrées
  // dont dispose une réceptionniste avec un client au comptoir ou au téléphone.
  if (filters.search) {
    const term = filters.search.replace(/[%,()]/g, "").trim();
    if (term) {
      query = query.or(
        `reference.ilike.%${term}%,guest_last_name.ilike.%${term}%,guest_first_name.ilike.%${term}%,guest_phone.ilike.%${term}%`
      );
    }
  }

  const { data, count, error } = await query;
  if (error) console.error("[admin] listReservations:", error.message);

  return {
    rows: (data ?? []) as unknown as ReservationRow[],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)),
  };
}

export async function getReservation(id: string) {
  const supabase = await createUserClient();

  const [reservation, payments, notifications] = await Promise.all([
    supabase
      .from("reservations")
      .select(`${RESERVATION_FIELDS}, guest_country, guest_notes, locale, version, hold_expires_at, confirmed_at, cancelled_at, cancellation_reason, deposit_amount_xof, price_breakdown, assigned_room_id`)
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("payments")
      .select("id, provider, method, status, amount_xof, provider_ref, failure_reason, created_at")
      .eq("reservation_id", id)
      .order("created_at"),
    supabase
      .from("notifications_log")
      .select("id, channel, template, recipient, status, error, sent_at, created_at")
      .eq("reservation_id", id)
      .order("created_at"),
  ]);

  return {
    reservation: reservation.data as
      | (ReservationRow & {
          locale: Locale;
          version: number;
          deposit_amount_xof: number;
          guest_country: string | null;
          guest_notes: string | null;
          hold_expires_at: string | null;
          confirmed_at: string | null;
          cancelled_at: string | null;
          cancellation_reason: string | null;
          assigned_room_id: string | null;
        })
      | null,
    payments: payments.data ?? [],
    notifications: notifications.data ?? [],
  };
}

export async function listContactMessages() {
  const supabase = await createUserClient();
  const { data } = await supabase
    .from("contact_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  return data ?? [];
}

export interface PlanningNight {
  night: string;
  units_open: number;
  units_sold: number;
  units_free: number;
  price_xof: number;
  is_closed: boolean;
}

export interface PlanningRow {
  room_type_id: string;
  slug: string;
  name: string;
  total_units: number;
  nights: PlanningNight[];
}

/**
 * Grille de disponibilité par catégorie sur N jours.
 *
 * Une requête par catégorie plutôt qu'une grosse jointure : `nightly_availability`
 * porte déjà toute la règle de calcul (surcharges d'inventaire, fermetures,
 * nuitées vendues). La dupliquer ici en SQL applicatif créerait une seconde
 * vérité sur la disponibilité — exactement ce qu'on veut éviter.
 */
export async function getPlanning(days = 30): Promise<{
  from: string;
  to: string;
  rows: PlanningRow[];
}> {
  const supabase = await createUserClient();
  const from = hotelToday();
  const to = addDaysIso(from, days);

  const { data: types } = await supabase
    .from("room_types")
    .select("id, slug, content, total_units")
    .eq("is_published", true)
    .order("sort_order");

  const rows = await Promise.all(
    (types ?? []).map(async (rt) => {
      const { data } = await supabase.rpc("nightly_availability", {
        p_room_type_id: rt.id,
        p_from: from,
        p_to: to,
      });

      return {
        room_type_id: rt.id,
        slug: rt.slug,
        name: (rt.content as RoomTypeContent).fr.name,
        total_units: rt.total_units,
        nights: (data ?? []) as PlanningNight[],
      };
    })
  );

  return { from, to, rows };
}
