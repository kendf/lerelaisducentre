"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Timer } from "lucide-react";

/**
 * Compte à rebours du blocage de la chambre.
 *
 * L'échéance est calculée par la base et transmise en absolu : le décompte ne
 * dépend donc pas de l'horloge du visiteur, seulement de son affichage. À
 * zéro, la page est rechargée pour que le serveur — seul juge — décide de ce
 * qu'il faut montrer, plutôt que de laisser le navigateur inventer un état.
 */
export function HoldCountdown({ expiresAt }: { expiresAt: string }) {
  const t = useTranslations("booking");
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const deadline = new Date(expiresAt).getTime();

    const tick = () => {
      const left = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) window.location.reload();
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  // Premier rendu serveur : rien, pour éviter une divergence d'hydratation
  // entre l'heure du serveur et celle du navigateur.
  if (remaining === null) return null;

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <p className="flex items-center gap-2 text-sm text-warning">
      <Timer size={15} />
      {t("holdRemaining", {
        time: `${minutes}:${String(seconds).padStart(2, "0")}`,
      })}
    </p>
  );
}
