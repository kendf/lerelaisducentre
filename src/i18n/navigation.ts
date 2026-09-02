import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Remplace les primitives de navigation de Next.js par leurs équivalents
 * conscients de la langue. Un <Link href="/chambres"> écrit une fois produit
 * /fr/chambres ou /en/rooms selon le contexte : aucune URL n'est construite à
 * la main dans les pages, donc aucune ne peut être oubliée à la traduction.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
