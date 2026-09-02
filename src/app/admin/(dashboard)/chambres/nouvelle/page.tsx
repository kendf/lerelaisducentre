import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireManager } from "@/lib/auth";
import {
  RoomTypeForm,
  EMPTY_ROOM_TYPE,
} from "@/components/admin/room-type-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nouvelle catégorie" };

export default async function NewRoomTypePage() {
  await requireManager();

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/admin/chambres"
        className="inline-flex items-center gap-2 text-sm text-brown-soft transition-colors hover:text-bronze"
      >
        <ArrowLeft size={15} />
        Chambres &amp; tarifs
      </Link>

      <header className="mt-5">
        <h1 className="font-display text-2xl">Nouvelle catégorie</h1>
        <p className="mt-1 text-sm text-brown-soft">
          Elle reste hors ligne tant que vous ne cochez pas « visible sur le
          site » — vous pouvez donc la préparer tranquillement.
        </p>
      </header>

      <div className="mt-8">
        <RoomTypeForm values={EMPTY_ROOM_TYPE} mode="create" />
      </div>
    </div>
  );
}
