import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

function isoDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

/** Yönetici veri bakım paneli: dönem sıfırlama ve tam sıfırlama. */
export function VeriYonetimi() {
  const { isSuperAdmin, role } = useAuth();
  const canManage = isSuperAdmin || role === "supervisor";
  const qc = useQueryClient();

  const [from, setFrom] = useState(isoDay(new Date(Date.now() - 6 * 86400000)));
  const [to, setTo] = useState(isoDay(new Date()));
  const [busy, setBusy] = useState(false);

  const fromIso = new Date(`${from}T00:00:00`).toISOString();
  const toIso = new Date(`${to}T23:59:59`).toISOString();

  const { data: counts } = useQuery({
    queryKey: ["veri-yonetimi-sayim", fromIso, toIso],
    enabled: canManage,
    queryFn: async () => {
      const [s, c] = await Promise.all([
        supabase.from("production_sessions").select("id", { count: "exact", head: true })
          .gte("baslangic", fromIso).lte("baslangic", toIso),
        supabase.from("plasma_cuts").select("id", { count: "exact", head: true })
          .gte("baslangic", fromIso).lte("baslangic", toIso),
      ]);
      return { oturum: s.count ?? 0, kesim: c.count ?? 0 };
    },
  });

  const { data: totals } = useQuery({
    queryKey: ["veri-yonetimi-toplam"],
    enabled: canManage,
    queryFn: async () => {
      const [s, c] = await Promise.all([
        supabase.from("production_sessions").select("id", { count: "exact", head: true }),
        supabase.from("plasma_cuts").select("id", { count: "exact", head: true }),
      ]);
      return { oturum: s.count ?? 0, kesim: c.count ?? 0 };
    },
  });

  if (!canManage) {
    return (
      <p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
        Bu bölüm yalnızca yöneticiler tarafından kullanılabilir.
      </p>
    );
  }

  function refresh() {
    qc.invalidateQueries();
  }

  async function deleteRange() {
    if (!confirm(`${from} — ${to} aralığındaki ${counts?.oturum ?? 0} iş oturumu ve ${counts?.kesim ?? 0} kesim kaydı silinecek. Devam edilsin mi?`)) return;
    if (!confirm("Bu işlem geri alınamaz. Onaylıyor musunuz?")) return;
    setBusy(true);
    const a = await supabase.from("production_sessions").delete().gte("baslangic", fromIso).lte("baslangic", toIso);
    const b = await supabase.from("plasma_cuts").delete().gte("baslangic", fromIso).lte("baslangic", toIso);
    setBusy(false);
    if (a.error || b.error) return toast.error((a.error ?? b.error)!.message);
    toast.success("Seçilen dönem sıfırlandı");
    refresh();
  }

  async function deleteAll() {
    if (!confirm("TÜM üretim ve OEE verileri (iş oturumları, duruşlar, kesim kayıtları) kalıcı olarak silinecek. Devam edilsin mi?")) return;
    if (!confirm("Bu işlem geri alınamaz. Sıfırdan başlamak istediğinizden emin misiniz?")) return;
    setBusy(true);
    const never = "1970-01-01T00:00:00.000Z";
    const a = await supabase.from("production_sessions").delete().gte("baslangic", never);
    const b = await supabase.from("plasma_cuts").delete().gte("baslangic", never);
    setBusy(false);
    if (a.error || b.error) return toast.error((a.error ?? b.error)!.message);
    toast.success("Tüm üretim verileri sıfırlandı");
    refresh();
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border bg-card p-5 shadow-industrial">
        <h2 className="font-display text-lg tracking-wide">VERİ ÖZETİ</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sistemde toplam <strong className="text-foreground">{totals?.oturum ?? 0}</strong> iş oturumu ve{" "}
          <strong className="text-foreground">{totals?.kesim ?? 0}</strong> kesim kaydı var.
        </p>
      </section>

      <section className="space-y-4 rounded-2xl border border-destructive/40 bg-destructive/5 p-5">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          <h2 className="font-display text-lg tracking-wide">TEHLİKELİ BÖLGE</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Silinen bir plazma oturumunun düşülmüş sac stoğu otomatik olarak stoğa geri iade edilir.
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Başlangıç</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Bitiş</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button variant="outline" className="w-full gap-2" disabled={busy} onClick={deleteRange}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Dönemi Sıfırla ({counts?.oturum ?? 0})
            </Button>
          </div>
        </div>

        <Button variant="destructive" className="gap-2" disabled={busy} onClick={deleteAll}>
          <Trash2 className="h-4 w-4" /> Tüm Üretim / OEE Verilerini Sıfırla
        </Button>
      </section>
    </div>
  );
}
