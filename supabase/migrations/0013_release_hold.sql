-- =============================================================================
-- Hôtel Le Relais du Centre — Libération d'un blocage abandonné
--
-- LE DÉFAUT QUE CETTE MIGRATION CORRIGE. Le tunnel compte désormais quatre
-- étapes, et l'étape 3 propose « Modifier mes informations ». Le visiteur
-- revient alors sur le formulaire et le renvoie — ce qui appelle une nouvelle
-- fois `create_reservation_hold` et crée une SECONDE pré-réservation.
--
-- La première continue d'immobiliser une unité jusqu'à l'expiration de son
-- blocage. Un visiteur consciencieux qui corrige deux fois une faute de frappe
-- dans son numéro de téléphone retire ainsi trois chambres de la vente pendant
-- un quart d'heure. Sur un établissement de vingt-deux chambres, un jour de
-- forte demande, ce n'est plus négligeable.
--
-- POURQUOI UNE FONCTION EN BASE PLUTÔT QU'UN `update` DEPUIS L'APPLICATION.
-- La table `reservations` n'accepte aucune écriture directe, pour personne :
-- c'est la règle posée en 0003 et c'est elle qui rend l'insertion frauduleuse
-- impossible. Toute modification passe par une fonction `security definer` qui
-- décrit précisément ce qu'elle autorise. Celle-ci n'autorise qu'une chose :
-- passer à `expired` une réservation NON PAYÉE dont l'appelant connaît le
-- jeton.
--
-- POURQUOI `expired` ET NON `cancelled`. Une réservation abandonnée en cours de
-- saisie n'est pas une annulation : personne n'a renoncé à un séjour confirmé.
-- C'est exactement le même événement que le blocage qui arrive à échéance, et
-- `expire_stale_holds` emploie déjà ce statut. Le back-office continue donc de
-- présenter une seule et même réalité — « une pré-réservation qui n'a pas
-- abouti » — au lieu de deux libellés pour un même fait.
--
-- Les nuits sont libérées par le trigger `tg_release_nights`, devenu
-- `security definer` en 0010. Rien à faire de plus ici.
-- =============================================================================

create or replace function public.release_hold(p_token uuid)
returns boolean
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_released boolean;
begin
  -- Le jeton seul ne suffit PAS à libérer n'importe quoi : la clause de statut
  -- interdit de toucher une réservation confirmée, payée, honorée ou déjà
  -- annulée. Au pire, un jeton volé libère un blocage que son porteur pouvait
  -- de toute façon laisser expirer.
  update public.reservations
  set status = 'expired'
  where public_token = p_token
    and status = 'pending_payment'
  returning true into v_released;

  return coalesce(v_released, false);
end;
$$;

comment on function public.release_hold(uuid) is
  'Libère une pré-réservation non payée à partir de son jeton public. Sans effet sur toute réservation déjà confirmée. Appelée avant de recréer un blocage lorsque le visiteur corrige ses informations.';

-- Privilèges : mêmes règles qu'en 0004 — on retire d'abord au pseudo-rôle
-- PUBLIC, qui reçoit EXECUTE par défaut sur toute fonction nouvellement créée,
-- puis on accorde explicitement.
revoke all on function public.release_hold(uuid) from public, anon, authenticated;
grant execute on function public.release_hold(uuid) to anon, authenticated;
