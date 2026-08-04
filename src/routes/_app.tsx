import { createFileRoute, Link, Outlet, Navigate, useRouterState, useNavigate } from "@tanstack/react-router";
import { Factory, Gauge, ClipboardList, AlertTriangle, ShieldCheck, LogOut, Loader2, BarChart3, Settings } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { session, loading, role, profile, signOut, can, isSuperAdmin } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

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
    { to: "/panel" as const, label: "Panel", icon: Gauge, perm: "page.panel" },
    { to: "/raporlar" as const, label: "Raporlar", icon: BarChart3, perm: "page.raporlar" },
    ...(isSupervisor
      ? [{ to: "/yonetim" as const, label: "Yönetim", icon: Settings, perm: "page.yonetim" }]
      : []),
  ];
  const nav = allNav.filter((n) => can(n.perm));




  return (
    <div className="flex min-h-screen flex-col bg-background pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/30">
              <Factory className="h-5 w-5 text-primary" />
            </div>
            <div className="leading-tight">
              <div className="font-display text-lg tracking-wide">FABRİKA OEE</div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                {isSupervisor ? "Süpervizör" : "Operatör"} · {profile?.ad_soyad ?? profile?.personel_id ?? ""}
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((n) => {
              const active = pathname === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <n.icon className="h-4 w-4" />
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await signOut();
              navigate({ to: "/giris" });
            }}
            className="tap-target gap-2"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Çıkış</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      {/* Mobil alt navigasyon */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card/95 backdrop-blur md:hidden">
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
