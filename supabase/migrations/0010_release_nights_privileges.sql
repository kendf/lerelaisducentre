-- =============================================================================
-- Hôtel Le Relais du Centre — Le filet de sécurité doit avoir les droits d'agir
--
-- LE DÉFAUT. `tg_release_nights` libère l'inventaire quand une réservation
-- passe en « annulée » ou « expirée ». Il était déclaré SANS `security definer`,
-- donc exécuté avec les droits de l'appelant.
--
-- Or `reservation_nights` n'a AUCUNE policy de suppression — c'est voulu :
-- personne ne doit pouvoir y toucher directement, c'est ce qui rend la garantie
-- anti-surbooking non contournable. Conséquence : lorsqu'un membre du personnel
-- annulait une réservation depuis le back-office, le DELETE du déclencheur ne
-- supprimait AUCUNE LIGNE, sans lever la moindre erreur. La réservation passait
-- bien en « annulée », mais la chambre restait immobilisée. Invisible, et
-- durable : elle ne serait jamais repartie à la vente.
--
-- Le défaut ne s'était pas vu parce que les tests exécutaient la bascule en
-- superutilisateur, qui ignore les RLS, et parce que le chemin d'annulation de
-- l'interface passe par `cancel_reservation`, elle-même SECURITY DEFINER. Il
-- serait apparu à la première annulation faite autrement — et le stock aurait
-- fui sans que personne ne comprenne pourquoi.
--
-- LA CORRECTION. Un déclencheur qui fait respecter un invariant doit s'exécuter
-- avec les droits nécessaires pour le faire respecter. Il devient donc
-- SECURITY DEFINER, comme les fonctions du moteur.
-- =============================================================================

create or replace function public.tg_release_nights()
returns trigger
language plpgsql
security definer
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

-- -----------------------------------------------------------------------------
-- Rattrapage des inventaires restés bloqués
-- -----------------------------------------------------------------------------
-- Toute réservation déjà annulée ou expirée dont les nuitées n'ont pas été
-- libérées immobilise une chambre pour rien. On les relâche.
delete from public.reservation_nights rn
using public.reservations r
where rn.reservation_id = r.id
  and r.status in ('cancelled', 'expired');
