-- =============================================================================
-- Hôtel Le Relais du Centre — Row Level Security
--
-- MODÈLE À TROIS CERCLES (CDC §7.6) :
--
--   1. PUBLIC (clé anon, présente dans le navigateur donc à considérer comme
--      connue de tous) : lecture seule sur ce qui est destiné à être affiché.
--      Aucune lecture des réservations, des clients ou des paiements.
--
--   2. ÉCRITURE PUBLIQUE : uniquement par fonctions SECURITY DEFINER
--      (create_reservation_hold, submit_contact_message). Aucune policy
--      d'INSERT anonyme sur les tables métier.
--
--   3. PERSONNEL AUTHENTIFIÉ : policies indexées sur le rôle. Le réceptionniste
--      gère les réservations, le gérant ajoute les tarifs, l'inventaire, les
--      utilisateurs et les statistiques.
--
-- NOTE : le personnel ne peut PAS insérer directement dans `reservations`.
-- Une réservation prise au téléphone passe par la même fonction que le web
-- (source = 'desk') — sinon elle contournerait l'attribution d'unité et
-- rouvrirait la porte au surbooking.
-- =============================================================================

alter table public.profiles           enable row level security;
alter table public.room_types         enable row level security;
alter table public.rooms              enable row level security;
alter table public.inventory_calendar enable row level security;
alter table public.reservations       enable row level security;
alter table public.reservation_nights enable row level security;
alter table public.payments           enable row level security;
alter table public.notifications_log  enable row level security;
alter table public.audit_log          enable row level security;
alter table public.settings           enable row level security;
alter table public.media              enable row level security;
alter table public.contact_messages   enable row level security;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create policy profiles_select_staff on public.profiles
  for select to authenticated using (public.is_staff());

create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy profiles_manage_by_manager on public.profiles
  for all to authenticated using (public.is_manager()) with check (public.is_manager());

-- Une policy UPDATE ne peut pas empêcher la modification d'une SEULE colonne.
-- Sans ce garde-fou, un réceptionniste pourrait se promouvoir gérant en
-- modifiant son propre profil.
create or replace function public.tg_guard_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not public.is_manager() then
    raise exception 'FORBIDDEN_ROLE_CHANGE';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role before update on public.profiles
  for each row execute function public.tg_guard_role_change();

-- Création automatique du profil à l'invitation d'un compte par le gérant.
create or replace function public.tg_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::staff_role, 'receptionist')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.tg_handle_new_user();

-- -----------------------------------------------------------------------------
-- Référentiel chambres — lecture publique du catalogue publié
-- -----------------------------------------------------------------------------
create policy room_types_select_public on public.room_types
  for select to anon, authenticated using (is_published);

create policy room_types_select_staff on public.room_types
  for select to authenticated using (public.is_staff());

create policy room_types_write_manager on public.room_types
  for all to authenticated using (public.is_manager()) with check (public.is_manager());

create policy rooms_select_staff on public.rooms
  for select to authenticated using (public.is_staff());

create policy rooms_write_manager on public.rooms
  for all to authenticated using (public.is_manager()) with check (public.is_manager());

-- -----------------------------------------------------------------------------
-- inventory_calendar — jamais exposé au public
-- -----------------------------------------------------------------------------
-- Le site public n'y accède que via nightly_availability() / get_availability(),
-- qui ne renvoient que ce qui est utile à l'affichage. Les notes internes et la
-- structure de l'inventaire restent privées.
create policy inventory_select_staff on public.inventory_calendar
  for select to authenticated using (public.is_staff());

create policy inventory_write_manager on public.inventory_calendar
  for all to authenticated using (public.is_manager()) with check (public.is_manager());

-- Bloquer des dates est une tâche quotidienne de réception, mais changer un
-- tarif ne l'est pas. Cette fonction ouvre la première sans ouvrir la seconde :
-- elle ne touche jamais à price_override_xof.
create or replace function public.set_inventory_block(
  p_room_type_id uuid,
  p_from date,
  p_to   date,
  p_units_override smallint default null,
  p_is_closed boolean default false,
  p_note text default null
)
returns integer
language plpgsql volatile security definer set search_path = public as $$
declare
  v_count integer;
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN';
  end if;
  if p_to <= p_from then
    raise exception 'INVALID_DATES';
  end if;

  insert into public.inventory_calendar (room_type_id, night, units_override, is_closed, note, updated_by, updated_at)
  select p_room_type_id, d.night::date, p_units_override, p_is_closed, p_note, auth.uid(), now()
  from generate_series(p_from, p_to - 1, interval '1 day') as d(night)
  on conflict (room_type_id, night) do update
    set units_override = excluded.units_override,
        is_closed      = excluded.is_closed,
        note           = excluded.note,
        updated_by     = excluded.updated_by,
        updated_at     = now();

  get diagnostics v_count = row_count;

  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values (auth.uid(), 'inventory.block', 'inventory_calendar', p_room_type_id::text,
          jsonb_build_object('from', p_from, 'to', p_to,
                             'units_override', p_units_override, 'is_closed', p_is_closed));

  return v_count;
end;
$$;

grant execute on function public.set_inventory_block(uuid, date, date, smallint, boolean, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Réservations — aucune fuite possible vers le public
-- -----------------------------------------------------------------------------
-- Pas de policy pour `anon` : les données clients (nom, téléphone, e-mail,
-- dates de séjour) sont invisibles depuis le navigateur, quoi qu'il arrive.
create policy reservations_select_staff on public.reservations
  for select to authenticated using (public.is_staff());

create policy reservations_update_staff on public.reservations
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

-- Pas de policy INSERT : même le personnel passe par create_reservation_hold().

create policy reservation_nights_select_staff on public.reservation_nights
  for select to authenticated using (public.is_staff());

-- Aucune policy d'écriture sur reservation_nights : cette table n'est modifiée
-- que par le moteur (fonctions SECURITY DEFINER) et par le trigger de
-- libération. C'est ce qui rend la garantie anti-surbooking non contournable.

create policy payments_select_staff on public.payments
  for select to authenticated using (public.is_staff());

-- -----------------------------------------------------------------------------
-- Journaux — réservés au gérant
-- -----------------------------------------------------------------------------
create policy notifications_select_manager on public.notifications_log
  for select to authenticated using (public.is_manager());

create policy audit_select_manager on public.audit_log
  for select to authenticated using (public.is_manager());

-- -----------------------------------------------------------------------------
-- Paramètres — seuls les réglages marqués publics sortent
-- -----------------------------------------------------------------------------
create policy settings_select_public on public.settings
  for select to anon, authenticated using (is_public);

create policy settings_select_staff on public.settings
  for select to authenticated using (public.is_staff());

create policy settings_write_manager on public.settings
  for all to authenticated using (public.is_manager()) with check (public.is_manager());

-- -----------------------------------------------------------------------------
-- Contenus éditoriaux
-- -----------------------------------------------------------------------------
create policy media_select_public on public.media
  for select to anon, authenticated using (is_published);

create policy media_write_manager on public.media
  for all to authenticated using (public.is_manager()) with check (public.is_manager());

create policy contact_select_staff on public.contact_messages
  for select to authenticated using (public.is_staff());

create policy contact_update_staff on public.contact_messages
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

-- -----------------------------------------------------------------------------
-- Stockage des médias (CDC §7.3)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create policy media_bucket_read on storage.objects
  for select to anon, authenticated using (bucket_id = 'media');

create policy media_bucket_write on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and public.is_manager());

create policy media_bucket_update on storage.objects
  for update to authenticated using (bucket_id = 'media' and public.is_manager());

create policy media_bucket_delete on storage.objects
  for delete to authenticated using (bucket_id = 'media' and public.is_manager());
