import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("notFound");

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-5 py-32 text-center">
      <p className="signature text-5xl">404</p>
      <h1 className="mt-4 text-3xl">{t("title")}</h1>
      <p className="mt-4 text-[15px] leading-relaxed text-brown-soft">{t("body")}</p>
      <Link href="/" className="btn btn-primary mt-9">
        {t("cta")}
      </Link>
    </div>
  );
}
