import { getTranslations } from "next-intl/server";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Fil des trois étapes de la réservation (CDC §5.4).
 *
 * POURQUOI UN INDICATEUR, ET POURQUOI NUMÉROTÉ. Un tunnel de paiement fait
 * peur : le visiteur ne sait pas combien de temps il en a, ni s'il pourra
 * revenir en arrière. Le fil répond aux deux — il montre la longueur totale et
 * il marque ce qui est déjà acquis. Les numéros sont ici une information
 * réelle : l'ordre des étapes est contraint, on ne paie pas avant d'avoir
 * choisi ses dates.
 *
 * Les étapes franchies portent une COCHE en plus de la couleur : l'état ne
 * repose jamais sur la seule perception des teintes.
 */
export async function BookingSteps({ current }: { current: 1 | 2 | 3 }) {
  const t = await getTranslations("booking");

  const steps = [
    { n: 1 as const, label: t("step1") },
    { n: 2 as const, label: t("step2") },
    { n: 3 as const, label: t("step3") },
  ];

  return (
    <nav
      aria-label={t("title")}
      className="border-b border-ivory-line bg-ivory-deep"
    >
      <ol className="mx-auto flex max-w-3xl items-center gap-2 px-5 py-6 sm:gap-4 lg:px-8">
        {steps.map((step, index) => {
          const done = step.n < current;
          const active = step.n === current;

          return (
            <li
              key={step.n}
              className={cn(
                "flex items-center gap-2 sm:gap-3",
                index > 0 && "flex-1"
              )}
              aria-current={active ? "step" : undefined}
            >
              {/* Le filet qui précède l'étape se remplit une fois franchie :
                  la progression se lit sans avoir à comparer des couleurs. */}
              {index > 0 ? (
                <span
                  aria-hidden
                  className={cn(
                    "h-px flex-1",
                    done || active ? "bg-bronze" : "bg-ivory-line"
                  )}
                />
              ) : null}

              <span
                className={cn(
                  "numeric flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                  done && "bg-bronze text-ivory",
                  active && "border border-bronze text-bronze",
                  !done && !active && "border border-ivory-line text-brown-soft"
                )}
              >
                {done ? <Check size={13} aria-hidden /> : step.n}
              </span>

              <span
                className={cn(
                  "text-xs whitespace-nowrap sm:text-sm",
                  active ? "text-brown" : "text-brown-soft",
                  // Sur petit écran, seule l'étape en cours est nommée : trois
                  // libellés côte à côte deviendraient illisibles.
                  !active && "hidden sm:inline"
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
