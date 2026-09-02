-- =============================================================================
-- Hôtel Le Relais du Centre — Réservation prise au comptoir
--
-- Le CDC §1.2 vise à « réduire la charge de traitement manuel (téléphone,
-- WhatsApp) ». Encore faut-il que la réception puisse SAISIR ces appels :
-- sans cela, les réservations téléphoniques restent hors du système et le
-- site continue de vendre des chambres déjà données.
--
-- POURQUOI PAS `create_reservation_hold` ?
-- Parce qu'elle crée un blocage de 20 minutes destiné au paiement en ligne.
-- Une réservation prise au téléphone expirerait donc pendant que la
-- réceptionniste raccroche. Ici, aucun hold : la réservation naît directement
-- « en attente » ou « confirmée », selon que l'acompte a été encaissé ou non.
--
-- CE QUI NE CHANGE PAS : le verrou consultatif, l'attribution d'unité et la
-- contrainte d'unicité. Une réservation au comptoir consomme exactement le même
-- inventaire qu'une réservation web — c'est la seule façon d'empêcher le site
-- de revendre une chambre promise au téléphone.
-- =============================================================================

create or replace function public.create_desk_reservation(
  p_room_type_id     uuid,
  p_check_in         date,
  p_check_out        date,
  p_adults           integer,
  p_children         integer,
  p_guest_first_name text,
  p_guest_last_name  text,
  p_guest_email      text,
  p_guest_phone      text,
  p_guest_notes      text default null,
  p_locale           text default 'fr',
  p_source           reservation_source default 'phone',
  p_mark_confirmed   boolean default false,
  p_amount_paid_xof  integer default 0
)
returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_quote     jsonb;
  v_max_units integer;
  v_slot      smallint;
  v_reference text;
  v_id        uuid;
  v_status    reservation_status;
  v_total     integer;
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN';
  end if;

  if p_source not in ('desk', 'phone') then
    raise exception 'INVALID_SOURCE';
  end if;

  -- Mêmes règles commerciales que le tunnel public : le tarif affiché au
  -- comptoir doit être celui du site, sinon deux clients de la même chambre
  -- paient deux prix différents selon le canal.
  v_quote := public.quote_stay(p_room_type_id, p_check_in, p_check_out, p_adults, p_children);
  v_total := (v_quote->>'total_xof')::integer;

  if p_guest_first_name is null or btrim(p_guest_first_name) = ''
     or p_guest_last_name is null or btrim(p_guest_last_name) = ''
     or p_guest_phone is null or btrim(p_guest_phone) = '' then
    raise exception 'INVALID_GUEST_DETAILS';
  end if;

  -- L'e-mail est facultatif au comptoir : un client de passage n'en donne pas
  -- toujours. S'il est fourni, il doit être valide.
  if p_guest_email is not null and btrim(p_guest_email) <> ''
     and p_guest_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_GUEST_DETAILS';
  end if;

  if p_amount_paid_xof < 0 or p_amount_paid_xof > v_total then
    raise exception 'INVALID_AMOUNT';
  end if;

  perform pg_advisory_xact_lock(hashtext('room_type:' || p_room_type_id::text));

  select min(na.units_open) into v_max_units
  from public.nightly_availability(p_room_type_id, p_check_in, p_check_out) na
  where not na.is_closed;

  if v_max_units is null or v_max_units < 1 then
    raise exception 'ROOM_UNAVAILABLE';
  end if;

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

  v_status := case when p_mark_confirmed then 'confirmed' else 'pending' end;

  v_reference := 'RDC-'
    || to_char(now() at time zone 'Africa/Abidjan', 'YYYY') || '-'
    || lpad(nextval('public.reservation_ref_seq')::text, 4, '0');

  insert into public.reservations (
    reference, room_type_id, check_in, check_out, adults, children,
    guest_first_name, guest_last_name, guest_email, guest_phone,
    guest_notes, locale, status, source,
    total_amount_xof, deposit_amount_xof, amount_paid_xof,
    price_breakdown, hold_expires_at, confirmed_at, created_by
  ) values (
    v_reference, p_room_type_id, p_check_in, p_check_out, p_adults, p_children,
    btrim(p_guest_first_name), btrim(p_guest_last_name),
    nullif(lower(btrim(coalesce(p_guest_email, ''))), ''),
    btrim(p_guest_phone), nullif(btrim(coalesce(p_guest_notes, '')), ''),
    p_locale, v_status, p_source,
    v_total,
    (v_quote->>'deposit_xof')::integer,
    p_amount_paid_xof,
    v_quote->'breakdown',
    -- Aucun blocage : cette réservation ne doit jamais expirer toute seule.
    null,
    case when p_mark_confirmed then now() else null end,
    auth.uid()
  )
  returning id into v_id;

  insert into public.reservation_nights (reservation_id, room_type_id, night, unit_slot)
  select v_id, p_room_type_id, d.night::date, v_slot
  from generate_series(p_check_in, p_check_out - 1, interval '1 day') as d(night);

  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values (auth.uid(), 'reservation.desk_create', 'reservations', v_id::text,
          jsonb_build_object('reference', v_reference, 'source', p_source,
                             'status', v_status, 'total_xof', v_total));

  return jsonb_build_object(
    'reservation_id', v_id,
    'reference',      v_reference,
    'status',         v_status,
    'quote',          v_quote
  );
exception
  when unique_violation then
    raise exception 'ROOM_UNAVAILABLE';
end;
$$;

grant execute on function public.create_desk_reservation(
  uuid, date, date, integer, integer, text, text, text, text, text, text,
  reservation_source, boolean, integer
) to authenticated;

-- L'e-mail devient facultatif : un client de passage au comptoir n'en donne
-- pas toujours, et le refuser bloquerait une réservation bien réelle.
alter table public.reservations alter column guest_email drop not null;
