import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireStaff, isReceptionist } from "@/lib/auth";
import { createUserClient } from "@/lib/supabase/server";
import { DeskReservationForm } from "@/components/admin/desk-reservation-form";
import type { RoomTypeContent } from "@/types/database";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nouvelle réservation" };

export default async function NewReservationPage() {
  const staff = await requireStaff();

  // Écran de réception : c'est elle qui prend les appels et tient le comptoir.
  if (!isReceptionist(staff)) redirect("/admin/reservations");

  const supabase = await createUserClient();
  const { data } = await supabase
    .from("room_types")
    .select("id, content, base_price_xof, max_adults, max_children")
    .eq("is_published", true)
    .order("sort_order");

  const roomTypes = (data ?? []).map((rt) => ({
    id: rt.id as string,
    name: (rt.content as RoomTypeContent).fr.name,
    basePriceXof: rt.base_price_xof as number,
    maxAdults: rt.max_adults as number,
    maxChildren: rt.max_children as number,
  }));

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/admin/reservations"
        className="inline-flex items-center gap-2 text-sm text-brown-soft transition-colors hover:text-bronze"
      >
        <ArrowLeft size={15} />
        Toutes les réservations
      </Link>

      <header className="mt-5">
        <h1 className="font-display text-2xl">Nouvelle réservation</h1>
        <p className="mt-1 text-sm text-brown-soft">
          Pour une demande reçue par téléphone, par WhatsApp ou au comptoir
        </p>
      </header>

      {roomTypes.length === 0 ? (
        <p className="mt-8 border border-dashed border-ivory-line bg-cream p-8 text-center text-sm text-brown-soft">
          Aucune catégorie publiée : demandez à la gérance d&apos;en mettre une
          en ligne.
        </p>
      ) : (
        <>
          <p className="mt-6 border border-ivory-line bg-cream p-4 text-xs leading-relaxed text-brown-soft">
            La chambre est bloquée dès l&apos;enregistrement, exactement comme
            pour une réservation en ligne. Le site ne pourra plus la revendre.
          </p>
          <div className="mt-6">
            <DeskReservationForm roomTypes={roomTypes} />
          </div>
        </>
      )}
    </div>
  );
}
