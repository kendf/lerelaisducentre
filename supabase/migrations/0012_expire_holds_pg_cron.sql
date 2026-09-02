-- =============================================================================
-- Hôtel Le Relais du Centre — L'expiration des blocages passe dans la base
--
-- REVIREMENT ASSUMÉ. La migration 0002 disait ceci :
--
--   « Volontairement PAS branchée sur pg_cron : un cron Vercel qui appelle une
--     route serveur ne dépend d'aucune extension Postgres et fonctionne à
--     l'identique en local, en démo et en production. »
--
-- Le raisonnement était bon, sa prémisse ne l'est plus. Vercel limite les
-- tâches planifiées à UNE PAR JOUR sur le forfait Hobby : notre expression
-- `*/5 * * * *` est refusée au déploiement. Une expiration quotidienne
-- signifierait qu'une chambre non payée reste immobilisée jusqu'à vingt-quatre
-- heures — soit exactement le défaut que le mécanisme existe pour empêcher.
--
-- Les deux issues étaient : payer Vercel Pro (~20 $/mois de charge récurrente
-- pour une seule fonction), ou déplacer la tâche là où elle appartient. Libérer
-- un stock est une affaire de données, pas de serveur web. pg_cron l'exécute
-- DANS Postgres, toutes les cinq minutes, sans requête HTTP, sans dépendre de
-- la disponibilité du site, et sans coût.
--
-- La route /api/cron/expire-holds est CONSERVÉE : elle reste utile pour forcer
-- une expiration à la main pendant une démonstration, et sert de secours si
-- l'extension venait à être désactivée.
-- =============================================================================

create extension if not exists pg_cron;

-- Rejouer la migration ne doit pas empiler les planifications.
do $$
begin
  perform cron.unschedule('expire-stale-holds');
exception
  when others then null;  -- la tâche n'existait pas encore
end;
$$;

select cron.schedule(
  'expire-stale-holds',
  '*/5 * * * *',
  $$ select public.expire_stale_holds(); $$
);

comment on function public.expire_stale_holds() is
  'Libère les réservations dont le blocage a expiré. Exécutée toutes les 5 minutes par pg_cron (tâche « expire-stale-holds »), et appelable à la main via /api/cron/expire-holds.';
