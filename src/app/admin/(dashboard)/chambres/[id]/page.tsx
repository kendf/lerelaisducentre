import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, ExternalLink } from "lucide-react";

import { requireManager } from "@/lib/auth";
import { createUserClient } from "@/lib/supabase/server";
import { RoomTypeForm } from "@/components/admin/room-type-form";
import type { RoomTypeContent } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function EditRoomTypePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireManager();

  const { id } = await params;
  const sp = await searchParams;
  const justCreated = sp.cree === "1";

  const supabase = await createUserClient();
  const { data } = await supabase
    .from("room_types")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  const content = data.content as RoomTypeContent;

  // Compte les nuitées à venir : le gérant doit savoir ce que cette catégorie
  // porte déjà avant d'en réduire le stock ou de la retirer du site.
  const { count: upcoming } = await supabase
    .from("reservation_nights")
    .select("night", { count: "exact", head: true })
    .eq("room_type_id", id)
    .gte("night", new Date().toISOString().slice(0, 10));

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/admin/chambres"
        className="inline-flex items-center gap-2 text-sm text-brown-soft transition-colors hover:text-bronze"
      >
        <ArrowLeft size={15} />
        Chambres &amp; tarifs
      </Link>

      <header className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl">{content.fr.name}</h1>
          <p className="numeric mt-1 text-sm text-brown-soft">{data.slug}</p>
        </div>
        {data.is_published ? (
          <a
            href={`/fr/chambres/${data.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-bronze transition-colors hover:text-bronze-dark"
          >
            Voir sur le site
            <ExternalLink size={13} />
          </a>
        ) : null}
      </header>

      {justCreated ? (
        <p
          role="status"
          className="mt-6 flex items-start gap-2 border border-palm/30 bg-palm/8 p-4 text-sm"
        >
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-palm" />
          Catégorie créée. Complétez les photographies et cochez « visible sur le
          site » quand elle est prête.
        </p>
      ) : null}

      {(upcoming ?? 0) > 0 ? (
        <p className="mt-6 border border-ivory-line bg-cream p-4 text-xs leading-relaxed text-brown-soft">
          <span className="numeric">{upcoming}</span> nuitée
          {(upcoming ?? 0) > 1 ? "s" : ""} déjà réservée
          {(upcoming ?? 0) > 1 ? "s" : ""} sur cette catégorie pour les jours à
          venir. Réduire le nombre de chambres ou retirer la catégorie du site
          n&apos;annule aucune de ces réservations.
        </p>
      ) : null}

      <div className="mt-8">
        <RoomTypeForm
          mode="edit"
          values={{
            id: data.id,
            slug: data.slug,
            nameFr: content.fr.name ?? "",
            nameEn: content.en.name ?? "",
            shortFr: content.fr.short ?? "",
            shortEn: content.en.short ?? "",
            descriptionFr: content.fr.description ?? "",
            descriptionEn: content.en.description ?? "",
            basePriceXof: data.base_price_xof,
            maxAdults: data.max_adults,
            maxChildren: data.max_children,
            totalUnits: data.total_units,
            surfaceM2: data.surface_m2,
            bedConfig: data.bed_config ?? "",
            amenities: data.amenities ?? [],
            sortOrder: data.sort_order,
            isPublished: data.is_published,
          }}
        />
      </div>
    </div>
  );
}
