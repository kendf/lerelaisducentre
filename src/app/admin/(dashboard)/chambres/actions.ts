"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createUserClient } from "@/lib/supabase/server";
import { getStaffMember, isManager } from "@/lib/auth";

export interface RoomTypeState {
  status: "idle" | "error" | "success";
  message?: string;
}

/**
 * Transforme un nom en identifiant d'URL.
 * « Chambre Supérieure Vue Jardin » → « chambre-superieure-vue-jardin ».
 * Les accents sont décomposés puis retirés : un slug doit rester lisible dans
 * une adresse, et une URL accentuée se transmet mal (copier-coller, SMS).
 */
function slugify(input: string): string {
  return input
    .normalize("NFD")
    // Retire les signes diacritiques décomposés par NFD (accents, cédilles).
    // Écrit en échappements : ces caractères combinants sont invisibles dans un
    // éditeur et se perdent au premier copier-coller mal encodé.
    .replace(new RegExp("[\u0300-\u036f]", "g"), "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

interface ParsedRoomType {
  slug: string;
  content: {
    fr: { name: string; short: string; description: string };
    en: { name: string; short: string; description: string };
  };
  base_price_xof: number;
  max_adults: number;
  max_children: number;
  total_units: number;
  surface_m2: number | null;
  bed_config: string | null;
  amenities: string[];
  sort_order: number;
  is_published: boolean;
}

/** Lecture et validation communes à la création et à la modification. */
function parseForm(formData: FormData): ParsedRoomType | string {
  const nameFr = String(formData.get("name_fr") ?? "").trim();
  const nameEn = String(formData.get("name_en") ?? "").trim();

  if (nameFr.length < 3) return "Le nom français est requis (3 caractères minimum).";
  if (nameEn.length < 3) return "Le nom anglais est requis : le site est bilingue.";

  const price = Number(formData.get("base_price_xof") ?? 0);
  if (!Number.isInteger(price) || price <= 0) {
    return "Le tarif doit être un entier positif, en FCFA.";
  }

  const units = Number(formData.get("total_units") ?? 0);
  if (!Number.isInteger(units) || units < 1 || units > 200) {
    return "Le nombre de chambres doit être compris entre 1 et 200.";
  }

  const adults = Number(formData.get("max_adults") ?? 2);
  const children = Number(formData.get("max_children") ?? 0);
  if (!Number.isInteger(adults) || adults < 1 || adults > 10) {
    return "La capacité en adultes doit être comprise entre 1 et 10.";
  }
  if (!Number.isInteger(children) || children < 0 || children > 10) {
    return "La capacité en enfants doit être comprise entre 0 et 10.";
  }

  const surfaceRaw = String(formData.get("surface_m2") ?? "").trim();
  const surface = surfaceRaw === "" ? null : Number(surfaceRaw);
  if (surface !== null && (!Number.isInteger(surface) || surface < 1 || surface > 999)) {
    return "La surface doit être un nombre entier de mètres carrés.";
  }

  const sortRaw = String(formData.get("sort_order") ?? "0").trim();
  const sort = sortRaw === "" ? 0 : Number(sortRaw);
  if (!Number.isInteger(sort) || sort < 0 || sort > 999) {
    return "L'ordre d'affichage doit être un entier positif.";
  }

  // Les équipements arrivent en champs répétés `amenity`. On retire les vides
  // (lignes ajoutées puis laissées en blanc) et les doublons.
  const amenities = Array.from(
    new Set(
      formData
        .getAll("amenity")
        .map((value) => String(value).trim())
        .filter((value) => value.length > 0 && value.length <= 80)
    )
  );

  const slugRaw = String(formData.get("slug") ?? "").trim();
  const slug = slugRaw ? slugify(slugRaw) : slugify(nameFr);
  if (!slug) return "Impossible de déduire un identifiant depuis ce nom.";

  return {
    slug,
    content: {
      fr: {
        name: nameFr,
        short: String(formData.get("short_fr") ?? "").trim(),
        description: String(formData.get("description_fr") ?? "").trim(),
      },
      en: {
        name: nameEn,
        short: String(formData.get("short_en") ?? "").trim(),
        description: String(formData.get("description_en") ?? "").trim(),
      },
    },
    base_price_xof: price,
    max_adults: adults,
    max_children: children,
    total_units: units,
    surface_m2: surface,
    bed_config: String(formData.get("bed_config") ?? "").trim() || null,
    amenities,
    sort_order: sort,
    is_published: formData.get("is_published") === "on",
  };
}

export async function createRoomType(
  _prev: RoomTypeState,
  formData: FormData
): Promise<RoomTypeState> {
  const staff = await getStaffMember();
  if (!staff || !isManager(staff)) {
    return { status: "error", message: "Réservé au gérant." };
  }

  const parsed = parseForm(formData);
  if (typeof parsed === "string") return { status: "error", message: parsed };

  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("room_types")
    .insert(parsed)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        status: "error",
        message: `Une catégorie utilise déjà l'identifiant « ${parsed.slug} ». Modifiez le nom ou l'identifiant.`,
      };
    }
    console.error("[admin] createRoomType:", error.message);
    return { status: "error", message: "La création a échoué." };
  }

  await supabase.from("audit_log").insert({
    actor_id: staff.id,
    actor_label: staff.full_name,
    action: "room_type.create",
    entity: "room_types",
    entity_id: data.id,
    after: parsed,
  });

  revalidatePath("/admin/chambres");
  revalidatePath("/admin/planning");
  revalidatePath("/", "layout");

  redirect(`/admin/chambres/${data.id}?cree=1`);
}

export async function updateRoomType(
  _prev: RoomTypeState,
  formData: FormData
): Promise<RoomTypeState> {
  const staff = await getStaffMember();
  if (!staff || !isManager(staff)) {
    return { status: "error", message: "Réservé au gérant." };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) return { status: "error", message: "Catégorie inconnue." };

  const parsed = parseForm(formData);
  if (typeof parsed === "string") return { status: "error", message: parsed };

  const supabase = await createUserClient();

  const { data: before } = await supabase
    .from("room_types")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  // Réduire le stock sous les nuitées déjà vendues reste autorisé — une chambre
  // peut être réellement hors service — mais on prévient : les réservations
  // existantes ne sont pas annulées pour autant.
  let warning = "";
  if (before && parsed.total_units < before.total_units) {
    const { count } = await supabase
      .from("reservation_nights")
      .select("night", { count: "exact", head: true })
      .eq("room_type_id", id)
      .gte("night", new Date().toISOString().slice(0, 10));

    if ((count ?? 0) > 0) {
      warning =
        " Attention : des réservations à venir portent déjà sur cette catégorie. Elles restent valables, mais la disponibilité affichée diminue.";
    }
  }

  const { error } = await supabase.from("room_types").update(parsed).eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return {
        status: "error",
        message: `Une autre catégorie utilise déjà l'identifiant « ${parsed.slug} ».`,
      };
    }
    console.error("[admin] updateRoomType:", error.message);
    return { status: "error", message: "La mise à jour a échoué." };
  }

  await supabase.from("audit_log").insert({
    actor_id: staff.id,
    actor_label: staff.full_name,
    action: "room_type.update",
    entity: "room_types",
    entity_id: id,
    before,
    after: parsed,
  });

  revalidatePath("/admin/chambres");
  revalidatePath("/admin/planning");
  revalidatePath("/", "layout");

  return { status: "success", message: `Catégorie enregistrée.${warning}` };
}
