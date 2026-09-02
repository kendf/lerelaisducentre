-- =============================================================================
-- Hôtel Le Relais du Centre — Jeton de notification du prestataire
--
-- POURQUOI CETTE COLONNE. L'API v1 de CinetPay ne signe pas ses notifications
-- par HMAC comme l'ancienne API Checkout. Elle renvoie, à l'initialisation du
-- paiement, un `notify_token` propre à la transaction, et le réémet dans la
-- notification. La vérification consiste à comparer les deux.
--
-- Conséquence : ce jeton doit être CONSERVÉ entre les deux moments. Sans lui,
-- nous n'aurions aucun moyen de distinguer une notification authentique d'une
-- requête forgée par quelqu'un qui connaît l'URL du webhook — laquelle est
-- publique par nature.
--
-- C'est un secret partagé par transaction, plus faible qu'une signature :
-- il ne prouve pas l'intégrité du corps du message, seulement que l'émetteur
-- connaît le jeton. Raison de plus pour conserver notre garde-fou principal —
-- après vérification, on réinterroge l'API sur le statut réel avant de
-- confirmer quoi que ce soit.
-- =============================================================================

alter table public.payments
  add column if not exists notify_token text;

comment on column public.payments.notify_token is
  'Jeton renvoyé par le prestataire à l''initialisation, comparé à celui de la notification. Ne jamais exposer côté client.';

-- Le webhook retrouve la transaction par NOTRE référence de réservation
-- (`merchant_transaction_id` côté CinetPay). L'index rend cette recherche
-- immédiate : elle est sur le chemin critique d'une confirmation de paiement.
create index if not exists payments_reservation_provider_idx
  on public.payments (reservation_id, provider);
