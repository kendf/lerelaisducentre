-- =============================================================================
-- Hôtel Le Relais du Centre — L'administrateur devient l'autorité sur les accès
--
-- Jusqu'ici, gérance et administration étaient confondues : `is_manager()`
-- renvoyait vrai pour les deux, et le gérant pouvait donc créer des comptes et
-- changer des rôles. La répartition retenue sépare les deux pouvoirs :
--
--   Réception       exploitation quotidienne des réservations
--   Gérance         + tarifs, chambres, réglages commerciaux
--   Administration  + distribution des accès (comptes, rôles, désactivation)
--
-- POURQUOI SÉPARER. Un compte de gérance vit sur le poste de la réception, il
-- est ouvert toute la journée et parfois prêté. S'il permet aussi de créer des
-- comptes, sa compromission ne se répare plus : l'intrus s'octroie un accès
-- permanent. L'administration reste un accès rare, utilisé pour l'arrivée et le
-- départ d'un collaborateur.
--
-- L'interface le reflétait déjà. Cette migration le rend VRAI EN BASE : masquer
-- un écran n'a jamais protégé une donnée.
-- =============================================================================

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.current_staff_role() = 'admin';
$$;

grant execute on function public.is_admin() to authenticated;

-- -----------------------------------------------------------------------------
-- Le changement de rôle passe sous l'autorité de l'administrateur
-- -----------------------------------------------------------------------------
-- Une policy UPDATE ne sait pas protéger une seule colonne : c'est ce
-- déclencheur qui empêche une promotion silencieuse.
create or replace function public.tg_guard_role_change()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'FORBIDDEN_ROLE_CHANGE';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Les policies de `profiles` suivent
-- -----------------------------------------------------------------------------
drop policy if exists profiles_manage_by_manager on public.profiles;

create policy profiles_manage_by_admin on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- La lecture reste ouverte à toute l'équipe : savoir qui a annulé une
-- réservation suppose de pouvoir lire son nom.
