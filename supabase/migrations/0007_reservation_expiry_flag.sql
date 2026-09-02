-- =============================================================================
-- Hôtel Le Relais du Centre — L'expiration d'un hold est décidée en base
--
-- LE PROBLÈME. La page de paiement déduisait l'expiration en comparant
-- `hold_expires_at` à l'horloge du serveur web :
--
--     new Date(reservation.hold_expires_at).getTime() < Date.now()
--
-- Deux défauts. D'abord, ce n'est pas la bonne horloge : c'est PostgreSQL qui
-- expire réellement les holds (`expire_stale_holds`), et une dérive de quelques
-- secondes entre les deux machines suffit à ce que la page affiche « payez
-- maintenant » sur une chambre déjà relâchée — ou l'inverse. Ensuite, React
-- interdit à juste titre un appel à `Date.now()` pendant le rendu : le résultat
-- change à chaque passage sans que rien n'ait bougé.
--
-- LA CORRECTION. La fonction renvoie `is_expired`, calculé par la même horloge
-- que celle qui fait autorité. L'application ne compare plus rien : elle lit.
-- =============================================================================

create or replace function public.get_reservation_public(p_token uuid)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
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
    'hold_expires_at',    v_res.hold_expires_at,
    -- Verdict rendu par l'horloge de la base, la seule qui compte.
    'is_expired',
      v_res.status in ('expired', 'cancelled')
      or (v_res.hold_expires_at is not null and v_res.hold_expires_at < now())
  );
end;
$$;

grant execute on function public.get_reservation_public(uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- La durée de blocage devient un réglage public
-- -----------------------------------------------------------------------------
-- Le visiteur voit un compte à rebours pendant tout le paiement : lui cacher la
-- durée totale ne protégeait rien, et obligeait la page à la recalculer à
-- partir de la date d'expiration.
update public.settings set is_public = true where key = 'hold_minutes';
