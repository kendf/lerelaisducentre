import { Mail, Phone } from "lucide-react";
import { listContactMessages } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Messages" };

const STAMP = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Abidjan",
});

export default async function MessagesPage() {
  const messages = await listContactMessages();

  return (
    <div className="mx-auto max-w-4xl">
      <header>
        <h1 className="font-display text-2xl">Messages</h1>
        <p className="mt-1 text-sm text-brown-soft">
          Demandes reçues via le formulaire de contact du site
        </p>
      </header>

      {messages.length === 0 ? (
        <p className="mt-8 border border-dashed border-ivory-line bg-cream p-8 text-center text-sm text-brown-soft">
          Aucun message reçu.
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {messages.map((m) => (
            <li key={m.id} className="border border-ivory-line bg-cream p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <p className="text-sm">
                    {m.name}
                    {/* La langue du message oriente la réponse : un visiteur
                        anglophone doit recevoir une réponse en anglais. */}
                    <span className="ml-2 text-xs text-brown-soft">
                      {m.locale === "en" ? "écrit en anglais" : "écrit en français"}
                    </span>
                  </p>
                  {m.subject ? (
                    <p className="mt-0.5 text-xs text-bronze">{m.subject}</p>
                  ) : null}
                </div>
                <p className="text-xs text-brown-soft">
                  {STAMP.format(new Date(m.created_at))}
                </p>
              </div>

              <p className="mt-4 text-sm leading-relaxed whitespace-pre-line">
                {m.message}
              </p>

              <div className="mt-4 flex flex-wrap gap-5 border-t border-ivory-line pt-4 text-xs">
                <a
                  href={`mailto:${m.email}`}
                  className="inline-flex items-center gap-1.5 text-brown-soft hover:text-bronze"
                >
                  <Mail size={13} />
                  {m.email}
                </a>
                {m.phone ? (
                  <a
                    href={`tel:${String(m.phone).replace(/[^0-9+]/g, "")}`}
                    className="inline-flex items-center gap-1.5 text-brown-soft hover:text-bronze"
                  >
                    <Phone size={13} />
                    {m.phone}
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
