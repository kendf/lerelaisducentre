import { getFormatter, getTranslations } from "next-intl/server";
import { BedDouble, CalendarDays, Info, Moon, Users, Wallet } from "lucide-react";

import { HotelImage } from "@/components/site/hotel-image";
import { formatXof } from "@/lib/utils";
import type { PublicReservation } from "@/types/database";

interface RecapCardProps {
  reservation: PublicReservation;
  roomName: string;
  /** Accroche courte de la catégorie. Absente sur certaines chambres. */
  roomShort?: string;
  /** Chemin de base du visuel de couverture, sans suffixe de taille. */
  coverPath?: string | null;
  depositPercent: number;
}

/* =============================================================================
   CARTE DE RÉCAPITULATIF — étape 3

   Quatre règles de composition, dans cet ordre de priorité.

   1. NE PAS RÉPÉTER CE QUI EST DÉJÀ LÀ. Le nom de l'hôtel est dans l'en-tête du
      site : le redonner ici consommerait la place qui doit revenir aux
      montants. L'en-tête de la carte se limite donc à « Votre séjour » et à la
      référence.

   2. LE PLUS GROS CARACTÈRE VA À CE QUI EST VÉRIFIÉ EN PREMIER. Sur cet écran,
      ce n'est ni le nom de la chambre ni le total : c'est LE MONTANT QU'ON VA
      DÉBITER MAINTENANT. C'est la seule question que se pose un visiteur devant
      un bouton de paiement.

   3. LES FAITS DE MÊME POIDS VONT DANS UNE GRILLE. Dates, voyageurs et durée
      ont la même importance : trois lignes régulières avec une étiquette
      discrète se parcourent d'un regard, là où un paragraphe oblige à tout lire
      pour trouver une information.

   4. SÉPARER PAR MOMENT D'USAGE. L'acompte se règle dans la minute, le solde à
      l'arrivée, des jours plus tard. Les mêler dans une même liste de montants
      fait craindre un débit de la totalité. Ils sont donc physiquement séparés :
      l'acompte dans un bandeau qui lui est propre, le reste en retrait.
   ============================================================================= */

export async function RecapCard({
  reservation,
  roomName,
  roomShort,
  coverPath,
  depositPercent,
}: RecapCardProps) {
  const t = await getTranslations("booking");
  const tCommon = await getTranslations("common");
  const format = await getFormatter();

  const day = (iso: string) =>
    format.dateTime(new Date(`${iso}T12:00:00Z`), "long");

  const facts = [
    {
      icon: CalendarDays,
      label: t("summaryDates"),
      value: `${day(reservation.check_in)} → ${day(reservation.check_out)}`,
    },
    {
      icon: Users,
      label: t("summaryGuests"),
      value:
        tCommon("adults", { count: reservation.adults }) +
        (reservation.children > 0
          ? ` · ${tCommon("children", { count: reservation.children })}`
          : ""),
    },
    {
      icon: Moon,
      label: t("summaryNights"),
      value: tCommon("night", { count: reservation.nights }),
    },
  ];

  const balance = reservation.total_amount_xof - reservation.deposit_amount_xof;

  return (
    <article className="overflow-hidden border border-ivory-line bg-cream">
      {/* --- En-tête, volontairement discret ------------------------------- */}
      <header className="flex items-center justify-between gap-4 border-b border-ivory-line px-6 py-4">
        <h2 className="flex items-center gap-2.5 font-display text-xl">
          <BedDouble size={19} className="shrink-0 text-bronze" aria-hidden />
          {t("summaryTitle")}
        </h2>
        <span className="numeric chip text-xs">{reservation.reference}</span>
      </header>

      {/* --- La chambre : une image vaut le paragraphe qu'elle remplace ---- */}
      <div className="flex items-center gap-4 px-6 py-5">
        <div className="size-20 shrink-0 overflow-hidden bg-ivory-line">
          {coverPath ? (
            <HotelImage basePath={coverPath} alt="" sizes="80px" />
          ) : null}
        </div>
        <div className="min-w-0">
          <p className="font-display text-lg leading-tight">{roomName}</p>
          {roomShort ? (
            <p className="mt-1 text-sm leading-snug text-brown-soft">
              {roomShort}
            </p>
          ) : null}
        </div>
      </div>

      {/* --- Faits de même poids, en grille régulière ---------------------- */}
      <dl className="border-y border-ivory-line px-6">
        {facts.map((fact) => (
          <div
            key={fact.label}
            className="flex items-center justify-between gap-4 border-b border-ivory-line/60 py-3 text-sm last:border-0"
          >
            <dt className="flex shrink-0 items-center gap-2.5 text-brown-soft">
              <fact.icon size={16} className="text-bronze-soft" aria-hidden />
              {fact.label}
            </dt>
            <dd className="text-right">{fact.value}</dd>
          </div>
        ))}
      </dl>

      {/* --- CE QU'ON DÉBITE MAINTENANT. Le point le plus regardé de la page,
              donc le plus gros caractère et le seul fond coloré. ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 bg-bronze-tint/70 px-6 py-5">
        <div className="flex items-center gap-3">
          <Wallet size={20} className="shrink-0 text-bronze" aria-hidden />
          <div>
            <p className="font-display text-lg leading-tight text-bronze-dark">
              {t("payNowLabel")}
            </p>
            <p className="mt-0.5 text-xs text-brown-soft">
              {t("depositBadge", { percent: depositPercent })}
            </p>
          </div>
        </div>
        <p className="price text-3xl leading-none font-medium text-bronze">
          {formatXof(reservation.deposit_amount_xof)}
        </p>
      </div>

      {/* --- Ce qui se règle plus tard, en retrait assumé ------------------ */}
      <dl className="space-y-2.5 px-6 py-5 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-brown-soft">{t("summaryTotal")}</dt>
          <dd className="price">{formatXof(reservation.total_amount_xof)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-brown-soft">{t("summaryBalance")}</dt>
          <dd className="price">{formatXof(balance)}</dd>
        </div>
      </dl>

      <p className="flex items-start gap-2.5 border-t border-ivory-line bg-ivory/60 px-6 py-4 text-xs leading-relaxed text-brown-soft">
        <Info size={15} className="mt-0.5 shrink-0 text-bronze-soft" aria-hidden />
        {t("depositExplain", { percent: depositPercent })}
      </p>
    </article>
  );
}
