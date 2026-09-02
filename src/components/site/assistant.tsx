"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  CalendarCheck,
  MessageCircle,
  MessagesSquare,
  Phone,
  X,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { FaqItem } from "@/lib/faq";

/**
 * Assistant préréglé.
 *
 * CE QUE C'EST — ET CE QUE CE N'EST PAS. Le cahier des charges §3.4 range le
 * « chat en direct » parmi les options NON incluses au forfait. Ce composant
 * n'en est pas un : il n'y a personne au bout, aucun modèle de langage, aucun
 * service tiers, aucun coût récurrent. Ce sont les réponses de la foire aux
 * questions, servies dans une bulle, avec un passage de relais vers WhatsApp
 * ou le téléphone dès que la question sort du cadre prévu.
 *
 * Cette honnêteté est écrite dans l'interface elle-même : une mention indique
 * que les réponses sont préenregistrées. Laisser croire à un conseiller en
 * ligne produirait de la déception et des appels furieux — exactement ce qu'un
 * assistant est censé éviter.
 *
 * Aucune saisie libre : un champ de texte sans destinataire est un piège. Qui
 * veut écrire est envoyé sur WhatsApp, où quelqu'un répond vraiment.
 */
export function Assistant({
  questions,
  phone,
  whatsapp,
}: {
  questions: FaqItem[];
  phone: string;
  whatsapp: string;
}) {
  const t = useTranslations("assistant");

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<FaqItem | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        // On rend le focus au bouton : sans cela, la navigation au clavier
        // repart du haut de la page après chaque fermeture.
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const phoneHref = `tel:${phone.replace(/[^0-9+]/g, "")}`;
  const whatsappHref = `https://wa.me/${whatsapp.replace(/[^0-9]/g, "")}`;

  return (
    <>
      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-label={t("title")}
          className="fixed right-4 bottom-4 z-50 flex max-h-[min(34rem,calc(100vh-2rem))] w-[min(22rem,calc(100vw-2rem))] flex-col border border-ivory-line bg-cream shadow-[0_24px_60px_-20px_rgba(59,42,30,0.45)] sm:right-6 sm:bottom-6"
        >
          <header className="flex items-start justify-between gap-3 border-b border-ivory-line px-5 py-4">
            <div>
              <p className="font-display text-base">{t("title")}</p>
              <p className="mt-0.5 text-xs leading-snug text-brown-soft">
                {t("notice")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("close")}
              className="-mr-1 shrink-0 p-1 text-brown-soft transition-colors hover:text-bronze"
            >
              <X size={18} />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {selected ? (
              <>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-brown-soft transition-colors hover:text-bronze"
                >
                  <ArrowLeft size={13} />
                  {t("back")}
                </button>
                <p className="mt-4 text-sm font-medium">{selected.q}</p>
                <p className="mt-3 text-sm leading-relaxed text-brown-soft">
                  {selected.a}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm leading-relaxed text-brown-soft">
                  {t("intro")}
                </p>
                <ul className="mt-4 space-y-2">
                  {questions.map((item) => (
                    <li key={item.q}>
                      <button
                        type="button"
                        onClick={() => setSelected(item)}
                        className="w-full border border-ivory-line bg-ivory px-3.5 py-2.5 text-left text-sm leading-snug transition-colors hover:border-bronze hover:text-bronze"
                      >
                        {item.q}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* Le relais humain, toujours visible : c'est la vraie valeur de la
              bulle, pas la liste de réponses. */}
          <footer className="grid gap-2 border-t border-ivory-line px-5 py-4">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 text-sm text-brown transition-colors hover:text-bronze"
            >
              <MessageCircle size={15} className="text-bronze" />
              {t("whatsapp")}
            </a>
            <a
              href={phoneHref}
              className="flex items-center gap-2.5 text-sm text-brown transition-colors hover:text-bronze"
            >
              <Phone size={15} className="text-bronze" />
              {t("call")}
            </a>
            <Link
              href="/reserver"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 text-sm text-brown transition-colors hover:text-bronze"
            >
              <CalendarCheck size={15} className="text-bronze" />
              {t("book")}
            </Link>
            <Link
              href="/questions"
              onClick={() => setOpen(false)}
              className="mt-1 border-t border-ivory-line pt-3 text-xs uppercase tracking-wider text-brown-soft transition-colors hover:text-bronze"
            >
              {t("allFaq")}
            </Link>
          </footer>
        </div>
      ) : null}

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        className={`fixed right-4 bottom-4 z-40 inline-flex items-center gap-2.5 bg-bronze px-4 py-3 text-xs font-medium uppercase tracking-[0.14em] text-ivory shadow-[0_14px_36px_-12px_rgba(59,42,30,0.6)] transition-colors hover:bg-bronze-dark sm:right-6 sm:bottom-6 ${
          open ? "hidden" : ""
        }`}
      >
        <MessagesSquare size={16} />
        {t("open")}
      </button>
    </>
  );
}
