"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import { AlertCircle, Smartphone } from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  startPayment,
  type PaymentState,
} from "@/app/[locale]/reserver/paiement/actions";

const INITIAL: PaymentState = { status: "idle" };

function Submit({ amountLabel }: { amountLabel: string }) {
  const t = useTranslations("booking");
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="btn btn-primary w-full" disabled={pending}>
      <Smartphone size={15} />
      {pending ? t("searching") : t("payWith", { amount: amountLabel })}
    </button>
  );
}

export function PaymentButton({ amountLabel }: { amountLabel: string }) {
  const t = useTranslations("booking");
  const locale = useLocale();
  const [state, formAction] = useActionState(startPayment, INITIAL);

  return (
    <form action={formAction}>
      <input type="hidden" name="locale" value={locale} />

      {state.status === "error" ? (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2.5 border border-danger/30 bg-danger/8 p-4 text-sm text-brown"
        >
          <AlertCircle size={17} className="mt-0.5 shrink-0 text-danger" />
          <div>
            <p>
              {state.code === "HOLD_EXPIRED"
                ? t("holdExpired")
                : t("paymentFailed")}
            </p>
            {state.code === "HOLD_EXPIRED" ? (
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

      <Submit amountLabel={amountLabel} />
    </form>
  );
}
