"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BedDouble,
  CalendarRange,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Settings,
  Tag,
  Users,
  X,
} from "lucide-react";
import { signOut } from "@/app/admin/login/actions";
import { cn } from "@/lib/utils";
import type { StaffRole } from "@/types/database";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Rôles autorisés à voir l'entrée. La garde réelle est côté serveur. */
  roles: StaffRole[];
}

const ALL: StaffRole[] = ["receptionist", "manager", "admin"];

const ITEMS: NavItem[] = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard, roles: ALL },
  { href: "/admin/reservations", label: "Réservations", icon: CalendarRange, roles: ALL },
  { href: "/admin/planning", label: "Planning", icon: BedDouble, roles: ALL },
  { href: "/admin/messages", label: "Messages", icon: Mail, roles: ALL },
  {
    href: "/admin/chambres",
    label: "Chambres & tarifs",
    icon: Tag,
    roles: ["manager", "admin"],
  },
  {
    href: "/admin/parametres",
    label: "Paramètres",
    icon: Settings,
    roles: ["manager", "admin"],
  },
  {
    // Les accès se distribuent depuis l'administration, pas depuis la gérance :
    // un compte d'exploitation compromis ne doit pas pouvoir en créer d'autres.
    href: "/admin/utilisateurs",
    label: "Utilisateurs",
    icon: Users,
    roles: ["admin"],
  },
];

const ROLE_LABEL: Record<StaffRole, string> = {
  receptionist: "Réception",
  manager: "Gérance",
  admin: "Administration",
};

function useActive(href: string) {
  const pathname = usePathname();
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

function NavLink({
  item,
  variant,
  onNavigate,
}: {
  item: NavItem;
  variant: "sidebar" | "horizontal" | "mobile";
  onNavigate?: () => void;
}) {
  const active = useActive(item.href);
  const Icon = item.icon;

  if (variant === "horizontal") {
    return (
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          // Onglet souligné : le repère habituel des logiciels de gestion.
          // Le trait porte l'état actif en plus de la couleur, donc
          // l'information ne repose pas uniquement sur la perception des teintes.
          "relative flex items-center gap-2 border-b-2 px-1 py-4 text-sm whitespace-nowrap transition-colors",
          active
            ? "border-bronze text-bronze"
            : "border-transparent text-brown-soft hover:border-ivory-line hover:text-brown"
        )}
      >
        <Icon size={15} className="shrink-0" />
        {item.label}
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
        active
          ? "bg-bronze text-ivory"
          : "text-brown-soft hover:bg-ivory-line/50 hover:text-brown"
      )}
    >
      <Icon size={16} className="shrink-0" />
      {item.label}
    </Link>
  );
}

function UserBlock({
  fullName,
  role,
  compact = false,
}: {
  fullName: string;
  role: StaffRole;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "flex items-center gap-4" : ""}>
      <div className={compact ? "text-right" : ""}>
        <p className="truncate text-sm text-brown">{fullName}</p>
        <p className="text-xs text-brown-soft">{ROLE_LABEL[role]}</p>
      </div>
      <form action={signOut} className={compact ? "" : "mt-3"}>
        <button
          type="submit"
          className="flex items-center gap-2 text-xs uppercase tracking-wider text-brown-soft transition-colors hover:text-bronze"
        >
          <LogOut size={14} />
          <span className={compact ? "sr-only xl:not-sr-only" : ""}>
            Se déconnecter
          </span>
        </button>
      </form>
    </div>
  );
}

/**
 * Navigation du back-office, en deux dispositions.
 *
 * MOBILE ET TABLETTE : barre supérieure et menu dépliant, identiques pour tous
 * les rôles. La réception travaille aussi depuis une tablette (CDC §3.1).
 *
 * ORDINATEUR : la disposition suit le nombre d'entrées accessibles.
 *   - Réception (4 entrées) : onglets horizontaux. Une colonne latérale de
 *     240 px pour quatre liens gaspille un cinquième de l'écran sur des
 *     tableaux de réservations qui, eux, ont besoin de largeur. L'identité et
 *     le bloc utilisateur sont plaqués aux bords de la fenêtre ; seuls les
 *     onglets restent centrés.
 *   - Gérance et administration : colonne latérale, FIXE au défilement
 *     (`sticky top-0 h-screen`). Elle reste sous la main quand le planning ou
 *     la liste des réservations s'allongent sur plusieurs écrans.
 */
export function AdminNav({
  fullName,
  role,
  sidebar,
}: {
  fullName: string;
  role: StaffRole;
  sidebar: boolean;
}) {
  const [open, setOpen] = useState(false);

  // Les entrées non autorisées sont retirées du menu, mais c'est la couche
  // serveur qui refuse réellement l'accès : cacher un lien n'est pas une
  // protection.
  const visible = ITEMS.filter((item) => item.roles.includes(role));

  const mobile = (
    <>
      <div className="flex items-center justify-between border-b border-ivory-line bg-cream px-5 py-3.5 lg:hidden">
        <span className="font-display text-base tracking-wide">
          LE RELAIS <span className="text-bronze">DU CENTRE</span>
        </span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          className="p-1.5 text-brown"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open ? (
        <nav
          className="border-b border-ivory-line bg-cream lg:hidden"
          aria-label="Navigation principale"
        >
          {visible.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              variant="mobile"
              onNavigate={() => setOpen(false)}
            />
          ))}
          <div className="border-t border-ivory-line px-4 py-4">
            <UserBlock fullName={fullName} role={role} />
          </div>
        </nav>
      ) : null}
    </>
  );

  if (!sidebar) {
    return (
      <>
        {mobile}
        <header className="hidden border-b border-ivory-line bg-cream lg:block">
          {/* Pas de conteneur centré ici : l'identité se cale à gauche de la
              fenêtre et le bloc utilisateur à droite. Seuls les onglets sont
              centrés, par le `flex-1 justify-center` de la nav. */}
          <div className="flex items-center gap-8 px-5">
            <span className="font-display text-base tracking-wide whitespace-nowrap">
              LE RELAIS <span className="text-bronze">DU CENTRE</span>
            </span>
            <nav
              className="flex flex-1 items-center justify-center gap-8"
              aria-label="Navigation principale"
            >
              {visible.map((item) => (
                <NavLink key={item.href} item={item} variant="horizontal" />
              ))}
            </nav>
            <UserBlock fullName={fullName} role={role} compact />
          </div>
        </header>
      </>
    );
  }

  return (
    <>
      {mobile}
      <aside className="hidden w-60 shrink-0 border-r border-ivory-line bg-cream lg:block">
        {/* `sticky` + `h-screen` : la colonne reste en place quand la page
            défile. Sans cela, on perd sa navigation dès qu'on descend dans un
            planning de trente jours. */}
        <div className="sticky top-0 flex h-screen flex-col">
          <div className="px-5 py-6">
            <p className="font-display text-base tracking-wide">
              LE RELAIS <span className="text-bronze">DU CENTRE</span>
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-brown-soft">
              Administration
            </p>
          </div>

          {/* Si le menu dépasse la hauteur d'écran, c'est LUI qui défile, pas
              la page entière. */}
          <nav className="flex-1 overflow-y-auto" aria-label="Navigation principale">
            {visible.map((item) => (
              <NavLink key={item.href} item={item} variant="sidebar" />
            ))}
          </nav>

          <div className="border-t border-ivory-line px-4 py-4">
            <UserBlock fullName={fullName} role={role} />
          </div>
        </div>
      </aside>
    </>
  );
}
