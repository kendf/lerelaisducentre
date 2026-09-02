-- =============================================================================
-- Hôtel Le Relais du Centre — Verrouillage des droits d'exécution
--
-- CORRECTIF DE SÉCURITÉ.
--
-- La migration 0002 se terminait par :
--     revoke execute on all functions in schema public from anon, authenticated;
--
-- Cette instruction ne retirait RIEN. PostgreSQL accorde EXECUTE au pseudo-rôle
-- `PUBLIC` — « tout le monde » — sur chaque fonction créée. Révoquer nommément
-- `anon` et `authenticated` laisse intact le droit hérité de `PUBLIC`.
--
-- Conséquence constatée en conditions réelles sur le projet cloud : avec la
-- seule clé anonyme (qui est, par nature, lisible dans le navigateur), on
-- pouvait appeler `confirm_reservation_payment` — donc marquer n'importe quelle
-- réservation comme payée sans avoir rien réglé — et déclencher
-- `expire_stale_holds`.
--
-- Ce fichier révoque depuis `PUBLIC`, puis réaccorde nommément et uniquement ce
-- qui doit l'être. Un test de non-régression accompagne ce correctif
-- (tests/function-privileges.test.ts) : il appelle chaque fonction privilégiée
-- sous le rôle `anon` et exige un refus.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Table rase sur nos propres fonctions
-- -----------------------------------------------------------------------------
-- Les fonctions appartenant à une extension (pgcrypto, pg_graphql…) sont
-- exclues : leur retirer EXECUTE casserait des valeurs par défaut de colonnes
-- et des mécanismes internes de Supabase.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
    where n.nspname = 'public'
      and d.objid is null
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated',
      r.signature
    );
  end loop;
end;
$$;

-- Les fonctions créées par les migrations À VENIR n'accorderont plus rien à
-- PUBLIC par défaut : le correctif ne dépend pas de la vigilance du prochain
-- développeur.
alter default privileges in schema public revoke execute on functions from public;

-- -----------------------------------------------------------------------------
-- 2. Réouverture explicite — site public
-- -----------------------------------------------------------------------------
-- Lecture seule : catalogue, disponibilité et devis. Aucune de ces fonctions
-- n'écrit en base.
grant execute on function public.get_availability(date, date, integer, integer)
  to anon, authenticated;
grant execute on function public.nightly_availability(uuid, date, date)
  to anon, authenticated;
grant execute on function public.quote_stay(uuid, date, date, integer, integer)
  to anon, authenticated;

-- Lecture d'une réservation par jeton aléatoire : sans le jeton, rien n'est
-- accessible, et la fonction ne renvoie ni téléphone ni e-mail.
grant execute on function public.get_reservation_public(uuid)
  to anon, authenticated;

-- Les deux seules écritures ouvertes au public. Toutes deux valident leurs
-- entrées et sont transactionnelles.
grant execute on function public.create_reservation_hold(
  uuid, date, date, integer, integer, text, text, text, text, text, text, text, reservation_source
) to anon, authenticated;
grant execute on function public.submit_contact_message(text, text, text, text, text, text)
  to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Réouverture explicite — personnel authentifié
-- -----------------------------------------------------------------------------
-- Ces fonctions vérifient le rôle en interne (is_staff / is_manager). Le droit
-- d'exécution n'est qu'une première barrière : la seconde est dans le corps.
grant execute on function public.current_staff_role()                to authenticated;
grant execute on function public.is_staff()                          to authenticated;
grant execute on function public.is_manager()                        to authenticated;
grant execute on function public.cancel_reservation(uuid, text, integer) to authenticated;
grant execute on function public.occupancy_stats(date, date)         to authenticated;
grant execute on function public.set_inventory_block(uuid, date, date, smallint, boolean, text)
  to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Ce qui reste fermé à tout le monde — et pourquoi
-- -----------------------------------------------------------------------------
-- confirm_reservation_payment : confirme un encaissement. Appelable uniquement
--   par le webhook, avec la clé service_role qui n'existe que côté serveur.
-- fail_reservation_payment    : idem, côté échec.
-- expire_stale_holds          : modifie l'inventaire. Réservée au cron serveur.
-- get_setting                 : lit la table settings en SECURITY DEFINER, donc
--   hors RLS — elle exposerait les réglages internes (durée de blocage,
--   fenêtre de réservation). Le site public lit `settings` directement, filtré
--   par la policy `is_public`.
-- hotel_today                 : sans risque, mais rien ne la rend nécessaire au
--   navigateur, qui calcule sa propre date.
-- tg_*                        : fonctions de déclencheur, jamais appelées
--   directement.
--
-- Aucun GRANT ci-dessus ne les concerne : elles sont désormais inaccessibles
-- aux rôles anon et authenticated.
