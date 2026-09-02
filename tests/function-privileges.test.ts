import { afterAll, describe, expect, it } from "vitest";
import { Pool } from "pg";

/**
 * Droits d'exécution des fonctions — test de NON-RÉGRESSION.
 *
 * Ce fichier existe à cause d'un vrai défaut, découvert en interrogeant le
 * projet cloud avec la seule clé anonyme : `confirm_reservation_payment` était
 * exécutable par n'importe qui. Autrement dit, on pouvait marquer une
 * réservation comme payée sans rien régler.
 *
 * La cause : PostgreSQL accorde EXECUTE au pseudo-rôle `PUBLIC` sur toute
 * fonction créée. Révoquer nommément `anon` ne retire pas ce droit hérité.
 * Corrigé par la migration 0004.
 *
 * Chaque test prend le rôle `anon` — exactement ce que fait PostgREST quand une
 * requête arrive avec la clé publique — et vérifie le refus. La connexion
 * `postgres` étant superutilisateur, elle ignorerait les droits : le
 * changement de rôle est indispensable pour que ce test ait un sens.
 */

const CONNECTION =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

const pool = new Pool({ connectionString: CONNECTION, max: 5 });

afterAll(async () => {
  await pool.end();
});

/** Exécute une requête sous le rôle indiqué, puis annule la transaction. */
async function asRole<T = Record<string, unknown>>(
  role: string,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`set local role ${role}`);
    const res = await client.query(sql, params);
    return res.rows as T[];
  } finally {
    await client.query("rollback").catch(() => {});
    client.release();
  }
}

const NIL = "00000000-0000-0000-0000-000000000000";

/**
 * Fonctions qui ne doivent JAMAIS être atteignables depuis le navigateur.
 * Elles écrivent de l'argent ou de l'inventaire, ou lisent hors RLS.
 */
const FORBIDDEN_FOR_ANON: Array<[string, string, unknown[]]> = [
  [
    "confirm_reservation_payment",
    `select confirm_reservation_payment($1::uuid,'x','x','x',1,'k',null)`,
    [NIL],
  ],
  [
    "fail_reservation_payment",
    `select fail_reservation_payment($1::uuid,'x','x',1,'k',null,null)`,
    [NIL],
  ],
  ["expire_stale_holds", `select expire_stale_holds()`, []],
  ["get_setting", `select get_setting('hold_minutes')`, []],
  ["occupancy_stats", `select occupancy_stats(current_date, current_date + 1)`, []],
  [
    "cancel_reservation",
    `select cancel_reservation($1::uuid, 'x', 1)`,
    [NIL],
  ],
  [
    "set_inventory_block",
    `select set_inventory_block($1::uuid, current_date, current_date + 1, null, true, null)`,
    [NIL],
  ],
];

describe("le rôle anon ne peut pas exécuter les fonctions privilégiées", () => {
  for (const [name, sql, params] of FORBIDDEN_FOR_ANON) {
    it(`refuse ${name}`, async () => {
      await expect(asRole("anon", sql, params)).rejects.toThrow(
        /permission denied for function/i
      );
    });
  }
});

describe("le rôle anon conserve l'accès à ce dont le site a besoin", () => {
  it("peut consulter la disponibilité", async () => {
    const rows = await asRole(
      "anon",
      `select * from get_availability(current_date + 30, current_date + 32, 1, 0)`
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it("peut demander un devis", async () => {
    const [row] = await asRole<{ quote_stay: { total_xof: number } }>(
      "anon",
      `select quote_stay(
         (select id from room_types where slug = 'chambre-standard'),
         current_date + 30, current_date + 32, 1, 0)`
    );
    expect(row!.quote_stay.total_xof).toBeGreaterThan(0);
  });

  it("peut créer une pré-réservation", async () => {
    const rows = await asRole(
      "anon",
      `select create_reservation_hold(
         (select id from room_types where slug = 'chambre-standard'),
         current_date + 120, current_date + 121, 1, 0,
         'Anon', 'Test', 'anon@test.invalid', '+225 07 00 00 00 00',
         null, null, 'fr', 'web')`
    );
    expect(rows).toHaveLength(1);
  });
});

describe("le rôle anon ne voit aucune donnée client", () => {
  const CONFIDENTIAL = [
    "reservations",
    "reservation_nights",
    "payments",
    "inventory_calendar",
    "contact_messages",
    "audit_log",
    "notifications_log",
    "profiles",
  ];

  for (const table of CONFIDENTIAL) {
    it(`ne lit rien dans ${table}`, async () => {
      // Les policies RLS ne renvoient aucune ligne plutôt qu'une erreur : c'est
      // le comportement attendu de PostgreSQL, et il suffit — l'important est
      // qu'aucune donnée ne sorte.
      const rows = await asRole("anon", `select * from ${table} limit 1`);
      expect(rows).toHaveLength(0);
    });
  }

  it("ne voit que les réglages marqués publics", async () => {
    const rows = await asRole<{ key: string; is_public: boolean }>(
      "anon",
      `select key, is_public from settings`
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.is_public)).toBe(true);
  });
});
