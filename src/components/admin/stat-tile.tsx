import { cn } from "@/lib/utils";

/**
 * Chiffre isolé.
 *
 * Une valeur unique n'est pas un graphique : la poser en grand est plus rapide
 * à lire qu'un cadran ou une jauge, et ne suggère pas une comparaison qui
 * n'existe pas.
 *
 * La taille du texte s'adapte à la LONGUEUR de la valeur. « 44,4 % » et
 * « 5 792 000 F CFA » n'occupent pas la même place : à taille fixe, le second
 * débordait de sa carte. Trois paliers suffisent — un pourcentage, un compteur,
 * un montant en francs.
 */
function sizeFor(value: string, emphasis: boolean): string {
  const length = value.length;
  if (length <= 8) return emphasis ? "text-4xl" : "text-3xl";
  if (length <= 12) return emphasis ? "text-3xl" : "text-2xl";
  return emphasis ? "text-2xl" : "text-xl";
}

export function StatTile({
  label,
  value,
  hint,
  emphasis = false,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col border border-ivory-line bg-cream p-5",
        emphasis && "border-bronze/30"
      )}
    >
      <p className="text-xs uppercase tracking-wider text-brown-soft">{label}</p>
      <p
        className={cn(
          // `break-words` en filet de sécurité : même un montant inattendu
          // reste dans sa carte au lieu de la traverser.
          "numeric mt-2 leading-tight font-medium break-words",
          sizeFor(value, emphasis),
          emphasis ? "text-bronze" : "text-brown"
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-2 text-xs text-brown-soft">{hint}</p> : null}
    </div>
  );
}
