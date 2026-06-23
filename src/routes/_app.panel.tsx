import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, AlertTriangle, ShieldCheck, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/panel")({
  component: OperatorPanel,
});

const cards = [
  {
    to: "/uretim" as const,
    title: "Üretim Girişi",
    desc: "Vardiyanda ürettiğin miktarı kaydet",
    icon: ClipboardList,
    accent: "from-primary/30 to-primary/5",
    iconCls: "text-primary",
  },
  {
    to: "/durus" as const,
    title: "Duruş Bildirimi",
    desc: "Makine duruşunu ve nedenini bildir",
    icon: AlertTriangle,
    accent: "from-warning/30 to-warning/5",
    iconCls: "text-warning",
  },
  {
    to: "/kalite" as const,
    title: "Kalite Raporu",
    desc: "Hatalı / red ürün miktarını gir",
    icon: ShieldCheck,
    accent: "from-destructive/30 to-destructive/5",
    iconCls: "text-destructive",
  },
];

function OperatorPanel() {
  const { user, profile } = useAuth();
  const { data: counts } = useQuery({
    queryKey: ["operator-today-counts", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      const sinceIso = since.toISOString();
      const [{ data: prod }, { data: dur }, { data: kal }] = await Promise.all([
        supabase
          .from("production_logs")
          .select("miktar")
          .eq("operator_id", user!.id)
          .gte("created_at", sinceIso),
        supabase
          .from("downtime_logs")
          .select("sure_dakika")
          .eq("operator_id", user!.id)
          .gte("created_at", sinceIso),
        supabase
          .from("quality_logs")
          .select("red_miktari")
          .eq("operator_id", user!.id)
          .gte("created_at", sinceIso),
      ]);
      return {
        uretim: (prod ?? []).reduce((s, r) => s + (r.miktar ?? 0), 0),
        durus: (dur ?? []).reduce((s, r) => s + (r.sure_dakika ?? 0), 0),
        red: (kal ?? []).reduce((s, r) => s + (r.red_miktari ?? 0), 0),
      };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Hoş geldin</p>
        <h1 className="mt-1 text-3xl tracking-tight">
          {profile?.ad_soyad ?? profile?.personel_id ?? "Operatör"}
        </h1>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Bugün Üretim" value={counts?.uretim ?? 0} unit="adet" tone="primary" />
        <Stat label="Bugün Duruş" value={counts?.durus ?? 0} unit="dk" tone="warning" />
        <Stat label="Bugün Red" value={counts?.red ?? 0} unit="adet" tone="destructive" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br ${c.accent} p-6 transition-all hover:scale-[1.02] hover:shadow-industrial`}
          >
            <div className="flex items-start justify-between">
              <c.icon className={`h-12 w-12 ${c.iconCls}`} strokeWidth={1.5} />
              <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </div>
            <h3 className="mt-6 text-2xl tracking-tight">{c.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: number;
  unit: string;
  tone: "primary" | "warning" | "destructive";
}) {
  const toneCls = {
    primary: "text-primary",
    warning: "text-warning",
    destructive: "text-destructive",
  }[tone];
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-2 font-display text-3xl ${toneCls}`}>
        {value}
        <span className="ml-1 text-sm text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}
