import { getFormatter, getTranslations } from "next-intl/server";
import { formatXof } from "@/lib/utils";
import type { Locale, StayQuote } from "@/types/database";

interface StaySummaryProps {
  quote: StayQuote;
  roomName: string;
  adults: number;
  /** Nombre d'enfants. PAS nommé `children` : React réserve ce nom au contenu. */
  childCount: number;
  locale: Locale;
}

/**
 * Récapitulatif du séjour, affiché aux étapes 2 et 3.
 *
 * Les montants viennent du devis calculé en base, jamais d'une addition faite
 * dans le navigateur : ce que le visiteur lit ici est exactement ce qui sera
 * écrit dans la réservation.
 */
export async function StaySummary({
  quote,
  roomName,
  adults,
  childCount,
  locale,
}: StaySummaryProps) {
  const t = await getTranslations("booking");
  const tCommon = await getTranslations("common");
  const format = await getFormatter();

  const dateRange = `${format.dateTime(new Date(`${quote.check_in}T12:00:00Z`), "long")} → ${format.dateTime(new Date(`${quote.check_out}T12:00:00Z`), "long")}`;

  const rows = [
    { label: t("summaryRoom"), value: roomName },
    { label: t("summaryDates"), value: dateRange },
    {
      label: t("summaryGuests"),
      value:
        tCommon("adults", { count: adults }) +
        (childCount > 0 ? ` · ${tCommon("children", { count: childCount })}` : ""),
    },
    { label: t("summaryNights"), value: tCommon("night", { count: quote.nights }) },
  ];

  return (
    <aside className="border border-ivory-line bg-cream p-6 lg:sticky lg:top-28 lg:self-start">
      <h2 className="font-display text-xl">{t("summaryTitle")}</h2>

      <dl className="mt-5 space-y-3 border-b border-ivory-line pb-5 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-4">
            <dt className="shrink-0 text-brown-soft">{row.label}</dt>
            <dd className="text-right">{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 space-y-3 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-brown-soft">{t("summaryTotal")}</span>
          <span className="font-display text-xl">
            {formatXof(quote.total_xof, locale)}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-brown-soft">{t("summaryDeposit")}</span>
          <span className="font-display text-xl text-bronze">
            {formatXof(quote.deposit_xof, locale)}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-brown-soft">{t("summaryBalance")}</span>
          <span>{formatXof(quote.balance_xof, locale)}</span>
        </div>
      </div>

      <p className="mt-5 border-t border-ivory-line pt-4 text-xs leading-relaxed text-brown-soft">
        {t("depositExplain", { percent: quote.deposit_percent })}
      </p>
    </aside>
  );
}
