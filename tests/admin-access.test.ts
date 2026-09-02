import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Droits différenciés du back-office — critère de recette CDC §13 :
 * « le back-office permet à plusieurs utilisateurs de consulter et de gérer les
 * réservations selon leurs droits ».
 *
 * Les tests se connectent RÉELLEMENT avec les comptes de démonstration et
 * agissent avec leur session, donc sous le contrôle des policies RLS. C'est la
 * seule façon de vérifier que la séparation réceptionniste / gérant tient en
 * base, et pas seulement dans l'affichage.
 *
 * Prérequis : `npm run db:start`, puis
 *   npm run staff:create -- gerant@lerelaisducentre.com DemoRelais2026 "Adjoua Kouamé" manager
 *   npm run staff:create -- reception@lerelaisducentre.com DemoRelais2026 "Yao Bertrand" receptionist
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54421";
const ANON =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const PASSWORD = "DemoRelais2026";

let manager: SupabaseClient;
let receptionist: SupabaseClient;

async function signIn(email: string): Promise<SupabaseClient> {
  const client = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (error) throw new Error(`Connexion impossible (${email}) : ${error.message}`);
  return client;
}

beforeAll(async () => {
  manager = await signIn("gerant@lerelaisducentre.com");
  receptionist = await signIn("reception@lerelaisducentre.com");
});

describe("réceptionniste", () => {
  it("consulte les réservations", async () => {
    const { data, error } = await receptionist
      .from("reservations")
      .select("reference, guest_last_name")
      .limit(5);

    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("consulte les statistiques d'occupation", async () => {
    const { data, error } = await receptionist.rpc("occupancy_stats", {
      p_from: new Date().toISOString().slice(0, 10),
      p_to: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
    });

    expect(error).toBeNull();
    expect(data).toHaveProperty("occupancy_rate");
  });

  it("peut bloquer des dates — c'est une tâche quotidienne de réception", async () => {
    const { data: rt } = await receptionist
      .from("room_types")
      .select("id")
      .eq("slug", "chambre-standard")
      .single();

    const from = new Date(Date.now() + 250 * 86_400_000).toISOString().slice(0, 10);
    const to = new Date(Date.now() + 252 * 86_400_000).toISOString().slice(0, 10);

    const { error } = await receptionist.rpc("set_inventory_block", {
      p_room_type_id: rt!.id,
      p_from: from,
      p_to: to,
      p_units_override: null,
      p_is_closed: true,
      p_note: "Test automatisé",
    });

    expect(error).toBeNull();

    // Nettoyage par le gérant, seul habilité à écrire dans inventory_calendar.
    await manager
      .from("inventory_calendar")
      .delete()
      .eq("room_type_id", rt!.id)
      .gte("night", from)
      .lt("night", to);
  });

  it("NE PEUT PAS modifier un tarif", async () => {
    const { data: before } = await receptionist
      .from("room_types")
      .select("id, base_price_xof")
      .eq("slug", "chambre-standard")
      .single();

    await receptionist
      .from("room_types")
      .update({ base_price_xof: 1 })
      .eq("id", before!.id);

    // La policy RLS ne renvoie pas d'erreur : elle fait simplement en sorte
    // qu'aucune ligne ne corresponde. Ce qui compte est que le tarif n'ait pas
    // bougé — on le relit avec un compte qui, lui, voit tout.
    const { data: after } = await manager
      .from("room_types")
      .select("base_price_xof")
      .eq("id", before!.id)
      .single();

    expect(after!.base_price_xof).toBe(before!.base_price_xof);
  });

  it("NE PEUT PAS se promouvoir gérant", async () => {
    const {
      data: { user },
    } = await receptionist.auth.getUser();

    const { error } = await receptionist
      .from("profiles")
      .update({ role: "manager" })
      .eq("id", user!.id);

    // Ici le déclencheur `tg_guard_role_change` lève explicitement : une policy
    // UPDATE ne sait pas protéger une seule colonne.
    expect(error?.message ?? "").toMatch(/FORBIDDEN_ROLE_CHANGE/);

    const { data: profile } = await manager
      .from("profiles")
      .select("role")
      .eq("id", user!.id)
      .single();

    expect(profile!.role).toBe("receptionist");
  });

  it("NE PEUT PAS lire le journal d'audit", async () => {
    const { data } = await receptionist.from("audit_log").select("id").limit(1);
    expect(data ?? []).toHaveLength(0);
  });
});

describe("gérant", () => {
  it("modifie un tarif et le remet en place", async () => {
    const { data: before } = await manager
      .from("room_types")
      .select("id, base_price_xof")
      .eq("slug", "chambre-standard")
      .single();

    const bumped = before!.base_price_xof + 1000;

    const { error } = await manager
      .from("room_types")
      .update({ base_price_xof: bumped })
      .eq("id", before!.id);
    expect(error).toBeNull();

    const { data: after } = await manager
      .from("room_types")
      .select("base_price_xof")
      .eq("id", before!.id)
      .single();
    expect(after!.base_price_xof).toBe(bumped);

    await manager
      .from("room_types")
      .update({ base_price_xof: before!.base_price_xof })
      .eq("id", before!.id);
  });

  it("lit le journal d'audit", async () => {
    const { error } = await manager.from("audit_log").select("id").limit(1);
    expect(error).toBeNull();
  });

  it("lit l'évolution de l'occupation", async () => {
    const { data, error } = await manager.rpc("occupancy_series", {
      p_from: new Date(Date.now() - 28 * 86_400_000).toISOString().slice(0, 10),
      p_to: new Date(Date.now() + 28 * 86_400_000).toISOString().slice(0, 10),
      p_bucket_days: 7,
    });

    expect(error).toBeNull();
    expect((data ?? []).length).toBe(8);
  });
});

describe("aucun rôle ne peut contourner le moteur de réservation", () => {
  it("le personnel ne peut pas insérer directement une réservation", async () => {
    const { data: rt } = await manager
      .from("room_types")
      .select("id")
      .eq("slug", "suite-relais")
      .single();

    // Une insertion directe contournerait l'attribution d'unité et rouvrirait
    // la porte au surbooking : aucune policy INSERT n'existe, pour personne.
    const { error } = await manager.from("reservations").insert({
      reference: "RDC-HACK-0001",
      room_type_id: rt!.id,
      check_in: "2027-01-01",
      check_out: "2027-01-02",
      guest_first_name: "Contournement",
      guest_last_name: "Test",
      guest_email: "hack@test.invalid",
      guest_phone: "+225 07 00 00 00 00",
      total_amount_xof: 1,
      deposit_amount_xof: 0,
      price_breakdown: [],
    });

    expect(error).not.toBeNull();
  });

  it("le personnel ne peut pas écrire dans reservation_nights", async () => {
    const { error } = await manager.from("reservation_nights").insert({
      reservation_id: "00000000-0000-0000-0000-000000000000",
      room_type_id: "00000000-0000-0000-0000-000000000000",
      night: "2027-01-01",
      unit_slot: 0,
    });

    expect(error).not.toBeNull();
  });
});

describe("l'administrateur est seul maître des accès", () => {
  let admin: SupabaseClient;

  beforeAll(async () => {
    admin = await signIn("admin@lerelaisducentre.com");
  });

  it("le gérant NE PEUT PLUS changer un rôle", async () => {
    const {
      data: { user },
    } = await receptionist.auth.getUser();

    await manager
      .from("profiles")
      .update({ role: "manager" })
      .eq("id", user!.id);

    // La policy `profiles_manage_by_admin` ne fait correspondre aucune ligne
    // au gérant : l'update ne remonte pas d'erreur, il ne fait simplement
    // rien. Ce qui compte est donc le RÉSULTAT, relu par un compte qui voit
    // tout. La gérance pilote l'exploitation, elle ne distribue pas les accès.
    const { data: after } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user!.id)
      .single();

    expect(after!.role).toBe("receptionist");
  });

  it("l'administrateur change un rôle puis le remet", async () => {
    const {
      data: { user },
    } = await receptionist.auth.getUser();

    const { error } = await admin
      .from("profiles")
      .update({ role: "manager" })
      .eq("id", user!.id);
    expect(error).toBeNull();

    const { data: after } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user!.id)
      .single();
    expect(after!.role).toBe("manager");

    await admin
      .from("profiles")
      .update({ role: "receptionist" })
      .eq("id", user!.id);
  });
});

describe("réservation prise au comptoir", () => {
  const iso = (days: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };

  it("consomme le même inventaire qu'une réservation en ligne", async () => {
    const { data: rt } = await receptionist
      .from("room_types")
      .select("id")
      .eq("slug", "suite-relais")
      .single();

    // Hors de la plage utilisée par tests/booking-engine.test.ts (J+200 à
    // J+304) et sous la fenêtre de réservation de 365 jours : deux fichiers de
    // test qui se disputent le même stock produisent des échecs aléatoires.
    const checkIn = iso(330);
    const checkOut = iso(332);

    const before = await receptionist.rpc("get_availability", {
      p_check_in: checkIn,
      p_check_out: checkOut,
      p_adults: 1,
      p_children: 0,
    });
    const freeBefore =
      (before.data as Array<{ room_type_id: string; units_free: number }>).find(
        (r) => r.room_type_id === rt!.id
      )?.units_free ?? 0;

    const { data, error } = await receptionist.rpc("create_desk_reservation", {
      p_room_type_id: rt!.id,
      p_check_in: checkIn,
      p_check_out: checkOut,
      p_adults: 2,
      p_children: 0,
      p_guest_first_name: "Appel",
      p_guest_last_name: "Comptoir",
      p_guest_email: "",
      p_guest_phone: "+225 07 00 00 00 00",
      p_guest_notes: null,
      p_locale: "fr",
      p_source: "phone",
      p_mark_confirmed: false,
      p_amount_paid_xof: 0,
    });

    expect(error).toBeNull();
    const created = data as { reservation_id: string; status: string };
    expect(created.status).toBe("pending");

    const after = await receptionist.rpc("get_availability", {
      p_check_in: checkIn,
      p_check_out: checkOut,
      p_adults: 1,
      p_children: 0,
    });
    const freeAfter =
      (after.data as Array<{ room_type_id: string; units_free: number }>).find(
        (r) => r.room_type_id === rt!.id
      )?.units_free ?? 0;

    expect(freeAfter).toBe(freeBefore - 1);

    // Aucun blocage : une réservation téléphonique ne doit jamais expirer seule.
    const { data: row } = await manager
      .from("reservations")
      .select("hold_expires_at, source")
      .eq("id", created.reservation_id)
      .single();
    expect(row!.hold_expires_at).toBeNull();
    expect(row!.source).toBe("phone");

    await manager
      .from("reservations")
      .update({ status: "cancelled", cancellation_reason: "test" })
      .eq("id", created.reservation_id);
  });
});

describe("l'annulation libère l'inventaire — même sous session du personnel", () => {
  /**
   * NON-RÉGRESSION. `tg_release_nights` n'était pas SECURITY DEFINER : sous la
   * session d'un membre du personnel, son DELETE tombait sous les RLS de
   * `reservation_nights`, table qui n'a volontairement aucune policy de
   * suppression. Le déclencheur supprimait donc ZÉRO ligne, sans erreur : la
   * réservation passait en « annulée » et la chambre restait immobilisée
   * indéfiniment.
   *
   * Le défaut échappait aux autres tests parce qu'ils basculaient le statut en
   * superutilisateur, qui ignore les RLS. Ce test-ci passe obligatoirement par
   * une vraie session — c'est la seule façon de le voir.
   */
  const iso = (days: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };

  it("remet la chambre en vente après une annulation faite au back-office", async () => {
    const { data: rt } = await receptionist
      .from("room_types")
      .select("id")
      .eq("slug", "chambre-familiale")
      .single();

    const checkIn = iso(345);
    const checkOut = iso(347);

    const free = async () => {
      const { data } = await receptionist.rpc("get_availability", {
        p_check_in: checkIn,
        p_check_out: checkOut,
        p_adults: 1,
        p_children: 0,
      });
      return (
        (data as Array<{ room_type_id: string; units_free: number }>).find(
          (r) => r.room_type_id === rt!.id
        )?.units_free ?? 0
      );
    };

    const before = await free();

    const { data: created } = await receptionist.rpc("create_desk_reservation", {
      p_room_type_id: rt!.id,
      p_check_in: checkIn,
      p_check_out: checkOut,
      p_adults: 2,
      p_children: 0,
      p_guest_first_name: "Liberation",
      p_guest_last_name: "Inventaire",
      p_guest_email: "",
      p_guest_phone: "+225 07 00 00 00 00",
      p_guest_notes: null,
      p_locale: "fr",
      p_source: "desk",
      p_mark_confirmed: true,
      p_amount_paid_xof: 0,
    });

    const id = (created as { reservation_id: string }).reservation_id;
    expect(await free()).toBe(before - 1);

    // Bascule faite AVEC la session de la réceptionniste, pas en superutilisateur.
    const { data: row } = await receptionist
      .from("reservations")
      .select("version")
      .eq("id", id)
      .single();

    const { error } = await receptionist.rpc("cancel_reservation", {
      p_reservation_id: id,
      p_reason: "Test de libération d'inventaire",
      p_expected_version: row!.version,
    });
    expect(error).toBeNull();

    expect(await free()).toBe(before);
  });
});
