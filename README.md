# Hôtel Le Relais du Centre — site et système de réservation

Site vitrine bilingue et moteur de réservation pour l'Hôtel Le Relais du Centre
(Tiébissou, Côte d'Ivoire). Réalisé par MapDevs.

> **État : prototype de validation.** Les chambres, tarifs, textes et
> photographies sont provisoires et attendent les contenus de l'hôtel. Les
> visuels proviennent d'un autre établissement et ne doivent **jamais** être
> déployés sur le domaine de production.

---

## Démarrer

```bash
npm install
npm run db:start          # Supabase local (Docker requis) : migrations + jeu de démo
cp .env.example .env.local # puis renseigner les clés affichées par db:start
npm run dev
```

Le site est sur `http://localhost:3000` (FR sur `/fr`, EN sur `/en`), le
back-office sur `/admin`, et Supabase Studio sur `http://127.0.0.1:54423`.

### Comptes de démonstration

| Rôle | Identifiant |
|---|---|
| Gérance | `gerant@lerelaisducentre.com` |
| Réception | `reception@lerelaisducentre.com` |

Créés par `npm run staff:create -- <email> <mot de passe> "<nom>" [role]`.

### Ports

Les ports Supabase sont décalés de +100 par rapport aux valeurs par défaut
(`54421` au lieu de `54321`, etc.) : la plage `54276-54375` est réservée par
Windows sur le poste de développement et refuse l'attachement. Voir
`supabase/config.toml`.

---

## Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Construction de production |
| `npm test` | Suite de tests (nécessite `db:start`) |
| `npm run typecheck` | Vérification TypeScript |
| `npm run db:start` / `db:stop` | Pile Supabase locale |
| `npm run db:reset` | Rejoue migrations + jeu de démonstration |
| `npm run db:push` | Applique les migrations sur le projet cloud |
| `npm run staff:create` | Crée un compte du back-office |

---

## Architecture

```
src/
├─ app/
│  ├─ [locale]/          Site public — FR/EN, chemins traduits (/en/rooms)
│  ├─ admin/             Back-office — français uniquement, non indexé
│  └─ api/               Webhook de paiement, cron d'expiration, guichet simulé
├─ components/{site,admin,booking,ui}
├─ lib/
│  ├─ supabase/          Trois clients : public, session, service_role
│  ├─ admin/             Lectures du back-office
│  ├─ payments/          Interface PaymentProvider + CinetPay + simulateur
│  ├─ notifications/     Zavu (WhatsApp, repli SMS, e-mail)
│  └─ validation/        Schémas zod partagés client ↔ serveur
├─ i18n/                 next-intl : routage et chemins localisés
└─ messages/{fr,en}.json Contenus du site

supabase/
├─ migrations/           Structure uniquement — jamais de données
└─ seed.sql              Données de démonstration — jamais appliqué en production
```

### Trois principes à ne pas casser

**1. La disponibilité est garantie par la base, pas par le code.**
`reservation_nights` porte une contrainte `UNIQUE(room_type_id, night, unit_slot)` :
le surbooking est refusé par PostgreSQL même en cas de bug applicatif. La
création passe par `create_reservation_hold()`, qui prend un verrou consultatif
pour sérialiser les demandes concurrentes. **Aucun rôle, pas même le gérant, ne
peut insérer directement dans `reservations`** — le contourner rouvrirait la
porte au surbooking.

**2. Le prix est calculé côté serveur, jamais reçu du navigateur.**
`quote_stay()` produit le montant et le détail nuit par nuit, figé dans
`price_breakdown`. Un changement de tarif n'affecte donc aucune réservation
déjà enregistrée.

**3. Les migrations appliquées sont figées.**
Un correctif se fait par une nouvelle migration, jamais en modifiant un fichier
déjà joué. Les données de démonstration vivent exclusivement dans `seed.sql` :
passer en production consiste à appliquer les migrations sur un projet vierge,
sans aucune donnée de test à nettoyer.

### Évolutivité PMS

Le modèle suit le vocabulaire ARI (Availability, Rates, Inventory) des channel
managers : `inventory_calendar` porte les surcharges de disponibilité et de
tarif par nuit, `rooms.external_ref` et `reservations.external_ref` sont
réservés au mapping d'un système externe. Une synchronisation future avec
Orchestra Hôtel (cahier des charges §15.1) devient un connecteur, pas une
refonte — aucune de ces colonnes n'est utilisée aujourd'hui.

---

## Paiement

`PAYMENT_PROVIDER` sélectionne l'implémentation :

| Valeur | Usage |
|---|---|
| `mock` | Simulateur local. Sert aux tests automatisés et à la démonstration. |
| `cinetpay_sandbox` | Clés `sk_test_`, aucun compte marchand requis. |
| `cinetpay_live` | Clés `sk_live_`, exige le compte marchand KYC de l'hôtel. |

C'est le **webhook** qui confirme une réservation, pas le retour du navigateur :
si le client ferme son onglet après avoir payé, la réservation se confirme quand
même. Le webhook réinterroge systématiquement l'API du prestataire — le corps de
la requête entrante n'est jamais cru sur parole — et l'idempotence est portée
par une contrainte d'unicité, pas par la logique applicative.

---

## Notifications

Zavu couvre WhatsApp, SMS et e-mail derrière une seule API, avec repli
automatique en SMS si WhatsApp échoue. L'interface `NotificationChannel` permet
de basculer vers un autre prestataire sans toucher au code métier. Tout envoi
est journalisé dans `notifications_log`, y compris les échecs — c'est ce qui
permet de prouver en recette que les confirmations sont bien parties
(cahier des charges §13).

Un message WhatsApp sortant vers un client qui n'a jamais écrit exige un
*template* approuvé par Meta : `ZAVU_WHATSAPP_TEMPLATE_CONFIRMATION`. Tant qu'il
est absent, la confirmation part par SMS.

---

## Sécurité

- Trois cercles d'accès : public en lecture seule, écritures publiques par
  fonctions `SECURITY DEFINER` uniquement, personnel authentifié sous policies
  RLS indexées sur le rôle.
- La clé `service_role` ne sert qu'au webhook de paiement, au cron et à la
  création de comptes. Elle n'a pas de préfixe `NEXT_PUBLIC_` : Next.js refuse
  de l'inclure dans un bundle client.
- `tests/function-privileges.test.ts` vérifie, sous le rôle `anon`, que les
  fonctions privilégiées restent inaccessibles. Ce fichier existe à cause d'un
  défaut réel : `revoke ... from anon` ne retire pas le droit hérité du
  pseudo-rôle `PUBLIC`. Ne pas le supprimer.
- `npm test` couvre aussi la séparation réceptionniste / gérant avec de vraies
  sessions, et l'impossibilité du surbooking sous accès concurrent.

---

## Déploiement

Frontend sur Vercel, base sur Supabase Cloud. `vercel.json` déclare le cron qui
libère les réservations non payées toutes les cinq minutes — sans lui,
l'inventaire fuit.

Avant la mise en production :

1. Appliquer les migrations sur un projet vierge (`npm run db:push`), **sans**
   `seed.sql`.
2. Saisir les contenus réels depuis le back-office.
3. Désactiver le réglage `demo_mode` (écran Paramètres) pour retirer le bandeau
   « visuels d'illustration ».
4. Remplacer les visuels de `public/images/` et les lignes `media` marquées
   `is_placeholder`.
5. Régénérer les clés API et le mot de passe de la base.
