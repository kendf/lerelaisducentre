-- =============================================================================
-- Hôtel Le Relais du Centre — Moteur de réservation
--
-- POURQUOI EN SQL ET PAS EN TYPESCRIPT ?
-- Parce que la disponibilité est une ressource concurrente. Entre le moment où
-- l'application lit « il reste 1 chambre » et celui où elle écrit la
-- réservation, un autre visiteur peut avoir réservé. Seule une transaction
-- Postgres — verrou + lecture + écriture dans le même bloc atomique — élimine
-- cette fenêtre. Le calcul de prix vit au même endroit pour la même raison :
-- le montant inséré est celui qui vient d'être calculé, pas celui qu'un
-- navigateur a renvoyé.
--
-- CONVENTION D'ERREUR : les fonctions lèvent des exceptions dont le message
-- est un code stable (ROOM_UNAVAILABLE, INVALID_DATES...). La couche
-- TypeScript le traduit en message FR/EN. Jamais de message technique montré
-- au client.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function public.get_setting(p_key text, p_default jsonb default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.settings where key = p_key), p_default);
$$;

-- Date « aujourd'hui » côté hôtel. Africa/Abidjan est en UTC+0 sans heure
-- d'été : aucun saut de date possible, mais on l'écrit explicitement pour que
-- le code reste juste si l'hôtel ouvre un jour ailleurs.
create or replace function public.hotel_today()
returns date language sql stable as $$
  select (now() at time zone 'Africa/Abidjan')::date;
$$;

-- -----------------------------------------------------------------------------
-- Disponibilité nuit par nuit
-- -----------------------------------------------------------------------------
-- Intervalle semi-ouvert : [p_from, p_to). La nuit du départ n'est pas
-- occupée, donc un client qui part le 10 et un autre qui arrive le 10
-- partagent la même chambre sans conflit.
create or replace function public.nightly_availability(
  p_room_type_id uuid,
  p_from date,
  p_to   date
)
returns table (
  night          date,
  units_open     smallint,
  units_sold     integer,
  units_free     integer,
  price_xof      integer,
  is_closed      boolean
)
language sql stable security definer set search_path = public as $$
  select
    d.night::date,
    coalesce(ic.units_override, rt.total_units)                              as units_open,
    coalesce(sold.n, 0)::integer                                             as units_sold,
    (coalesce(ic.units_override, rt.total_units) - coalesce(sold.n, 0))::integer as units_free,
    coalesce(ic.price_override_xof, rt.base_price_xof)                       as price_xof,
    coalesce(ic.is_closed, false)                                            as is_closed
  from generate_series(p_from, p_to - 1, interval '1 day') as d(night)
  cross join public.room_types rt
  left join public.inventory_calendar ic
    on ic.room_type_id = rt.id and ic.night = d.night::date
  left join lateral (
    select count(*) as n
    from public.reservation_nights rn
    where rn.room_type_id = rt.id and rn.night = d.night::date
  ) sold on true
  where rt.id = p_room_type_id
  order by d.night;
$$;

-- Disponibilité de toutes les catégories publiées pour un séjour donné.
-- Alimente la page « Réserver » (CDC §3.2) et le calendrier de disponibilité.
create or replace function public.get_availability(
  p_check_in  date,
  p_check_out date,
  p_adults    integer default 1,
  p_children  integer default 0
)
returns table (
  room_type_id     uuid,
  slug             text,
  content          jsonb,
  base_price_xof   integer,
  max_adults       smallint,
  max_children     smallint,
  units_free       integer,
  total_price_xof  integer,
  is_available     boolean,
  reason           text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_check_out <= p_check_in then
    raise exception 'INVALID_DATES';
  end if;

  return query
  select
    rt.id,
    rt.slug,
    rt.content,
    rt.base_price_xof,
    rt.max_adults,
    rt.max_children,
    greatest(coalesce(a.min_free, 0), 0)::integer as units_free,
    coalesce(a.total_price, 0)::integer           as total_price_xof,
    (
      coalesce(a.min_free, 0) > 0
      and not coalesce(a.any_closed, false)
      and p_adults   <= rt.max_adults
      and p_children <= rt.max_children
    ) as is_available,
    case
      when coalesce(a.any_closed, false)              then 'CLOSED'
      when coalesce(a.min_free, 0) <= 0               then 'SOLD_OUT'
      when p_adults > rt.max_adults
        or p_children > rt.max_children               then 'CAPACITY'
      else null
    end as reason
  from public.room_types rt
  left join lateral (
    select
      min(na.units_free) as min_free,
      sum(na.price_xof)  as total_price,
      bool_or(na.is_closed) as any_closed
    from public.nightly_availability(rt.id, p_check_in, p_check_out) na
  ) a on true
  where rt.is_published
  order by rt.sort_order, rt.base_price_xof;
end;
$$;

-- -----------------------------------------------------------------------------
-- Devis : le tarif fait foi côté serveur, jamais côté navigateur
-- -----------------------------------------------------------------------------
create or replace function public.quote_stay(
  p_room_type_id uuid,
  p_check_in     date,
  p_check_out    date,
  p_adults       integer default 1,
  p_children     integer default 0
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_rt          public.room_types%rowtype;
  v_min_nights  integer := coalesce((public.get_setting('min_nights', '1'::jsonb))::text::integer, 1);
  v_max_nights  integer := coalesce((public.get_setting('max_nights', '30'::jsonb))::text::integer, 30);
  v_max_advance integer := coalesce((public.get_setting('max_advance_days', '365'::jsonb))::text::integer, 365);
  v_deposit_pct integer := coalesce((public.get_setting('deposit_percent', '30'::jsonb))::text::integer, 30);
  v_nights      integer := p_check_out - p_check_in;
  v_breakdown   jsonb;
  v_total       integer;
  v_deposit     integer;
begin
  select * into v_rt from public.room_types where id = p_room_type_id and is_published;
  if not found then
    raise exception 'ROOM_TYPE_NOT_FOUND';
  end if;

  if p_check_out <= p_check_in            then raise exception 'INVALID_DATES';    end if;
  if p_check_in  <  public.hotel_today()  then raise exception 'DATE_IN_PAST';     end if;
  if v_nights    <  v_min_nights          then raise exception 'MIN_NIGHTS';       end if;
  if v_nights    >  v_max_nights          then raise exception 'MAX_NIGHTS';       end if;
  if p_check_in  >  public.hotel_today() + v_max_advance then raise exception 'TOO_FAR_AHEAD'; end if;
  if p_adults    >  v_rt.max_adults
     or p_children > v_rt.max_children    then raise exception 'CAPACITY_EXCEEDED'; end if;

  -- Détail nuit par nuit : c'est ce tableau qui est figé dans la réservation.
  -- Il prépare aussi l'option « tarifs saisonniers » (CDC §3.4) sans rien
  -- changer au reste du moteur — seul price_override_xof entrera en jeu.
  select
    jsonb_agg(jsonb_build_object('night', na.night, 'price_xof', na.price_xof) order by na.night),
    sum(na.price_xof)::integer
  into v_breakdown, v_total
  from public.nightly_availability(p_room_type_id, p_check_in, p_check_out) na;

  if v_total is null then
    raise exception 'INVALID_DATES';
  end if;

  -- Arrondi à la centaine de francs supérieure : un acompte de 8 437 F n'a
  -- aucun sens à un guichet Mobile Money.
  v_deposit := ceil((v_total * v_deposit_pct / 100.0) / 100.0)::integer * 100;
  v_deposit := least(v_deposit, v_total);

  return jsonb_build_object(
    'room_type_id',    v_rt.id,
    'room_type_slug',  v_rt.slug,
    'check_in',        p_check_in,
    'check_out',       p_check_out,
    'nights',          v_nights,
    'currency',        'XOF',
    'breakdown',       v_breakdown,
    'total_xof',       v_total,
    'deposit_xof',     v_deposit,
    'deposit_percent', v_deposit_pct,
    'balance_xof',     v_total - v_deposit
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Création d'une pré-réservation (hold) — LE POINT CRITIQUE DU PROJET
-- -----------------------------------------------------------------------------
-- Deux protections superposées, volontairement redondantes :
--
--   1. pg_advisory_xact_lock sérialise les demandes concurrentes portant sur
--      la MÊME catégorie de chambre. Deux visiteurs qui cliquent à la même
--      seconde sont traités l'un après l'autre : le premier obtient la
--      chambre, le second reçoit un refus propre — pas une erreur technique,
--      pas deux réservations. Le verrou est libéré à la fin de la transaction,
--      quoi qu'il arrive (commit, erreur, déconnexion).
--
--   2. La contrainte UNIQUE sur reservation_nights est le filet de dernier
--      recours : si un jour du code contourne cette fonction, la base refuse
--      quand même le surbooking.
--
-- La réservation naît en `pending_payment` avec une date d'expiration : elle
-- immobilise l'inventaire le temps du paiement Mobile Money, puis le relâche
-- automatiquement si l'acompte n'arrive pas (voir expire_stale_holds).
create or replace function public.create_reservation_hold(
  p_room_type_id     uuid,
  p_check_in         date,
  p_check_out        date,
  p_adults           integer,
  p_children         integer,
  p_guest_first_name text,
  p_guest_last_name  text,
  p_guest_email      text,
  p_guest_phone      text,
  p_guest_country    text default null,
  p_guest_notes      text default null,
  p_locale           text default 'fr',
  p_source           reservation_source default 'web'
)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_quote        jsonb;
  v_max_units    integer;
  v_slot         smallint;
  v_hold_minutes integer := coalesce((public.get_setting('hold_minutes', '20'::jsonb))::text::integer, 20);
  v_reference    text;
  v_id           uuid;
  v_token        uuid;
  v_expires      timestamptz;
begin
  -- Le devis valide dates, capacité et règles commerciales, et calcule le prix.
  -- S'il lève une exception, rien n'a encore été écrit.
  v_quote := public.quote_stay(p_room_type_id, p_check_in, p_check_out, p_adults, p_children);

  if p_guest_first_name is null or btrim(p_guest_first_name) = ''
     or p_guest_last_name is null or btrim(p_guest_last_name) = ''
     or p_guest_email is null or p_guest_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     or p_guest_phone is null or btrim(p_guest_phone) = '' then
    raise exception 'INVALID_GUEST_DETAILS';
  end if;

  -- (1) Sérialisation des demandes concurrentes sur cette catégorie.
  perform pg_advisory_xact_lock(hashtext('room_type:' || p_room_type_id::text));

  -- Nombre d'unités ouvertes le soir le plus contraint du séjour : c'est la
  -- borne des slots attribuables. Prendre le minimum est conservateur et
  -- correct même si l'inventaire varie d'une nuit à l'autre (travaux, etc.).
  select min(na.units_open) into v_max_units
  from public.nightly_availability(p_room_type_id, p_check_in, p_check_out) na
  where not na.is_closed;

  if v_max_units is null or v_max_units < 1 then
    raise exception 'ROOM_UNAVAILABLE';
  end if;

  -- Plus petit slot libre sur TOUTES les nuits du séjour : le client garde la
  -- même unité du début à la fin, on ne le fait pas changer de chambre.
  select s.slot into v_slot
  from generate_series(0, v_max_units - 1) as s(slot)
  where not exists (
    select 1
    from public.reservation_nights rn
    where rn.room_type_id = p_room_type_id
      and rn.unit_slot    = s.slot
      and rn.night >= p_check_in
      and rn.night <  p_check_out
  )
  order by s.slot
  limit 1;

  if v_slot is null then
    raise exception 'ROOM_UNAVAILABLE';
  end if;

  v_reference := 'RDC-'
    || to_char(now() at time zone 'Africa/Abidjan', 'YYYY') || '-'
    || lpad(nextval('public.reservation_ref_seq')::text, 4, '0');

  v_expires := now() + make_interval(mins => v_hold_minutes);

  insert into public.reservations (
    reference, room_type_id, check_in, check_out, adults, children,
    guest_first_name, guest_last_name, guest_email, guest_phone,
    guest_country, guest_notes, locale, status, source,
    total_amount_xof, deposit_amount_xof, price_breakdown, hold_expires_at
  ) values (
    v_reference, p_room_type_id, p_check_in, p_check_out, p_adults, p_children,
    btrim(p_guest_first_name), btrim(p_guest_last_name), lower(btrim(p_guest_email)),
    btrim(p_guest_phone), p_guest_country, p_guest_notes, p_locale,
    'pending_payment', p_source,
    (v_quote->>'total_xof')::integer,
    (v_quote->>'deposit_xof')::integer,
    v_quote->'breakdown',
    v_expires
  )
  returning id, public_token into v_id, v_token;

  -- (2) Immobilisation effective de l'inventaire.
  insert into public.reservation_nights (reservation_id, room_type_id, night, unit_slot)
  select v_id, p_room_type_id, d.night::date, v_slot
  from generate_series(p_check_in, p_check_out - 1, interval '1 day') as d(night);

  return jsonb_build_object(
    'reservation_id',  v_id,
    'reference',       v_reference,
    'public_token',    v_token,
    'hold_expires_at', v_expires,
    'quote',           v_quote
  );
exception
  -- Si malgré le verrou la contrainte d'unicité saute (bug applicatif ailleurs,
  -- écriture manuelle), on refuse proprement plutôt que de renvoyer une erreur
  -- Postgres brute au visiteur.
  when unique_violation then
    raise exception 'ROOM_UNAVAILABLE';
end;
$$;

-- -----------------------------------------------------------------------------
-- Confirmation après encaissement de l'acompte
-- -----------------------------------------------------------------------------
-- Appelée UNIQUEMENT côté serveur (webhook CinetPay, clé service_role).
-- Idempotente : un webhook rejoué ne double ni le montant encaissé ni la
-- notification. C'est le webhook qui fait foi, pas le retour navigateur du
-- client : si le visiteur ferme son onglet, la réservation se confirme quand même.
create or replace function public.confirm_reservation_payment(
  p_reservation_id  uuid,
  p_provider        text,
  p_provider_ref    text,
  p_method          text,
  p_amount_xof      integer,
  p_idempotency_key text,
  p_raw_payload     jsonb default null
)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_res       public.reservations%rowtype;
  v_existing  public.payments%rowtype;
  v_already   boolean := false;
begin
  select * into v_res from public.reservations where id = p_reservation_id for update;
  if not found then
    raise exception 'RESERVATION_NOT_FOUND';
  end if;

  select * into v_existing from public.payments where idempotency_key = p_idempotency_key;
  if found then
    -- Webhook déjà traité : on renvoie l'état courant sans rien modifier.
    return jsonb_build_object(
      'reservation_id', v_res.id, 'reference', v_res.reference,
      'status', v_res.status, 'duplicate', true
    );
  end if;

  insert into public.payments (
    reservation_id, provider, method, provider_ref, amount_xof,
    status, idempotency_key, raw_payload
  ) values (
    p_reservation_id, p_provider, p_method, p_provider_ref, p_amount_xof,
    'succeeded', p_idempotency_key, p_raw_payload
  );

  v_already := v_res.status = 'confirmed';

  update public.reservations
  set status          = 'confirmed',
      amount_paid_xof = amount_paid_xof + p_amount_xof,
      hold_expires_at = null,
      confirmed_at    = coalesce(confirmed_at, now())
  where id = p_reservation_id;

  return jsonb_build_object(
    'reservation_id', v_res.id, 'reference', v_res.reference,
    'status', 'confirmed', 'duplicate', false, 'was_already_confirmed', v_already
  );
end;
$$;

create or replace function public.fail_reservation_payment(
  p_reservation_id  uuid,
  p_provider        text,
  p_provider_ref    text,
  p_amount_xof      integer,
  p_idempotency_key text,
  p_reason          text default null,
  p_raw_payload     jsonb default null
)
returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  insert into public.payments (
    reservation_id, provider, provider_ref, amount_xof,
    status, idempotency_key, failure_reason, raw_payload
  ) values (
    p_reservation_id, p_provider, p_provider_ref, p_amount_xof,
    'failed', p_idempotency_key, p_reason, p_raw_payload
  )
  on conflict (idempotency_key) do nothing;

  -- On n'annule pas tout de suite : le client peut relancer le paiement tant
  -- que le hold court. C'est l'expiration du hold qui libérera l'inventaire.
end;
$$;

-- -----------------------------------------------------------------------------
-- Expiration des holds — appelée par un cron applicatif toutes les 5 minutes
-- -----------------------------------------------------------------------------
-- Volontairement PAS branchée sur pg_cron : un cron Vercel qui appelle une
-- route serveur ne dépend d'aucune extension Postgres et fonctionne à
-- l'identique en local, en démo et en production.
create or replace function public.expire_stale_holds()
returns integer
language plpgsql volatile security definer set search_path = public as $$
declare
  v_count integer;
begin
  with expired as (
    update public.reservations
    set status = 'expired'
    where status = 'pending_payment'
      and hold_expires_at is not null
      and hold_expires_at < now()
    returning id
  )
  select count(*) into v_count from expired;

  -- Le trigger tg_release_nights a déjà supprimé les nuits correspondantes :
  -- l'inventaire est de nouveau vendable.
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- Actions back-office
-- -----------------------------------------------------------------------------
create or replace function public.current_staff_role()
returns staff_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and is_active;
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_staff_role() is not null;
$$;

create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_staff_role() in ('manager', 'admin');
$$;

-- Annulation depuis le back-office, avec verrouillage optimiste :
-- si un collègue a modifié la fiche entre-temps, l'opération est refusée
-- plutôt que d'écraser son travail (CDC — accès concurrent au back-office).
create or replace function public.cancel_reservation(
  p_reservation_id   uuid,
  p_reason           text,
  p_expected_version integer
)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_res public.reservations%rowtype;
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_res from public.reservations where id = p_reservation_id for update;
  if not found then
    raise exception 'RESERVATION_NOT_FOUND';
  end if;

  if v_res.version <> p_expected_version then
    raise exception 'VERSION_CONFLICT';
  end if;

  if v_res.status in ('cancelled', 'expired') then
    return jsonb_build_object('reservation_id', v_res.id, 'status', v_res.status, 'noop', true);
  end if;

  update public.reservations
  set status = 'cancelled', cancellation_reason = p_reason, cancelled_at = now()
  where id = p_reservation_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values (auth.uid(), 'reservation.cancel', 'reservations', p_reservation_id::text,
          jsonb_build_object('status', v_res.status),
          jsonb_build_object('status', 'cancelled', 'reason', p_reason));

  return jsonb_build_object('reservation_id', v_res.id, 'status', 'cancelled', 'noop', false);
end;
$$;

-- -----------------------------------------------------------------------------
-- Tableau de bord statistique (CDC §3.3, critère de recette §13)
-- -----------------------------------------------------------------------------
-- Le taux d'occupation se lit directement dans reservation_nights : nuits
-- réellement vendues / (unités ouvertes × jours de la période). Aucune
-- reconstitution approximative.
create or replace function public.occupancy_stats(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_capacity     bigint;
  v_sold         bigint;
  v_reservations bigint;
  v_revenue      bigint;
  v_by_type      jsonb;
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN';
  end if;

  select coalesce(sum(rt.total_units), 0) * greatest(p_to - p_from, 0)
  into v_capacity
  from public.room_types rt where rt.is_published;

  select count(*) into v_sold
  from public.reservation_nights rn
  where rn.night >= p_from and rn.night < p_to;

  select count(*), coalesce(sum(r.total_amount_xof), 0)
  into v_reservations, v_revenue
  from public.reservations r
  where r.status in ('confirmed', 'completed')
    and r.check_in >= p_from and r.check_in < p_to;

  select jsonb_agg(jsonb_build_object(
           'room_type_id', t.id, 'slug', t.slug,
           'nights_sold', t.sold, 'capacity', t.capacity
         ) order by t.slug)
  into v_by_type
  from (
    select rt.id, rt.slug,
           coalesce(count(rn.*), 0) as sold,
           rt.total_units::bigint * greatest(p_to - p_from, 0) as capacity
    from public.room_types rt
    left join public.reservation_nights rn
      on rn.room_type_id = rt.id and rn.night >= p_from and rn.night < p_to
    where rt.is_published
    group by rt.id, rt.slug, rt.total_units
  ) t;

  return jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'capacity_nights', v_capacity,
    'sold_nights', v_sold,
    'occupancy_rate', case when v_capacity > 0
                           then round((v_sold::numeric / v_capacity) * 100, 1)
                           else 0 end,
    'reservations', v_reservations,
    'revenue_xof', v_revenue,
    'by_room_type', coalesce(v_by_type, '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Formulaire de contact (CDC §3.2)
-- -----------------------------------------------------------------------------
-- Passe par une fonction plutôt que par une policy d'INSERT anonyme : la table
-- reste totalement fermée en écriture directe, ce qui limite l'exposition en
-- cas de fuite de la clé anon (qui est, par nature, publique).
create or replace function public.submit_contact_message(
  p_name text, p_email text, p_phone text, p_subject text, p_message text, p_locale text default 'fr'
)
returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if btrim(coalesce(p_name, '')) = ''
     or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     or length(btrim(coalesce(p_message, ''))) < 10 then
    raise exception 'INVALID_CONTACT_INPUT';
  end if;

  if length(p_message) > 4000 then
    raise exception 'MESSAGE_TOO_LONG';
  end if;

  insert into public.contact_messages (name, email, phone, subject, message, locale)
  values (btrim(p_name), lower(btrim(p_email)), p_phone, p_subject, btrim(p_message), p_locale);
end;
$$;

-- -----------------------------------------------------------------------------
-- Droits d'exécution
-- -----------------------------------------------------------------------------
-- Par défaut Postgres accorde EXECUTE à PUBLIC sur toute fonction créée. On
-- révoque puis on ouvre explicitement, fonction par fonction : ce qui n'est
-- pas listé ici est inaccessible depuis le navigateur.
revoke execute on all functions in schema public from anon, authenticated;

-- Lecture publique : nécessaire au site vitrine et au tunnel de réservation.
grant execute on function public.get_availability(date, date, integer, integer)   to anon, authenticated;
grant execute on function public.nightly_availability(uuid, date, date)           to anon, authenticated;
grant execute on function public.quote_stay(uuid, date, date, integer, integer)   to anon, authenticated;
grant execute on function public.submit_contact_message(text, text, text, text, text, text) to anon, authenticated;

-- Écriture publique : une seule porte d'entrée, validée et transactionnelle.
grant execute on function public.create_reservation_hold(
  uuid, date, date, integer, integer, text, text, text, text, text, text, text, reservation_source
) to anon, authenticated;

-- Réservé au personnel connecté.
grant execute on function public.cancel_reservation(uuid, text, integer) to authenticated;
grant execute on function public.occupancy_stats(date, date)             to authenticated;
grant execute on function public.current_staff_role()                    to authenticated;
grant execute on function public.is_staff()                              to authenticated;
grant execute on function public.is_manager()                            to authenticated;

-- confirm_reservation_payment, fail_reservation_payment et expire_stale_holds
-- ne sont volontairement accordées à personne : elles ne sont appelables que
-- par le serveur avec la clé service_role (webhook et cron).

-- -----------------------------------------------------------------------------
-- Consultation publique d'une réservation par jeton
-- -----------------------------------------------------------------------------
-- Alimente la page de confirmation et le lien envoyé au client.
--
-- Ne renvoie QUE ce que le client a besoin de relire : ni son numéro de
-- téléphone, ni son adresse e-mail, ni ses notes. Même si le lien est
-- transféré ou retrouvé dans un historique de navigation, il ne divulgue pas
-- de coordonnées exploitables (CDC §9, politique de confidentialité).
create or replace function public.get_reservation_public(p_token uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_res public.reservations%rowtype;
  v_rt  public.room_types%rowtype;
begin
  select * into v_res from public.reservations where public_token = p_token;
  if not found then
    return null;
  end if;

  select * into v_rt from public.room_types where id = v_res.room_type_id;

  return jsonb_build_object(
    'reference',          v_res.reference,
    'status',             v_res.status,
    'check_in',           v_res.check_in,
    'check_out',          v_res.check_out,
    'nights',             v_res.nights,
    'adults',             v_res.adults,
    'children',           v_res.children,
    'guest_first_name',   v_res.guest_first_name,
    'locale',             v_res.locale,
    'room_type',          v_rt.content,
    'room_type_slug',     v_rt.slug,
    'total_amount_xof',   v_res.total_amount_xof,
    'deposit_amount_xof', v_res.deposit_amount_xof,
    'amount_paid_xof',    v_res.amount_paid_xof,
    'hold_expires_at',    v_res.hold_expires_at
  );
end;
$$;

grant execute on function public.get_reservation_public(uuid) to anon, authenticated;
