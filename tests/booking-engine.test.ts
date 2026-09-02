import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Client, Pool } from "pg";

/**
 * Tests du moteur de réservation, exécutés contre une vraie base Postgres.
 *
 * POURQUOI PAS DE SIMULACRE (MOCK) ?
 * Parce que ce qu'on veut prouver ici — l'impossibilité du surbooking — repose
 * entièrement sur des mécanismes Postgres : verrou consultatif, contrainte
 * d'unicité, atomicité transactionnelle. Un simulacre testerait notre idée du
 * comportement de la base, pas la base. Le seul test qui a de la valeur est
 * celui qui ouvre deux connexions réelles et les fait se concurrencer.
 *
 * Prérequis : `npm run db:start` (Supabase local).
 */

const CONNECTION =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

const pool = new Pool({ connectionString: CONNECTION, max: 10 });

/** Identifiants de catégories, résolus une fois pour toutes. */
const rooms: Record<string, string> = {};

/**
 * Base des dates de test : assez loin pour ne croiser aucune réservation du jeu
 * de démonstration (qui couvre J-95 à J+55), assez proche pour rester sous la
 * limite `max_advance_days` de 365 jours, décalages compris (jusqu'à FAR+104).
 */
const FAR = 200;

function isoInDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function q<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const res = await pool.query(sql, params);
  return res.rows as T[];
}

/** Supprime les réservations créées par les tests, sans toucher au jeu de démo. */
async function cleanup() {
  await q(
    `delete from reservations where guest_email like '%@test.invalid'`
  );
}

beforeAll(async () => {
  const rows = await q<{ slug: string; id: string }>(
    `select slug, id from room_types`
  );
  for (const row of rows) rooms[row.slug] = row.id;

  expect(Object.keys(rooms).length).toBeGreaterThan(0);
});

beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  await pool.end();
});

async function hold(opts: {
  slug: string;
  checkIn: string;
  checkOut: string;
  email?: string;
  adults?: number;
  children?: number;
}) {
  const rows = await q<{ create_reservation_hold: Record<string, unknown> }>(
    `select create_reservation_hold(
       $1::uuid, $2::date, $3::date, $4::int, $5::int,
       'Test', 'Client', $6::text, '+225 07 00 00 00 00',
       null, null, 'fr', 'web'
     )`,
    [
      rooms[opts.slug],
      opts.checkIn,
      opts.checkOut,
      opts.adults ?? 1,
      opts.children ?? 0,
      opts.email ?? `client${Math.random()}@test.invalid`,
    ]
  );
  return rows[0]!.create_reservation_hold as {
    reservation_id: string;
    reference: string;
    public_token: string;
    quote: { total_xof: number; deposit_xof: number; nights: number };
  };
}

async function unitsFree(slug: string, checkIn: string, checkOut: string) {
  const rows = await q<{ units_free: number }>(
    `select units_free from get_availability($1::date, $2::date, 1, 0)
     where room_type_id = $3::uuid`,
    [checkIn, checkOut, rooms[slug]]
  );
  return rows[0]?.units_free ?? 0;
}

describe("quote_stay — calcul du tarif", () => {
  it("multiplie le tarif de base par le nombre de nuits", async () => {
    const checkIn = isoInDays(FAR);
    const checkOut = isoInDays(FAR + 3);

    const [row] = await q<{ quote_stay: { total_xof: number; nights: number } }>(
      `select quote_stay($1::uuid, $2::date, $3::date, 1, 0)`,
      [rooms["chambre-standard"], checkIn, checkOut]
    );
    const [base] = await q<{ base_price_xof: number }>(
      `select base_price_xof from room_types where slug = 'chambre-standard'`
    );

    expect(row!.quote_stay.nights).toBe(3);
    expect(row!.quote_stay.total_xof).toBe(base!.base_price_xof * 3);
  });

  it("arrondit l'acompte à la centaine de francs supérieure", async () => {
    const [row] = await q<{
      quote_stay: { deposit_xof: number; total_xof: number };
    }>(`select quote_stay($1::uuid, $2::date, $3::date, 1, 0)`, [
      rooms["chambre-standard"],
      isoInDays(FAR),
      isoInDays(FAR + 1),
    ]);

    const { deposit_xof, total_xof } = row!.quote_stay;
    expect(deposit_xof % 100).toBe(0);
    expect(deposit_xof).toBeLessThanOrEqual(total_xof);
    // Contrainte CinetPay : montant multiple de 5.
    expect(deposit_xof % 5).toBe(0);
  });

  it("refuse une date d'arrivée passée", async () => {
    await expect(
      q(`select quote_stay($1::uuid, $2::date, $3::date, 1, 0)`, [
        rooms["chambre-standard"],
        isoInDays(-2),
        isoInDays(1),
      ])
    ).rejects.toThrow(/DATE_IN_PAST/);
  });

  it("refuse un dépassement de capacité", async () => {
    await expect(
      q(`select quote_stay($1::uuid, $2::date, $3::date, 6, 0)`, [
        rooms["chambre-standard"],
        isoInDays(FAR),
        isoInDays(FAR + 1),
      ])
    ).rejects.toThrow(/CAPACITY_EXCEEDED/);
  });
});

describe("disponibilité", () => {
  it("décrémente le stock après une réservation", async () => {
    const checkIn = isoInDays(FAR + 10);
    const checkOut = isoInDays(FAR + 12);

    const before = await unitsFree("suite-relais", checkIn, checkOut);
    await hold({ slug: "suite-relais", checkIn, checkOut });
    const after = await unitsFree("suite-relais", checkIn, checkOut);

    expect(after).toBe(before - 1);
  });

  it("laisse la nuit du départ disponible pour un autre client", async () => {
    // Intervalle semi-ouvert [arrivée, départ) : un client qui part le 10 et un
    // autre qui arrive le 10 doivent pouvoir partager la même unité.
    const day = FAR + 20;
    await hold({
      slug: "suite-relais",
      checkIn: isoInDays(day),
      checkOut: isoInDays(day + 2),
    });

    const nights = await q<{ night: string; units_sold: number }>(
      `select night::text, units_sold from nightly_availability($1::uuid, $2::date, $3::date)`,
      [rooms["suite-relais"], isoInDays(day), isoInDays(day + 3)]
    );

    // Deux nuits vendues, la troisième (nuit du départ) reste libre.
    expect(nights.map((n) => n.units_sold)).toEqual([1, 1, 0]);
  });

  it("libère l'inventaire à l'annulation", async () => {
    const checkIn = isoInDays(FAR + 30);
    const checkOut = isoInDays(FAR + 32);

    const before = await unitsFree("suite-relais", checkIn, checkOut);
    const res = await hold({ slug: "suite-relais", checkIn, checkOut });
    expect(await unitsFree("suite-relais", checkIn, checkOut)).toBe(before - 1);

    await q(`update reservations set status = 'cancelled' where id = $1`, [
      res.reservation_id,
    ]);

    expect(await unitsFree("suite-relais", checkIn, checkOut)).toBe(before);
  });

  it("respecte une fermeture à la vente", async () => {
    const checkIn = isoInDays(FAR + 40);
    const checkOut = isoInDays(FAR + 41);

    await q(
      `insert into inventory_calendar (room_type_id, night, is_closed)
       values ($1::uuid, $2::date, true)
       on conflict (room_type_id, night) do update set is_closed = true`,
      [rooms["chambre-confort"], checkIn]
    );

    const [row] = await q<{ is_available: boolean; reason: string }>(
      `select is_available, reason from get_availability($1::date, $2::date, 1, 0)
       where room_type_id = $3::uuid`,
      [checkIn, checkOut, rooms["chambre-confort"]]
    );

    expect(row!.is_available).toBe(false);
    expect(row!.reason).toBe("CLOSED");

    await q(
      `delete from inventory_calendar where room_type_id = $1::uuid and night = $2::date`,
      [rooms["chambre-confort"], checkIn]
    );
  });
});

describe("surbooking — le cœur du sujet", () => {
  it("refuse la réservation au-delà du stock", async () => {
    const checkIn = isoInDays(FAR + 50);
    const checkOut = isoInDays(FAR + 51);

    const [rt] = await q<{ total_units: number }>(
      `select total_units from room_types where slug = 'suite-relais'`
    );

    // On vend toutes les unités.
    for (let i = 0; i < rt!.total_units; i++) {
      await hold({ slug: "suite-relais", checkIn, checkOut });
    }

    expect(await unitsFree("suite-relais", checkIn, checkOut)).toBe(0);

    await expect(
      hold({ slug: "suite-relais", checkIn, checkOut })
    ).rejects.toThrow(/ROOM_UNAVAILABLE/);
  });

  it("n'attribue la dernière chambre qu'à UN SEUL de deux clients simultanés", async () => {
    const checkIn = isoInDays(FAR + 60);
    const checkOut = isoInDays(FAR + 61);

    const [rt] = await q<{ total_units: number }>(
      `select total_units from room_types where slug = 'suite-relais'`
    );

    // On ne laisse qu'une seule unité disponible.
    for (let i = 0; i < rt!.total_units - 1; i++) {
      await hold({ slug: "suite-relais", checkIn, checkOut });
    }
    expect(await unitsFree("suite-relais", checkIn, checkOut)).toBe(1);

    // Deux connexions DISTINCTES, lancées en parallèle : c'est la situation
    // réelle de deux visiteurs qui cliquent à la même seconde.
    const race = async (email: string) => {
      const client = new Client({ connectionString: CONNECTION });
      await client.connect();
      try {
        await client.query(
          `select create_reservation_hold(
             $1::uuid, $2::date, $3::date, 1, 0,
             'Course', 'Simultanee', $4::text, '+225 07 00 00 00 00',
             null, null, 'fr', 'web')`,
          [rooms["suite-relais"], checkIn, checkOut, email]
        );
        return "ok" as const;
      } catch (error) {
        return (error as Error).message;
      } finally {
        await client.end();
      }
    };

    const results = await Promise.all([
      race("course1@test.invalid"),
      race("course2@test.invalid"),
    ]);

    const winners = results.filter((r) => r === "ok");
    const losers = results.filter((r) => r !== "ok");

    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(losers[0]).toMatch(/ROOM_UNAVAILABLE/);
    expect(await unitsFree("suite-relais", checkIn, checkOut)).toBe(0);
  });

  it("garde la même unité sur toutes les nuits d'un séjour", async () => {
    const res = await hold({
      slug: "chambre-confort",
      checkIn: isoInDays(FAR + 70),
      checkOut: isoInDays(FAR + 74),
    });

    const slots = await q<{ unit_slot: number }>(
      `select distinct unit_slot from reservation_nights where reservation_id = $1`,
      [res.reservation_id]
    );

    // Le client ne change pas de chambre au milieu de son séjour.
    expect(slots).toHaveLength(1);
  });
});

describe("holds et paiement", () => {
  it("libère l'inventaire quand le hold expire", async () => {
    const checkIn = isoInDays(FAR + 80);
    const checkOut = isoInDays(FAR + 81);

    const before = await unitsFree("suite-relais", checkIn, checkOut);
    const res = await hold({ slug: "suite-relais", checkIn, checkOut });
    expect(await unitsFree("suite-relais", checkIn, checkOut)).toBe(before - 1);

    // On simule l'écoulement du délai plutôt que d'attendre 20 minutes.
    await q(
      `update reservations set hold_expires_at = now() - interval '1 minute' where id = $1`,
      [res.reservation_id]
    );

    const [expired] = await q<{ expire_stale_holds: number }>(
      `select expire_stale_holds()`
    );
    expect(expired!.expire_stale_holds).toBeGreaterThanOrEqual(1);
    expect(await unitsFree("suite-relais", checkIn, checkOut)).toBe(before);
  });

  it("confirme le paiement et reste idempotent si le webhook est rejoué", async () => {
    const res = await hold({
      slug: "chambre-standard",
      checkIn: isoInDays(FAR + 90),
      checkOut: isoInDays(FAR + 92),
    });

    const key = `test:paid:${res.reference}`;
    const call = () =>
      q<{ confirm_reservation_payment: { duplicate: boolean; status: string } }>(
        `select confirm_reservation_payment(
           $1::uuid, 'mock', $2::text, 'orange_money', $3::int, $4::text, null)`,
        [res.reservation_id, `REF-${res.reference}`, res.quote.deposit_xof, key]
      );

    const [first] = await call();
    expect(first!.confirm_reservation_payment.duplicate).toBe(false);
    expect(first!.confirm_reservation_payment.status).toBe("confirmed");

    // Rejeu du MÊME webhook : aucun second encaissement.
    const [second] = await call();
    expect(second!.confirm_reservation_payment.duplicate).toBe(true);

    const [reservation] = await q<{
      amount_paid_xof: number;
      status: string;
      hold_expires_at: string | null;
    }>(
      `select amount_paid_xof, status::text, hold_expires_at from reservations where id = $1`,
      [res.reservation_id]
    );

    expect(reservation!.amount_paid_xof).toBe(res.quote.deposit_xof);
    expect(reservation!.status).toBe("confirmed");
    expect(reservation!.hold_expires_at).toBeNull();

    // Une seule ligne de paiement encaissé.
    const payments = await q(
      `select id from payments where reservation_id = $1 and status = 'succeeded'`,
      [res.reservation_id]
    );
    expect(payments).toHaveLength(1);
  });

  it("ne libère pas la chambre sur un échec de paiement tant que le hold court", async () => {
    const checkIn = isoInDays(FAR + 100);
    const checkOut = isoInDays(FAR + 101);

    const before = await unitsFree("suite-relais", checkIn, checkOut);
    const res = await hold({ slug: "suite-relais", checkIn, checkOut });

    await q(
      `select fail_reservation_payment(
         $1::uuid, 'mock', $2::text, $3::int, $4::text, 'Solde insuffisant', null)`,
      [
        res.reservation_id,
        `REF-${res.reference}`,
        res.quote.deposit_xof,
        `test:fail:${res.reference}`,
      ]
    );

    // Le client doit pouvoir réessayer : la chambre lui reste réservée.
    expect(await unitsFree("suite-relais", checkIn, checkOut)).toBe(before - 1);

    const [reservation] = await q<{ status: string }>(
      `select status::text from reservations where id = $1`,
      [res.reservation_id]
    );
    expect(reservation!.status).toBe("pending_payment");
  });
});

describe("les réglages du back-office pilotent réellement le moteur", () => {
  /**
   * Ce que le gérant modifie dans l'écran Paramètres doit changer le calcul,
   * pas seulement l'affichage. Sans ce test, rien n'empêcherait qu'une valeur
   * finisse un jour codée en dur dans l'application, et l'écran deviendrait
   * décoratif sans que personne ne s'en aperçoive.
   */
  async function setSetting(key: string, value: string) {
    await q(`update settings set value = $1::jsonb where key = $2`, [value, key]);
  }

  it("l'acompte suit le pourcentage réglé", async () => {
    const checkIn = isoInDays(FAR + 60);
    const checkOut = isoInDays(FAR + 62);

    await setSetting("deposit_percent", "30");
    const [a] = await q<{ quote_stay: { deposit_xof: number; total_xof: number } }>(
      `select quote_stay($1::uuid, $2::date, $3::date, 1, 0)`,
      [rooms["chambre-confort"], checkIn, checkOut]
    );

    await setSetting("deposit_percent", "50");
    const [b] = await q<{ quote_stay: { deposit_xof: number; total_xof: number } }>(
      `select quote_stay($1::uuid, $2::date, $3::date, 1, 0)`,
      [rooms["chambre-confort"], checkIn, checkOut]
    );

    expect(b!.quote_stay.deposit_xof).toBeGreaterThan(a!.quote_stay.deposit_xof);
    // Toujours arrondi à la centaine, donc toujours compatible CinetPay.
    expect(b!.quote_stay.deposit_xof % 100).toBe(0);
    expect(b!.quote_stay.deposit_xof).toBeLessThanOrEqual(b!.quote_stay.total_xof);

    await setSetting("deposit_percent", "30");
  });

  it("le séjour minimum est appliqué", async () => {
    await setSetting("min_nights", "2");

    await expect(
      q(`select quote_stay($1::uuid, $2::date, $3::date, 1, 0)`, [
        rooms["chambre-standard"],
        isoInDays(FAR + 70),
        isoInDays(FAR + 71),
      ])
    ).rejects.toThrow(/MIN_NIGHTS/);

    await setSetting("min_nights", "1");
  });

  it("la fenêtre de réservation est appliquée", async () => {
    await setSetting("max_advance_days", "30");

    await expect(
      q(`select quote_stay($1::uuid, $2::date, $3::date, 1, 0)`, [
        rooms["chambre-standard"],
        isoInDays(FAR),
        isoInDays(FAR + 1),
      ])
    ).rejects.toThrow(/TOO_FAR_AHEAD/);

    await setSetting("max_advance_days", "365");
  });
});
