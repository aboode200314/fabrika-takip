import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Pencil, Trash2, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

function isoDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}
const dtFmt = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
});

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Row {
  id: string;
  operator_id: string;
  machine_id: string;
  product_id: string | null;
  vardiya: string;
  baslangic: string;
  bitis: string | null;
  sure_dakika: number | null;
  miktar: number | null;
  hurda: number | null;
  notlar: string | null;
}

export function OturumRaporu() {
  const { isSuperAdmin, role } = useAuth();
  const canEdit = isSuperAdmin || role === "supervisor";
  const qc = useQueryClient();

  const [from, setFrom] = useState(isoDay(new Date(Date.now() - 6 * 86400000)));
  const [to, setTo] = useState(isoDay(new Date()));
  const [operator, setOperator] = useState("all");
  const [machine, setMachine] = useState("all");
  const [editing, setEditing] = useState<Row | null>(null);

  const { data: profiles } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,ad_soyad,personel_id").order("ad_soyad");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: machines } = useQuery({
    queryKey: ["machines-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("machines").select("id,kod,ad").order("kod");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id,kod,ad").order("kod");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: rows } = useQuery({
    queryKey: ["session-history", from, to, operator, machine],
    queryFn: async () => {
      let q = supabase
        .from("production_sessions")
        .select("id,operator_id,machine_id,product_id,vardiya,baslangic,bitis,sure_dakika,miktar,hurda,notlar")
        .gte("baslangic", new Date(`${from}T00:00:00`).toISOString())
        .lte("baslangic", new Date(`${to}T23:59:59`).toISOString())
        .order("baslangic", { ascending: false });
      if (operator !== "all") q = q.eq("operator_id", operator);
      if (machine !== "all") q = q.eq("machine_id", machine);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const nameOf = (id: string) => {
    const p = profiles?.find((x) => x.id === id);
    return p?.ad_soyad ?? p?.personel_id ?? "—";
  };
  const machineOf = (id: string) => machines?.find((m) => m.id === id)?.kod ?? "—";
  const productOf = (id: string | null) => (id ? (products?.find((p) => p.id === id)?.ad ?? "—") : "—");

  const totals = useMemo(
    () =>
      (rows ?? []).reduce(
        (s, r) => ({
          miktar: s.miktar + (r.miktar ?? 0),
          hurda: s.hurda + (r.hurda ?? 0),
          saat: s.saat + Number(r.sure_dakika ?? 0) / 60,
        }),
        { miktar: 0, hurda: 0, saat: 0 },
      ),
    [rows],
  );

  async function saveEdit() {
    if (!editing) return;
    const { error } = await supabase
      .from("production_sessions")
      .update({
        machine_id: editing.machine_id,
        product_id: editing.product_id,
        baslangic: new Date(editing.baslangic).toISOString(),
        bitis: editing.bitis ? new Date(editing.bitis).toISOString() : null,
        miktar: editing.miktar,
        hurda: editing.hurda ?? 0,
        notlar: editing.notlar,
      })
      .eq("id", editing.id);
    if (error) return toast.error("Güncellenemedi: " + error.message);
    toast.success("Kayıt güncellendi");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["session-history"] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("production_sessions").delete().eq("id", id);
    if (error) return toast.error("Silinemedi: " + error.message);
    toast.success("Kayıt silindi");
    qc.invalidateQueries({ queryKey: ["session-history"] });
  }

  function exportCsv() {
    const head = ["Başlangıç", "Bitiş", "Süre (dk)", "Operatör", "Makine", "Ürün", "Vardiya", "Miktar", "Hurda"];
    const lines = (rows ?? []).map((r) =>
      [
        r.baslangic, r.bitis ?? "", (r.sure_dakika ?? 0).toString(), nameOf(r.operator_id),
        machineOf(r.machine_id), productOf(r.product_id), r.vardiya, r.miktar ?? 0, r.hurda ?? 0,
      ].join(";"),
    );
    const csv = "\uFEFF" + [head.join(";"), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `is-oturumlari-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border bg-card p-5 shadow-industrial">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Başlangıç</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="tap-target" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Bitiş</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="tap-target" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Operatör</Label>
            <Select value={operator} onValueChange={setOperator}>
              <SelectTrigger className="tap-target"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                {profiles?.map((p) => <SelectItem key={p.id} value={p.id}>{p.ad_soyad ?? p.personel_id}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Makine</Label>
            <Select value={machine} onValueChange={setMachine}>
              <SelectTrigger className="tap-target"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                {machines?.map((m) => <SelectItem key={m.id} value={m.id}>{m.kod} — {m.ad}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-industrial">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg tracking-wide">İŞ OTURUMLARI</h2>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>Toplam: {totals.miktar} adet · {totals.hurda} hurda · {totals.saat.toFixed(1)} saat</span>
            <Button variant="outline" size="sm" className="gap-2" onClick={exportCsv} disabled={!rows?.length}>
              <Download className="h-4 w-4" /> CSV
            </Button>
          </div>
        </div>

        {!rows?.length ? (
          <p className="text-sm text-muted-foreground">Kayıt bulunamadı.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2">Başlangıç</th>
                  <th className="py-2">Bitiş</th>
                  <th className="py-2">Süre</th>
                  <th className="py-2">Operatör</th>
                  <th className="py-2">Makine</th>
                  <th className="py-2">Ürün</th>
                  <th className="py-2">Miktar</th>
                  <th className="py-2">Hurda</th>
                  {canEdit && <th className="py-2" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border/60">
                    <td className="py-2">{dtFmt.format(new Date(r.baslangic))}</td>
                    <td className="py-2">{r.bitis ? dtFmt.format(new Date(r.bitis)) : <span className="text-success">Devam ediyor</span>}</td>
                    <td className="py-2">{r.sure_dakika ? `${Number(r.sure_dakika).toFixed(0)} dk` : "—"}</td>
                    <td className="py-2">{nameOf(r.operator_id)}</td>
                    <td className="py-2">{machineOf(r.machine_id)}</td>
                    <td className="py-2">{productOf(r.product_id)}</td>
                    <td className="py-2 font-medium">{r.miktar ?? "—"}</td>
                    <td className="py-2">{r.hurda ?? 0}</td>
                    {canEdit && (
                      <td className="py-2">
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setEditing({ ...r, baslangic: toLocalInput(r.baslangic), bitis: r.bitis ? toLocalInput(r.bitis) : null })}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => remove(r.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && (
        <section className="rounded-2xl border-2 border-primary/40 bg-card p-5 shadow-industrial">
          <h3 className="mb-3 font-display text-lg tracking-wide">KAYIT DÜZENLE</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Makine</Label>
              <Select value={editing.machine_id} onValueChange={(v) => setEditing({ ...editing, machine_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {machines?.map((m) => <SelectItem key={m.id} value={m.id}>{m.kod} — {m.ad}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ürün</Label>
              <Select value={editing.product_id ?? ""} onValueChange={(v) => setEditing({ ...editing, product_id: v })}>
                <SelectTrigger><SelectValue placeholder="Ürün" /></SelectTrigger>
                <SelectContent>
                  {products?.map((p) => <SelectItem key={p.id} value={p.id}>{p.kod} — {p.ad}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Başlangıç</Label>
              <Input type="datetime-local" value={editing.baslangic} onChange={(e) => setEditing({ ...editing, baslangic: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Bitiş</Label>
              <Input type="datetime-local" value={editing.bitis ?? ""} onChange={(e) => setEditing({ ...editing, bitis: e.target.value || null })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Miktar</Label>
              <Input type="number" value={editing.miktar ?? ""} onChange={(e) => setEditing({ ...editing, miktar: e.target.value === "" ? null : Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Hurda</Label>
              <Input type="number" value={editing.hurda ?? 0} onChange={(e) => setEditing({ ...editing, hurda: Number(e.target.value) })} />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button className="gap-2" onClick={saveEdit}><Check className="h-4 w-4" /> Kaydet</Button>
            <Button variant="outline" className="gap-2" onClick={() => setEditing(null)}><X className="h-4 w-4" /> Vazgeç</Button>
          </div>
        </section>
      )}
    </div>
  );
}
