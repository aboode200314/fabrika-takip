import { createFileRoute, Link, Outlet, Navigate, useRouterState, useNavigate } from "@tanstack/react-router";
import { Gauge, LogOut, Loader2, BarChart3, Settings, Cpu } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useT } from "@/lib/i18n";
import gvnLogo from "@/assets/gvn-logo.jpg.asset.json";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { session, loading, role, profile, signOut, can, isSuperAdmin } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const t = useT();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!session) return <Navigate to="/giris" replace />;

  const isSupervisor = role === "supervisor" || isSuperAdmin;

  const allNav = [
    { to: "/panel" as const, label: t("nav.panel"), icon: Gauge, perm: "page.panel" },
    { to: "/makineler" as const, label: t("nav.machines"), icon: Cpu, perm: "page.raporlar" },
    { to: "/raporlar" as const, label: t("nav.reports"), icon: BarChart3, perm: "page.raporlar" },
    ...(isSupervisor
      ? [{ to: "/yonetim" as const, label: t("nav.management"), icon: Settings, perm: "page.yonetim" }]
      : []),
  ];
  const nav = allNav.filter((n) => can(n.perm));

  return (
    <div className="flex min-h-screen bg-background">
      {/* Masaüstü yan menü */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <Link to="/" className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <img src={gvnLogo.url} alt="GVN Trailer logosu" className="h-9 w-auto rounded bg-white p-1" />
          <span className="text-xs uppercase tracking-[0.2em] opacity-70">{t("app.section")}</span>
        </Link>

        <nav className="flex-1 space-y-1 p-3">
          {nav.map((n) => {
            const active = pathname === n.to;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "opacity-80 hover:bg-white/10 hover:opacity-100"
                }`}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3 text-xs">
          <div className="pb-2">
            <LanguageSwitcher variant="sidebar" />
          </div>
          <div className="px-2 pb-2 opacity-70">
            {profile?.ad_soyad ?? profile?.personel_id ?? ""}
            <div className="uppercase tracking-widest opacity-70">
              {isSupervisor ? t("role.supervisor") : t("role.operator")}
            </div>
          </div>
          <button
            onClick={async () => {
              await signOut();
              navigate({ to: "/giris" });
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm opacity-80 hover:bg-white/10 hover:opacity-100"
          >
            <LogOut className="h-4 w-4" /> {t("auth.signOut")}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        {/* Mobil üst bar */}
        <header className="sticky top-0 z-30 border-b border-border bg-card md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Link to="/" className="flex items-center gap-2">
              <img src={gvnLogo.url} alt="GVN Trailer logosu" className="h-7 w-auto" />
            </Link>
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <span className="text-xs text-muted-foreground">
                {profile?.ad_soyad ?? profile?.personel_id ?? ""}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/giris" });
                }}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          <Outlet />
        </main>
      </div>

      {/* Mobil alt navigasyon */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card md:hidden">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${Math.max(nav.length, 1)}, minmax(0, 1fr))` }}>
          {nav.map((n) => {
            const active = pathname === n.to;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`tap-target flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <n.icon className={`h-5 w-5 ${active ? "scale-110" : ""}`} />
                {n.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
