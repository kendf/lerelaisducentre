-- =============================================================================
-- Hôtel Le Relais du Centre — Séries du tableau de bord
--
-- CDC §3.3 : « nombre de réservations, taux d'occupation, évolution dans le
-- temps ». `occupancy_stats` couvrait déjà les deux premiers ; il manquait
-- l'évolution.
--
-- Le calcul est fait en base plutôt que dans l'application : ramener toutes les
-- nuitées d'un trimestre au navigateur pour les regrouper en JavaScript ferait
-- transiter des milliers de lignes de données clients pour afficher douze
-- barres. Postgres agrège, l'application affiche.
-- =============================================================================

create or replace function public.occupancy_series(
  p_from        date,
  p_to          date,
  p_bucket_days integer default 7
)
returns table (
  bucket_start date,
  bucket_end   date,
  nights_sold  bigint,
  capacity     bigint,
  reservations bigint
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_units bigint;
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN';
  end if;

  if p_to <= p_from or p_bucket_days < 1 then
    raise exception 'INVALID_DATES';
  end if;

  -- Capacité totale de l'établissement : somme des unités commercialisables.
  select coalesce(sum(rt.total_units), 0) into v_units
  from public.room_types rt where rt.is_published;

  return query
  with buckets as (
    select
      d::date                                             as b_start,
      least(d::date + p_bucket_days, p_to)                as b_end
    from generate_series(p_from, p_to - 1, make_interval(days => p_bucket_days)) as d
  )
  select
    b.b_start,
    b.b_end,
    coalesce(n.sold, 0)  as nights_sold,
    v_units * (b.b_end - b.b_start) as capacity,
    coalesce(r.cnt, 0)   as reservations
  from buckets b
  left join lateral (
    select count(*) as sold
    from public.reservation_nights rn
    where rn.night >= b.b_start and rn.night < b.b_end
  ) n on true
  left join lateral (
    -- Réservations comptées sur leur date d'ARRIVÉE : c'est la lecture
    -- naturelle pour un gérant (« combien de clients sont arrivés cette
    -- semaine »), et elle ne double pas un séjour à cheval sur deux périodes.
    select count(*) as cnt
    from public.reservations res
    where res.check_in >= b.b_start and res.check_in < b.b_end
      and res.status in ('confirmed', 'completed', 'no_show')
  ) r on true
  order by b.b_start;
end;
$$;

grant execute on function public.occupancy_series(date, date, integer) to authenticated;

-- Occupation vendue par catégorie sur une période, pour le classement du
-- tableau de bord.
create or replace function public.occupancy_by_room_type(p_from date, p_to date)
returns table (
  room_type_id uuid,
  slug         text,
  content      jsonb,
  nights_sold  bigint,
  capacity     bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN';
  end if;

  return query
  select
    rt.id,
    rt.slug,
    rt.content,
    coalesce(n.sold, 0) as nights_sold,
    rt.total_units::bigint * greatest(p_to - p_from, 0) as capacity
  from public.room_types rt
  left join lateral (
    select count(*) as sold
    from public.reservation_nights rn
    where rn.room_type_id = rt.id
      and rn.night >= p_from and rn.night < p_to
  ) n on true
  where rt.is_published
  order by coalesce(n.sold, 0) desc, rt.sort_order;
end;
$$;

grant execute on function public.occupancy_by_room_type(date, date) to authenticated;
