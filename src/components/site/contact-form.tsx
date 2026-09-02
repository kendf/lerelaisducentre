"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, AlertCircle } from "lucide-react";
import {
  submitContactMessage,
  type ContactState,
} from "@/app/[locale]/contact/actions";

const INITIAL: ContactState = { status: "idle" };

function SubmitButton() {
  const t = useTranslations("contact");
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="btn btn-primary w-full" disabled={pending}>
      {pending ? t("sending") : t("send")}
    </button>
  );
}

export function ContactForm() {
  const t = useTranslations("contact");
  const locale = useLocale();
  const [state, formAction] = useActionState(submitContactMessage, INITIAL);

  if (state.status === "success") {
    return (
      <div className="flex items-start gap-3 border border-palm/30 bg-palm/8 p-6">
        <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-palm" />
        <p className="text-[15px] leading-relaxed text-brown">{t("success")}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-wider text-brown-soft">
            {t("name")}
          </span>
          <input name="name" required minLength={2} maxLength={120} className="field" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-wider text-brown-soft">
            {t("emailField")}
          </span>
          <input
            type="email"
            name="email"
            required
            maxLength={200}
            className="field"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-wider text-brown-soft">
            {t("phoneField")}
          </span>
          <input type="tel" name="phone" maxLength={40} className="field" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-wider text-brown-soft">
            {t("subject")}
          </span>
          <input name="subject" maxLength={160} className="field" />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs uppercase tracking-wider text-brown-soft">
          {t("message")}
        </span>
        <textarea
          name="message"
          required
          minLength={10}
          maxLength={4000}
          rows={6}
          className="field resize-y"
        />
      </label>

      {state.status === "error" ? (
        <p
          role="alert"
          className="flex items-start gap-2.5 border border-danger/30 bg-danger/8 p-4 text-sm text-brown"
        >
          <AlertCircle size={17} className="mt-0.5 shrink-0 text-danger" />
          {t("error")}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
