-- =============================================================================
-- Hôtel Le Relais du Centre — Verrouillage du search_path
--
-- Signalé par l'analyseur de sécurité Supabase (lint 0011,
-- « function_search_path_mutable ») sur quatre fonctions.
--
-- LE RISQUE. Sans `set search_path`, une fonction résout ses appels non
-- qualifiés selon le search_path de l'APPELANT. Un utilisateur capable de
-- placer un schéma devant `public` peut y définir sa propre version de `now()`
-- et détourner le comportement de la fonction. Sur `hotel_today`, appelée par
-- `quote_stay` pour refuser les dates passées, cela reviendrait à déplacer la
-- notion de « aujourd'hui » — donc à réserver dans le passé, ou à contourner la
-- fenêtre de réservation.
--
-- Aucune des quatre n'est SECURITY DEFINER, ce qui limite fortement la portée :
-- elles s'exécutent avec les droits de l'appelant, pas ceux du propriétaire.
-- Le correctif reste dû — c'est une ligne par fonction, et il supprime toute
-- ambiguïté sur ce que le code résout.
--
-- `pg_temp` est placé en dernier : c'est la recommandation PostgreSQL pour
-- empêcher qu'un objet temporaire créé par l'appelant masque un objet réel.
-- =============================================================================

create or replace function public.tg_touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.tg_bump_version()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  new.version    := old.version + 1;
  return new;
end;
$$;

-- Libération de l'inventaire quand une réservation sort du circuit.
-- Corps inchangé — seul le search_path est fixé.
create or replace function public.tg_release_nights()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status in ('cancelled', 'expired')
     and old.status not in ('cancelled', 'expired') then
    delete from public.reservation_nights where reservation_id = new.id;
    if new.cancelled_at is null then
      new.cancelled_at := now();
    end if;
  end if;
  return new;
end;
$$;

-- Date « aujourd'hui » côté hôtel. La plus sensible des quatre : c'est elle qui
-- fait autorité pour refuser une réservation dans le passé.
create or replace function public.hotel_today()
returns date
language sql
stable
set search_path = public, pg_temp
as $$
  select (now() at time zone 'Africa/Abidjan')::date;
$$;
