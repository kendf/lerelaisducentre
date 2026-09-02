-- =============================================================================
-- Hôtel Le Relais du Centre — DONNÉES DE DÉMONSTRATION
--
-- ⚠️  CE FICHIER N'EST JAMAIS APPLIQUÉ EN PRODUCTION.
--
-- Les migrations (supabase/migrations/) ne contiennent QUE de la structure.
-- Toutes les données fictives vivent ici. Passer en production consiste donc à
-- appliquer les migrations sur un projet vierge puis à saisir les contenus
-- réels depuis le back-office : il n'y a AUCUNE donnée de test à nettoyer,
-- donc aucun risque d'en oublier une.
--
-- Les chambres, tarifs, textes et photos ci-dessous sont provisoires et
-- attendent les contenus de l'hôtel (CDC §1.3 et §12).
-- Les visuels proviennent d'un autre établissement et sont marqués
-- is_placeholder = true : ils sont retrouvables et remplaçables d'un seul coup.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Paramètres métier (CDC §9 — valeurs de test, à arbitrer avec l'hôtel)
-- -----------------------------------------------------------------------------
insert into public.settings (key, value, label, is_public) values
  ('deposit_percent',     '30'::jsonb,        'Pourcentage d''acompte demandé à la réservation', true),
  ('hold_minutes',        '20'::jsonb,        'Durée de blocage de la chambre pendant le paiement (minutes)', true),
  ('min_nights',          '1'::jsonb,         'Nombre minimum de nuits par réservation', true),
  ('max_nights',          '30'::jsonb,        'Nombre maximum de nuits par réservation', false),
  ('max_advance_days',    '365'::jsonb,       'Réservation possible jusqu''à N jours à l''avance', false),
  ('check_in_time',       '"14:00"'::jsonb,   'Heure d''arrivée', true),
  ('check_out_time',      '"12:00"'::jsonb,   'Heure de départ', true),
  ('free_cancellation_hours', '48'::jsonb,    'Annulation sans frais jusqu''à N heures avant l''arrivée', true),
  ('hotel_contact', '{
      "phone": "+225 27 30 00 00 00",
      "whatsapp": "+225 07 00 00 00 00",
      "email": "contact@lerelaisducentre.com",
      "address": "Tiébissou, Côte d''Ivoire",
      "maps_query": "Tiebissou, Cote d''Ivoire"
   }'::jsonb, 'Coordonnées affichées sur le site', true),
  ('demo_mode', 'true'::jsonb, 'Affiche la mention « visuels d''illustration » (à désactiver en production)', true)
on conflict (key) do update set value = excluded.value;

-- -----------------------------------------------------------------------------
-- Catégories de chambres — DONNÉES DE TEST
-- -----------------------------------------------------------------------------
insert into public.room_types
  (slug, content, base_price_xof, max_adults, max_children, total_units, surface_m2, bed_config, amenities, sort_order, is_published)
values
  ('chambre-standard',
   '{"fr": {"name": "Chambre Standard",
            "short": "L''essentiel, avec le confort en plus.",
            "description": "Une chambre lumineuse et sobre, pensée pour le voyageur de passage. Lit double, climatisation silencieuse et salle d''eau privative : tout ce qu''il faut pour reprendre la route au matin."},
     "en": {"name": "Standard Room",
            "short": "The essentials, with comfort added.",
            "description": "A bright, understated room designed for the traveller passing through. Double bed, quiet air conditioning and private bathroom: everything you need before getting back on the road."}}'::jsonb,
   18000, 2, 0, 10, 18, 'Lit double 140×190',
   ARRAY['Climatisation','Salle d''eau privative','Wi-Fi','Télévision','Bureau'], 1, true),

  ('chambre-confort',
   '{"fr": {"name": "Chambre Confort",
            "short": "Plus d''espace, plus de calme.",
            "description": "Une chambre spacieuse donnant sur la cour intérieure, avec coin salon et grand lit. Le choix des séjours de plusieurs nuits et de la clientèle affaires."},
     "en": {"name": "Comfort Room",
            "short": "More space, more quiet.",
            "description": "A spacious room overlooking the inner courtyard, with a seating corner and a large bed. The choice for multi-night stays and business travellers."}}'::jsonb,
   25000, 2, 1, 6, 26, 'Lit queen 160×200',
   ARRAY['Climatisation','Salle de bain privative','Wi-Fi','Télévision','Coin salon','Bureau','Coffre-fort'], 2, true),

  ('chambre-familiale',
   '{"fr": {"name": "Chambre Familiale",
            "short": "Pour toute la famille, sans compromis.",
            "description": "Deux lits doubles, un espace de vie généreux et de quoi ranger les valises de toute la famille. Les enfants de moins de 6 ans séjournent gratuitement."},
     "en": {"name": "Family Room",
            "short": "For the whole family, no compromise.",
            "description": "Two double beds, a generous living space and room for the whole family''s luggage. Children under 6 stay free of charge."}}'::jsonb,
   35000, 2, 2, 4, 34, 'Deux lits doubles 140×190',
   ARRAY['Climatisation','Salle de bain privative','Wi-Fi','Télévision','Coin repas','Réfrigérateur'], 3, true),

  ('suite-relais',
   '{"fr": {"name": "Suite Le Relais",
            "short": "Le temps d''une pause, vraiment.",
            "description": "Notre plus bel espace : chambre séparée, salon, grande salle de bain et terrasse privative ouverte sur le jardin. La suite porte le nom de la maison, et elle le mérite."},
     "en": {"name": "Le Relais Suite",
            "short": "A pause, properly taken.",
            "description": "Our finest space: separate bedroom, lounge, large bathroom and a private terrace opening onto the garden. The suite carries the name of the house, and earns it."}}'::jsonb,
   45000, 2, 1, 2, 48, 'Lit king 180×200',
   ARRAY['Climatisation','Salle de bain privative','Wi-Fi','Télévision','Salon séparé','Terrasse privative','Coffre-fort','Réfrigérateur'], 4, true)
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- Unités physiques — non utilisées par le moteur en v1, mais l'attribution
-- d'un numéro de chambre à la réception fonctionne dès maintenant.
-- -----------------------------------------------------------------------------
insert into public.rooms (room_type_id, code, floor)
select rt.id, r.code, r.floor
from public.room_types rt
join (values
  ('chambre-standard','101',1),('chambre-standard','102',1),('chambre-standard','103',1),
  ('chambre-standard','104',1),('chambre-standard','105',1),('chambre-standard','106',1),
  ('chambre-standard','107',1),('chambre-standard','108',1),('chambre-standard','109',1),
  ('chambre-standard','110',1),
  ('chambre-confort','201',2),('chambre-confort','202',2),('chambre-confort','203',2),
  ('chambre-confort','204',2),('chambre-confort','205',2),('chambre-confort','206',2),
  ('chambre-familiale','301',3),('chambre-familiale','302',3),
  ('chambre-familiale','303',3),('chambre-familiale','304',3),
  ('suite-relais','401',4),('suite-relais','402',4)
) as r(slug, code, floor) on r.slug = rt.slug
on conflict (code) do nothing;

-- -----------------------------------------------------------------------------
-- Médias — visuels d'illustration
-- -----------------------------------------------------------------------------
-- `storage_path` stocke le chemin SANS suffixe de taille : le composant
-- d'affichage reconstruit le srcSet (-480 / -960 / -1440). Les variantes
-- existent déjà, donc aucune optimisation d'image à la volée n'est nécessaire —
-- c'est ce qui tient l'objectif « moins de 3 secondes sur mobile » du CDC §8.
insert into public.media (storage_path, section, room_type_id, alt, sort_order, is_cover, is_placeholder)
select
  '/images/chambres/' || m.folder || '/' || lpad(i::text, 2, '0'),
  'room',
  rt.id,
  jsonb_build_object('fr', rt.content #>> '{fr,name}', 'en', rt.content #>> '{en,name}'),
  i,
  i = 1,
  true
from (values
  ('chambre-standard','standard'), ('chambre-confort','confort'),
  ('chambre-familiale','familiale'), ('suite-relais','suite')
) as m(slug, folder)
join public.room_types rt on rt.slug = m.slug
cross join generate_series(1, 6) as i;

insert into public.media (storage_path, section, alt, sort_order, is_cover, is_placeholder)
select '/images/' || s.folder || '/' || lpad(i::text, 2, '0'), s.section,
       jsonb_build_object('fr', s.alt_fr, 'en', s.alt_en), i, i = 1, true
from (values
  ('hotel',      'hotel',      8, 'L''hôtel Le Relais du Centre',  'Le Relais du Centre hotel'),
  ('cadre',      'grounds',    6, 'Le jardin et la piscine',       'Garden and pool'),
  ('restaurant', 'restaurant', 5, 'Le restaurant',                 'The restaurant'),
  ('bar',        'bar',        2, 'Le bar',                        'The bar'),
  ('salon',      'lounge',     3, 'Le salon',                      'The lounge')
) as s(folder, section, n, alt_fr, alt_en)
cross join lateral generate_series(1, s.n) as i;

-- -----------------------------------------------------------------------------
-- Historique de réservations fictif
-- -----------------------------------------------------------------------------
-- Sans lui, le tableau de bord statistique (CDC §3.3) et le calendrier de
-- disponibilité seraient vides le jour de la démonstration — or ce sont
-- justement les deux écrans qui parlent à un gérant. La distribution est
-- construite pour qu'il y ait de l'activité le jour J : arrivées et départs
-- du jour, carnet rempli sur les semaines qui suivent.
--
-- Ces réservations ne peuvent PAS passer par create_reservation_hold() :
-- la fonction refuse les dates passées, à juste titre. On utilise donc une
-- fonction de seed temporaire qui réutilise la MÊME logique d'attribution de
-- slot — les données de démo respectent donc exactement les mêmes règles
-- d'inventaire que les vraies, y compris l'impossibilité du surbooking.
create or replace function pg_temp.seed_reservation(
  p_slug text, p_check_in date, p_nights integer, p_status reservation_status,
  p_first text, p_last text, p_email text, p_phone text,
  p_source reservation_source, p_locale text default 'fr'
) returns boolean language plpgsql as $$
declare
  v_rt        public.room_types%rowtype;
  v_check_out date := p_check_in + p_nights;
  v_slot      smallint;
  v_id        uuid;
  v_total     integer;
  v_deposit   integer;
  v_breakdown jsonb;
begin
  select * into v_rt from public.room_types where slug = p_slug;

  select s.slot into v_slot
  from generate_series(0, v_rt.total_units - 1) as s(slot)
  where not exists (
    select 1 from public.reservation_nights rn
    where rn.room_type_id = v_rt.id and rn.unit_slot = s.slot
      and rn.night >= p_check_in and rn.night < v_check_out
  )
  order by s.slot limit 1;

  if v_slot is null then
    return false;   -- l'hôtel est complet sur cette période : on n'invente pas de chambre
  end if;

  v_total   := v_rt.base_price_xof * p_nights;
  v_deposit := ceil((v_total * 0.30) / 100.0)::integer * 100;

  select jsonb_agg(jsonb_build_object('night', d.night::date, 'price_xof', v_rt.base_price_xof))
  into v_breakdown
  from generate_series(p_check_in, v_check_out - 1, interval '1 day') as d(night);

  insert into public.reservations (
    reference, room_type_id, check_in, check_out, adults, children,
    guest_first_name, guest_last_name, guest_email, guest_phone, locale,
    status, source, total_amount_xof, deposit_amount_xof, amount_paid_xof,
    price_breakdown, confirmed_at, created_at
  ) values (
    'RDC-' || to_char(p_check_in, 'YYYY') || '-' || lpad(nextval('public.reservation_ref_seq')::text, 4, '0'),
    v_rt.id, p_check_in, v_check_out,
    least(2, v_rt.max_adults), 0,
    p_first, p_last, p_email, p_phone, p_locale,
    p_status, p_source, v_total, v_deposit,
    case when p_status in ('confirmed','completed','no_show') then v_deposit else 0 end,
    v_breakdown,
    case when p_status in ('confirmed','completed','no_show') then p_check_in - 5 else null end,
    p_check_in - 7
  ) returning id into v_id;

  insert into public.reservation_nights (reservation_id, room_type_id, night, unit_slot)
  select v_id, v_rt.id, d.night::date, v_slot
  from generate_series(p_check_in, v_check_out - 1, interval '1 day') as d(night);

  return true;
end;
$$;

do $$
declare
  v_names text[][] := array[
    array['Kouassi','Adjoua','k.adjoua@example.ci','+225 07 11 22 33 44','fr'],
    array['Yao','Bertrand','b.yao@example.ci','+225 05 44 33 22 11','fr'],
    array['Aminata','Traoré','a.traore@example.ci','+225 01 55 66 77 88','fr'],
    array['Sarah','Whitfield','sarah.w@example.com','+44 7700 900123','en'],
    array['Marc','Delaunay','m.delaunay@example.fr','+33 6 12 34 56 78','fr'],
    array['Konan','Yves','y.konan@example.ci','+225 07 98 76 54 32','fr'],
    array['James','Okonkwo','j.okonkwo@example.com','+234 803 000 1122','en'],
    array['Fatoumata','Bamba','f.bamba@example.ci','+225 05 12 13 14 15','fr'],
    array['Ange','N''Guessan','a.nguessan@example.ci','+225 27 30 12 34 56','fr'],
    array['Emily','Carter','emily.carter@example.com','+1 415 555 0132','en'],
    array['Ibrahim','Cissé','i.cisse@example.ci','+225 07 22 33 44 55','fr'],
    array['Céline','Kouadio','c.kouadio@example.ci','+225 01 77 88 99 00','fr'],
    array['Mariam','Doumbia','m.doumbia@example.ci','+225 05 33 44 55 66','fr'],
    array['Peter','Hansen','p.hansen@example.com','+45 20 12 34 56','en']
  ];
  -- Répartition volontairement déséquilibrée, comme dans un relais routier :
  -- la standard tourne beaucoup, la suite se vend rarement.
  v_slugs text[] := array['chambre-standard','chambre-standard','chambre-standard',
                          'chambre-standard','chambre-confort','chambre-confort',
                          'chambre-familiale','suite-relais'];
  v_today    date := public.hotel_today();
  v_day      integer;
  v_arrivals integer;
  v_nights   integer;
  v_check_in date;
  v_status   reservation_status;
  v_n        integer;
  v_i        integer;
  v_r        double precision;
begin
  perform setseed(0.42);   -- jeu reproductible d'une exécution à l'autre

  -- On parcourt le calendrier JOUR PAR JOUR en décidant combien de clients
  -- arrivent, au lieu de tirer des réservations au hasard sur une plage.
  -- La première version le faisait, et produisait un hôtel à 3 % d'occupation
  -- sans aucune arrivée le jour de la démonstration — invendable devant un
  -- gérant. Ici la courbe est construite : historique fourni, semaine en cours
  -- chargée, carnet qui s'éclaircit à mesure qu'on s'éloigne.
  for v_day in -70..45 loop
    v_arrivals := case
      when v_day <  -7 then 4 + (random() * 2)::integer   -- historique
      when v_day <=  0 then 4 + (random() * 2)::integer   -- semaine en cours
      when v_day <= 14 then 4 + (random() * 2)::integer   -- réservations proches
      when v_day <= 30 then 2 + (random() * 2)::integer
      else                  1 + (random() * 1)::integer   -- horizon lointain
    end;

    for v_i in 1..v_arrivals loop
      v_check_in := v_today + v_day;
      v_nights   := 1 + (random() * 3)::integer;
      v_n        := 1 + (random() * (array_length(v_names, 1) - 1))::integer;
      v_r        := random();

      v_status := case
        -- Séjour entièrement passé
        when v_check_in + v_nights <= v_today then
          case when v_r < 0.08 then 'cancelled'::reservation_status
               when v_r < 0.12 then 'no_show'::reservation_status
               else                  'completed'::reservation_status end
        -- Client actuellement dans l'hôtel
        when v_check_in <= v_today then 'confirmed'::reservation_status
        -- Séjour à venir
        else
          case when v_r < 0.12 then 'pending'::reservation_status
               when v_r < 0.17 then 'cancelled'::reservation_status
               else                  'confirmed'::reservation_status end
      end;

      -- La fonction renvoie false si l'hôtel est complet cette nuit-là : on
      -- n'invente pas de chambre, l'occupation plafonne naturellement.
      perform pg_temp.seed_reservation(
        v_slugs[1 + (random() * (array_length(v_slugs, 1) - 1))::integer],
        v_check_in, v_nights, v_status,
        v_names[v_n][1], v_names[v_n][2], v_names[v_n][3], v_names[v_n][4],
        case when random() < 0.72 then 'web'::reservation_source
             else 'phone'::reservation_source end,
        v_names[v_n][5]
      );
    end loop;
  end loop;
end;
$$;

-- Les réservations annulées ne doivent plus occuper d'inventaire : on rejoue la
-- règle du trigger de production sur les données insérées directement.
delete from public.reservation_nights rn
using public.reservations r
where rn.reservation_id = r.id and r.status in ('cancelled', 'expired');

-- Un exemple de fermeture à la vente, pour que le back-office ait quelque chose
-- à montrer sur le planning (travaux de réfection sur deux chambres standard).
insert into public.inventory_calendar (room_type_id, night, units_override, is_closed, note)
select rt.id, d.night::date, (rt.total_units - 2)::smallint, false, 'Réfection peinture — 2 chambres indisponibles'
from public.room_types rt
cross join generate_series(public.hotel_today() + 20, public.hotel_today() + 26, interval '1 day') as d(night)
where rt.slug = 'chambre-standard'
on conflict (room_type_id, night) do nothing;

insert into public.contact_messages (name, email, phone, subject, message, locale) values
  ('Société IVOIRE BTP', 'contact@ivoirebtp.example.ci', '+225 27 20 30 40 50',
   'Devis groupe', 'Bonjour, nous cherchons à loger 8 collaborateurs du 12 au 15 du mois prochain. Pouvez-vous nous faire une proposition ? Merci.', 'fr'),
  ('Helen Barnes', 'helen.barnes@example.com', '+44 7700 900456',
   'Airport transfer', 'Hello, do you offer a shuttle from Yamoussoukro? We arrive late in the evening. Thank you.', 'en');
