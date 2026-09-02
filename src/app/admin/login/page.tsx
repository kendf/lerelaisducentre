import { LoginForm } from "@/components/admin/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const suite = typeof sp.suite === "string" ? sp.suite : "/admin";

  return (
    <div className="flex min-h-screen items-center justify-center bg-ivory px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <p className="font-display text-xl tracking-wide text-brown">
            LE RELAIS <span className="text-bronze">DU CENTRE</span>
          </p>
          <p className="mt-2 text-xs uppercase tracking-[0.22em] text-brown-soft">
            Espace administration
          </p>
        </div>

        <div className="mt-9 border border-ivory-line bg-cream p-7">
          <LoginForm suite={suite} />
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-brown-soft">
          Accès réservé à l&apos;équipe de l&apos;hôtel. Les comptes sont créés
          par le gérant depuis l&apos;espace Utilisateurs.
        </p>
      </div>
    </div>
  );
}
