import { requireManager } from "@/lib/auth";
import { createUserClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/admin/settings-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Paramètres" };

export default async function SettingsPage() {
  await requireManager();

  const supabase = await createUserClient();
  const { data } = await supabase.from("settings").select("key, value, label");

  const map = Object.fromEntries(
    (data ?? []).map((row) => [row.key, row.value])
  ) as Record<string, unknown>;

  const num = (key: string, fallback: number) =>
    typeof map[key] === "number" ? (map[key] as number) : fallback;
  const str = (key: string, fallback: string) =>
    typeof map[key] === "string" ? (map[key] as string) : fallback;

  const contact = (map.hotel_contact ?? {}) as Record<string, string>;

  return (
    <div className="mx-auto max-w-3xl">
      <header>
        <h1 className="font-display text-2xl">Paramètres</h1>
        <p className="mt-1 text-sm text-brown-soft">
          Règles commerciales et coordonnées affichées sur le site
        </p>
      </header>

      <p className="mt-6 border border-ivory-line bg-cream p-4 text-xs leading-relaxed text-brown-soft">
        Ces réglages pilotent directement le moteur de réservation. Une
        modification s&apos;applique immédiatement aux nouvelles réservations —
        les séjours déjà enregistrés conservent les conditions en vigueur au
        moment de leur réservation.
      </p>

      <div className="mt-6">
        <SettingsForm
          values={{
            deposit_percent: num("deposit_percent", 30),
            hold_minutes: num("hold_minutes", 20),
            min_nights: num("min_nights", 1),
            max_nights: num("max_nights", 30),
            max_advance_days: num("max_advance_days", 365),
            free_cancellation_hours: num("free_cancellation_hours", 48),
            check_in_time: str("check_in_time", "14:00"),
            check_out_time: str("check_out_time", "12:00"),
            demo_mode: map.demo_mode === true,
            contact: {
              phone: contact.phone ?? "",
              whatsapp: contact.whatsapp ?? "",
              email: contact.email ?? "",
              address: contact.address ?? "",
              maps_query: contact.maps_query ?? "",
            },
          }}
        />
      </div>
    </div>
  );
}
