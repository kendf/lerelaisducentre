"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import { AlertCircle, Lock } from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  createHold,
  type HoldState,
} from "@/app/[locale]/reserver/informations/actions";
import { isRetryableWithNewSearch } from "@/lib/booking/errors";

const INITIAL: HoldState = { status: "idle" };

interface GuestDetailsFormProps {
  stay: {
    roomTypeId: string;
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
  };
}

function SubmitButton() {
  const t = useTranslations("booking");
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="btn btn-primary w-full" disabled={pending}>
      <Lock size={14} />
      {pending ? t("searching") : t("continue")}
    </button>
  );
}

export function GuestDetailsForm({ stay }: GuestDetailsFormProps) {
  const t = useTranslations("booking");
  const locale = useLocale();
  const [state, formAction] = useActionState(createHold, INITIAL);

  const code = state.code ?? "GENERIC";
  const showRestart = state.status === "error" && isRetryableWithNewSearch(code);

  return (
    <form action={formAction} className="space-y-4">
      {/* Le séjour voyage en champs cachés : l'action serveur ne fait confiance
          à rien de tout cela — elle revalide dates, capacité et prix auprès de
          la base avant d'écrire quoi que ce soit. */}
      <input type="hidden" name="roomTypeId" value={stay.roomTypeId} />
      <input type="hidden" name="checkIn" value={stay.checkIn} />
      <input type="hidden" name="checkOut" value={stay.checkOut} />
      <input type="hidden" name="adults" value={stay.adults} />
      <input type="hidden" name="children" value={stay.children} />
      <input type="hidden" name="locale" value={locale} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-wider text-brown-soft">
            {t("firstName")}
          </span>
          <input
            name="firstName"
            required
            minLength={2}
            maxLength={80}
            autoComplete="given-name"
            className="field"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-wider text-brown-soft">
            {t("lastName")}
          </span>
          <input
            name="lastName"
            required
            minLength={2}
            maxLength={80}
            autoComplete="family-name"
            className="field"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-wider text-brown-soft">
            {t("email")}
          </span>
          <input
            type="email"
            name="email"
            required
            maxLength={200}
            autoComplete="email"
            className="field"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-wider text-brown-soft">
            {t("phone")}
          </span>
          <input
            type="tel"
            name="phone"
            required
            minLength={8}
            maxLength={30}
            autoComplete="tel"
            className="field"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs uppercase tracking-wider text-brown-soft">
          {t("country")}
        </span>
        <input
          name="country"
          maxLength={80}
          autoComplete="country-name"
          className="field"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs uppercase tracking-wider text-brown-soft">
          {t("notes")}
        </span>
        <textarea
          name="notes"
          rows={3}
          maxLength={1000}
          placeholder={t("notesPlaceholder")}
          className="field resize-y"
        />
      </label>

      <label className="flex items-start gap-3 pt-1 text-sm text-brown-soft">
        <input
          type="checkbox"
          name="acceptTerms"
          required
          className="mt-1 size-4 accent-[var(--color-bronze)]"
        />
        <span>
          {t("acceptTerms")}{" "}
          <Link
            href="/conditions"
            target="_blank"
            className="underline transition-colors hover:text-bronze"
          >
            ↗
          </Link>
        </span>
      </label>

      {state.status === "error" ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 border border-danger/30 bg-danger/8 p-4 text-sm text-brown"
        >
          <AlertCircle size={17} className="mt-0.5 shrink-0 text-danger" />
          <div>
            <p>{t(`errors.${code}`)}</p>
            {showRestart ? (
              <Link
                href="/reserver"
                className="mt-2 inline-block underline transition-colors hover:text-bronze"
              >
                {t("search")}
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      <SubmitButton />
    </form>
  );
}
