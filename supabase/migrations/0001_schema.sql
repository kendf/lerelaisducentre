-- =============================================================================
-- Hôtel Le Relais du Centre — Schéma initial
-- Cahier des charges v1.0 (30/08/2026) — sections 3.2, 3.3, 7.3, 15.1
--
-- PRINCIPE DIRECTEUR : modélisation ARI (Availability / Rates / Inventory),
-- le vocabulaire natif des PMS et des channel managers. Une synchronisation
-- future avec Orchestra Hôtel (CDC §15.1) devient un connecteur qui alimente
-- `inventory_calendar` et `external_ref`, pas une refonte du modèle.
--
-- MONNAIE : tous les montants sont des `integer` en FCFA (XOF). Le franc CFA
-- n'a pas de subdivision utilisée : aucun besoin de décimales, donc aucun
-- risque d'arrondi en virgule flottante sur des montants facturés au client.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Types énumérés
-- -----------------------------------------------------------------------------

-- CDC §3.3 : droits différenciés réceptionniste / gérant.
-- `admin` est réservé à MapDevs pour le support technique.
create type staff_role as enum ('receptionist', 'manager', 'admin');

-- Le CDC §3.3 n'expose que 3 statuts (en attente / confirmée / annulée).
-- Les 4 autres sont des états techniques indispensables à l'exploitation :
--   pending_payment : hold pendant le tunnel, libéré automatiquement à expiration
--   expired         : acompte jamais payé, inventaire relâché
--   no_show         : client jamais présenté (fausserait le taux d'occupation)
--   completed       : séjour terminé
-- Le back-office les regroupe sous les 3 libellés du CDC.
create type reservation_status as enum (
  'pending_payment', 'pending', 'confirmed', 'cancelled',
  'expired', 'no_show', 'completed'
);

-- Une réservation prise au téléphone consomme le même inventaire qu'une
-- réservation web : c'est ce qui empêche le site de revendre une chambre
-- déjà attribuée à la réception.
create type reservation_source as enum ('web', 'desk', 'phone', 'ota');

create type payment_status as enum (
  'initiated', 'pending', 'succeeded', 'failed', 'cancelled', 'refunded'
);

create type notification_channel as enum ('email', 'whatsapp', 'sms');
create type notification_status  as enum ('queued', 'sent', 'delivered', 'failed');

-- -----------------------------------------------------------------------------
-- Utilisateurs du back-office (CDC §2.2, §3.3)
-- -----------------------------------------------------------------------------
-- Pas d'auto-inscription : les comptes sont créés par invitation depuis
-- l'espace gérant. `profiles` prolonge `auth.users`, géré par Supabase Auth.
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  email       text not null,
  phone       text,
  role        staff_role not null default 'receptionist',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Membres de l''équipe hôtel ayant accès au back-office (CDC §2.2).';

-- -----------------------------------------------------------------------------
-- Référentiel des chambres
-- -----------------------------------------------------------------------------
-- Contenus bilingues en jsonb {fr:{...}, en:{...}} plutôt qu'une table de
-- traductions : 2 langues seulement, zéro jointure, moitié moins de code
-- d'admin. Une contrainte garantit que les deux locales sont bien présentes.
create table public.room_types (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  content         jsonb not null,
  base_price_xof  integer not null check (base_price_xof > 0),
  max_adults      smallint not null default 2 check (max_adults > 0),
  max_children    smallint not null default 0 check (max_children >= 0),
  -- Nombre d'unités commercialisables. Peut différer du nombre de lignes de
  -- `rooms` (chambre hors service, chambre non vendue en ligne...).
  total_units     smallint not null check (total_units > 0),
  surface_m2      smallint,
  bed_config      text,
  amenities       text[] not null default '{}',
  sort_order      smallint not null default 0,
  is_published    boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint room_types_content_bilingual check (
    content ? 'fr' and content ? 'en'
    and content #>> '{fr,name}' is not null
    and content #>> '{en,name}' is not null
  )
);

comment on column public.room_types.content is
  'Contenus bilingues : {"fr":{"name","short","description"},"en":{...}}';
comment on column public.room_types.total_units is
  'Unités vendables. Base du calcul de disponibilité ET du taux d''occupation (CDC §3.3).';

-- Unités physiques. Non utilisées par le moteur de disponibilité en v1 (la
-- vente se fait par catégorie), mais présentes dès maintenant pour
-- l'attribution manuelle des numéros de chambre à la réception et pour le
-- mapping d'un futur PMS (CDC §15.1) — sans coût de développement aujourd'hui.
create table public.rooms (
  id            uuid primary key default gen_random_uuid(),
  room_type_id  uuid not null references public.room_types(id) on delete restrict,
  code          text not null unique,
  floor         smallint,
  is_active     boolean not null default true,
  external_ref  text,
  notes         text
);

comment on column public.rooms.external_ref is
  'Identifiant de la chambre dans un PMS externe (Orchestra Hôtel, channel manager) — réservé, non utilisé en v1.';

-- -----------------------------------------------------------------------------
-- Calendrier ARI : disponibilité et tarifs, nuit par nuit
-- -----------------------------------------------------------------------------
-- Table SPARSE : une ligne uniquement quand on dévie de la règle par défaut.
--   Disponible = coalesce(units_override, total_units) - unités déjà vendues
--   Prix       = coalesce(price_override_xof, base_price_xof)
-- Aucune ligne à générer d'avance. Le jour où les tarifs saisonniers (option
-- CDC §3.4) ou une synchro channel manager sont activés, la table est déjà au
-- bon format : on la remplit, on ne la crée pas.
create table public.inventory_calendar (
  room_type_id       uuid not null references public.room_types(id) on delete cascade,
  night              date not null,
  units_override     smallint check (units_override >= 0),
  price_override_xof integer  check (price_override_xof > 0),
  is_closed          boolean not null default false,
  note               text,
  updated_by         uuid references public.profiles(id),
  updated_at         timestamptz not null default now(),
  primary key (room_type_id, night)
);

comment on table public.inventory_calendar is
  'Surcharges de disponibilité et de tarif par nuit. Format ARI compatible PMS / channel manager (CDC §15.1).';

-- -----------------------------------------------------------------------------
-- Réservations (CDC §3.2, §3.3)
-- -----------------------------------------------------------------------------
create sequence if not exists public.reservation_ref_seq;

create table public.reservations (
  id                  uuid primary key default gen_random_uuid(),
  -- Référence courte et lisible au téléphone : RDC-2026-0042.
  -- Volontairement séquentielle : elle doit se dicter et se noter facilement.
  reference           text not null unique,

  -- ...ce qui la rend devinable. Elle ne peut donc PAS servir de clé d'accès à
  -- la page de confirmation, qui affiche des données personnelles (nom,
  -- téléphone, dates de séjour). Ce jeton aléatoire joue ce rôle : il est
  -- imprévisible et n'apparaît que dans l'URL envoyée au client concerné.
  public_token        uuid not null default gen_random_uuid() unique,
  room_type_id        uuid not null references public.room_types(id) on delete restrict,

  -- Une nuitée est une DATE, jamais un timestamp : aucun décalage de fuseau
  -- possible. Intervalle semi-ouvert [check_in, check_out) — la nuit du départ
  -- n'est pas occupée, donc un départ et une arrivée le même jour sont permis.
  check_in            date not null,
  check_out           date not null,
  nights              integer   generated always as (check_out - check_in) stored,
  stay                daterange generated always as (daterange(check_in, check_out, '[)')) stored,

  adults              smallint not null default 1 check (adults > 0),
  children            smallint not null default 0 check (children >= 0),

  guest_first_name    text not null,
  guest_last_name     text not null,
  guest_email         text not null,
  guest_phone         text not null,
  guest_country       text,
  guest_notes         text,
  locale              text not null default 'fr' check (locale in ('fr', 'en')),

  status              reservation_status not null default 'pending_payment',
  source              reservation_source not null default 'web',

  total_amount_xof    integer not null check (total_amount_xof >= 0),
  deposit_amount_xof  integer not null check (deposit_amount_xof >= 0),
  amount_paid_xof     integer not null default 0 check (amount_paid_xof >= 0),
  -- Détail figé au moment du devis : le tarif appliqué reste opposable même
  -- si le tarif de base change par la suite.
  price_breakdown     jsonb not null,

  assigned_room_id    uuid references public.rooms(id) on delete set null,
  hold_expires_at     timestamptz,
  external_ref        text,

  -- Verrouillage optimiste : si deux réceptionnistes ouvrent la même fiche,
  -- la seconde sauvegarde est refusée au lieu d'écraser silencieusement.
  version             integer not null default 1,

  created_by          uuid references public.profiles(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  confirmed_at        timestamptz,
  cancelled_at        timestamptz,
  cancellation_reason text,

  constraint reservations_valid_stay        check (check_out > check_in),
  constraint reservations_deposit_lte_total check (deposit_amount_xof <= total_amount_xof)
);

create index reservations_check_in_idx  on public.reservations (check_in);
create index reservations_status_idx    on public.reservations (status);
create index reservations_stay_gist_idx on public.reservations using gist (stay);
create index reservations_room_type_idx on public.reservations (room_type_id);
create index reservations_hold_idx      on public.reservations (hold_expires_at)
  where status = 'pending_payment';

-- -----------------------------------------------------------------------------
-- LE VERROU MÉTIER : une ligne par nuit et par unité occupée
-- -----------------------------------------------------------------------------
-- La contrainte UNIQUE(room_type_id, night, unit_slot) rend la double
-- réservation IMPOSSIBLE au niveau de la base : même en cas de bug applicatif,
-- Postgres refuse la seconde insertion. La sécurité n'est pas dans le code,
-- elle est dans le moteur de stockage.
--
-- Bénéfice secondaire : le calendrier de disponibilité (CDC §3.2) et le taux
-- d'occupation (CDC §3.3) se lisent par un simple GROUP BY sur cette table.
--
-- Les nuits sont SUPPRIMÉES quand la réservation est annulée ou expirée
-- (trigger plus bas) : l'inventaire est relâché immédiatement, et la table ne
-- contient donc que de l'occupation réelle.
create table public.reservation_nights (
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  room_type_id   uuid not null references public.room_types(id)   on delete cascade,
  night          date not null,
  unit_slot      smallint not null check (unit_slot >= 0),
  primary key (reservation_id, night),
  constraint reservation_nights_no_overbooking unique (room_type_id, night, unit_slot)
);

create index reservation_nights_lookup_idx on public.reservation_nights (room_type_id, night);

-- -----------------------------------------------------------------------------
-- Paiements (CDC §3.2, §7.4 — acompte Mobile Money via CinetPay)
-- -----------------------------------------------------------------------------
create table public.payments (
  id               uuid primary key default gen_random_uuid(),
  reservation_id   uuid not null references public.reservations(id) on delete cascade,
  provider         text not null,
  method           text,
  provider_ref     text,
  amount_xof       integer not null check (amount_xof > 0),
  status           payment_status not null default 'initiated',
  -- Un webhook rejoué par l'agrégateur (cas fréquent) ne doit jamais produire
  -- un second encaissement : l'unicité tranche, pas la logique applicative.
  idempotency_key  text not null unique,
  failure_reason   text,
  raw_payload      jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index payments_reservation_idx on public.payments (reservation_id);

-- Index de RECHERCHE, volontairement non unique : une même transaction laisse
-- plusieurs lignes (tentative d'ouverture du guichet, puis résultat notifié
-- par le prestataire) qui partagent la même provider_ref. La garantie de
-- non-duplication porte sur `idempotency_key`, pas sur la référence
-- prestataire — c'est elle qui empêche un webhook rejoué de compter deux fois.
create index payments_provider_ref_idx
  on public.payments (provider, provider_ref) where provider_ref is not null;

-- -----------------------------------------------------------------------------
-- Journaux : traçabilité de recette et responsabilité
-- -----------------------------------------------------------------------------
-- Permet de PROUVER en recette que les confirmations sont bien parties
-- (critère CDC §13 : « les confirmations sont bien reçues par e-mail et SMS »).
create table public.notifications_log (
  id              uuid primary key default gen_random_uuid(),
  reservation_id  uuid references public.reservations(id) on delete set null,
  channel         notification_channel not null,
  template        text not null,
  recipient       text not null,
  locale          text not null default 'fr',
  status          notification_status not null default 'queued',
  provider        text,
  provider_ref    text,
  error           text,
  attempts        smallint not null default 0,
  payload         jsonb,
  created_at      timestamptz not null default now(),
  sent_at         timestamptz
);

create index notifications_log_reservation_idx on public.notifications_log (reservation_id);

-- Qui a annulé quoi, et quand. Indispensable dès que deux réceptionnistes
-- travaillent en parallèle sur le même écran.
create table public.audit_log (
  id          bigserial primary key,
  actor_id    uuid references public.profiles(id) on delete set null,
  actor_label text,
  action      text not null,
  entity      text not null,
  entity_id   text,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz not null default now()
);

create index audit_log_entity_idx on public.audit_log (entity, entity_id);

-- -----------------------------------------------------------------------------
-- Paramètres métier (CDC §9 — règles à définir avec l'hôtel)
-- -----------------------------------------------------------------------------
-- Acompte, durée du hold, politique d'annulation, horaires : en base et
-- éditables depuis le back-office, PAS en dur dans le code. Le jour où l'hôtel
-- tranche, c'est un champ à modifier — pas un déploiement.
create table public.settings (
  key         text primary key,
  value       jsonb not null,
  label       text not null,
  is_public   boolean not null default false,
  updated_by  uuid references public.profiles(id),
  updated_at  timestamptz not null default now()
);

comment on column public.settings.is_public is
  'Exposé au site public via RLS (ex. pourcentage d''acompte affiché dans le tunnel).';

-- -----------------------------------------------------------------------------
-- Contenus éditoriaux
-- -----------------------------------------------------------------------------
create table public.media (
  id             uuid primary key default gen_random_uuid(),
  storage_path   text not null,
  section        text not null,
  room_type_id   uuid references public.room_types(id) on delete cascade,
  alt            jsonb not null default '{"fr":"","en":""}'::jsonb,
  width          integer,
  height         integer,
  sort_order     smallint not null default 0,
  is_cover       boolean not null default false,
  is_published   boolean not null default true,
  -- Drapeau de dépose : permet de retrouver et de remplacer d'un seul coup
  -- tous les visuels d'illustration au passage en contenus réels.
  is_placeholder boolean not null default false,
  created_at     timestamptz not null default now()
);

create index media_section_idx   on public.media (section, sort_order);
create index media_room_type_idx on public.media (room_type_id, sort_order);

create table public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  phone       text,
  subject     text,
  message     text not null,
  locale      text not null default 'fr',
  is_handled  boolean not null default false,
  handled_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Triggers utilitaires
-- -----------------------------------------------------------------------------
create or replace function public.tg_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.tg_bump_version()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.version    := old.version + 1;
  return new;
end;
$$;

create trigger profiles_touch    before update on public.profiles
  for each row execute function public.tg_touch_updated_at();
create trigger room_types_touch  before update on public.room_types
  for each row execute function public.tg_touch_updated_at();
create trigger payments_touch    before update on public.payments
  for each row execute function public.tg_touch_updated_at();
create trigger reservations_bump before update on public.reservations
  for each row execute function public.tg_bump_version();

-- Libération de l'inventaire dès qu'une réservation sort du circuit.
-- C'est ce trigger qui garantit qu'une annulation remet la chambre en vente
-- immédiatement, sans intervention applicative — critère de recette CDC §13
-- (« les disponibilités se mettent à jour correctement après chaque réservation »).
create or replace function public.tg_release_nights()
returns trigger language plpgsql as $$
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

create trigger reservations_release_nights before update of status on public.reservations
  for each row execute function public.tg_release_nights();
