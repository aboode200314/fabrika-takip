import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Download, Filter, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { levhaKg } from "@/lib/sac";

const timeFmt = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
});

function isoDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

const dateFmt = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });

export function SacKesimRaporu() {
  const qc = useQueryClient();
  const { can } = useAuth();
  const today = isoDay(new Date());
  const weekAgo = isoDay(new Date(Date.now() - 6 * 86400000));
  const [from, setFrom] = useState(weekAgo);
  const [to, setTo] = useState(today);
  const [operator, setOperator] = useState("all");
  const [machine, setMachine] = useState("all");
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ uzunluk: "", genislik: "", kalinlik: "", levha: "", tip: "" });

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

  const { data: rows } = useQuery({
    queryKey: ["sac-kesim", from, to, operator, machine],
    queryFn: async () => {
      let q = supabase
        .from("plasma_cuts")
        .select("id,operator_id,machine_id,sac_tipi,uzunluk_mm,genislik_mm,kalinlik_mm,yogunluk,levha_adedi,toplam_agirlik_kg,sure_dakika,baslangic")
        .gte("baslangic", new Date(`${from}T00:00:00`).toISOString())
        .lte("baslangic", new Date(`${to}T23:59:59`).toISOString())
        .order("baslangic");
      if (operator !== "all") q = q.eq("operator_id", operator);
      if (machine !== "all") q = q.eq("machine_id", machine);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { gun: string; kalinlik: string; olcu: string; tip: string; kesim: number; levha: number; kg: number; dk: number }
    >();
    for (const r of rows ?? []) {
      const gun = new Date(r.baslangic).toISOString().slice(0, 10);
      const kalinlik = `${Number(r.kalinlik_mm)} mm`;
      const olcu = `${Number(r.uzunluk_mm)}×${Number(r.genislik_mm)}`;
      const tip = r.sac_tipi ?? "—";
      const key = `${gun}|${kalinlik}|${olcu}|${tip}`;
      const e = map.get(key) ?? { gun, kalinlik, olcu, tip, kesim: 0, levha: 0, kg: 0, dk: 0 };
      e.kesim += 1;
      e.levha += r.levha_adedi ?? 0;
      e.kg += Number(r.toplam_agirlik_kg ?? 0);
      e.dk += Number(r.sure_dakika ?? 0);
      map.set(key, e);
    }
    return [...map.values()].sort((a, b) => (a.gun === b.gun ? b.levha - a.levha : b.gun.localeCompare(a.gun)));
  }, [rows]);


  const totals = useMemo(
    () =>
      grouped.reduce(
        (s, g) => ({ kesim: s.kesim + g.kesim, levha: s.levha + g.levha, kg: s.kg + g.kg }),
        { kesim: 0, levha: 0, kg: 0 },
      ),
    [grouped],
  );

  function exportCsv() {
    const head = ["Tarih", "Kalınlık", "Ölçü (mm)", "Sac Tipi", "Kesim Sayısı", "Levha Adedi", "Toplam kg", "Süre (dk)"];
    const lines = grouped.map((g) =>
      [g.gun, g.kalinlik, g.olcu, g.tip, g.kesim, g.levha, g.kg.toFixed(1), g.dk.toFixed(1)].join(";"),
    );

    const csv = "\uFEFF" + [head.join(";"), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `sac-kesim-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border bg-card p-5 shadow-industrial">
        <div className="mb-3 flex items-center gap-2 text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span className="text-[11px] uppercase tracking-widest">Filtreler</span>
        </div>
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
                {profiles?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.ad_soyad ?? p.personel_id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Makine</Label>
            <Select value={machine} onValueChange={setMachine}>
              <SelectTrigger className="tap-target"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                {machines?.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.kod} — {m.ad}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-industrial">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg tracking-wide">SAC KESİM RAPORU</h2>
          <Button variant="outline" size="sm" className="gap-2" onClick={exportCsv} disabled={grouped.length === 0}>
            <Download className="h-4 w-4" /> CSV
          </Button>
        </div>

        {grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground">Seçilen filtrelerde kayıt bulunamadı.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2">Tarih</th>
                  <th className="py-2">Kalınlık</th>
                  <th className="py-2">Ölçü (mm)</th>
                  <th className="py-2">Tip</th>
                  <th className="py-2">Kesim Sayısı</th>
                  <th className="py-2">Levha Adedi</th>
                  <th className="py-2">Toplam kg</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map((g) => (
                  <tr key={`${g.gun}|${g.kalinlik}|${g.olcu}|${g.tip}`} className="border-t border-border/60">
                    <td className="py-2 font-medium">{dateFmt.format(new Date(g.gun))}</td>
                    <td className="py-2 font-display">{g.kalinlik}</td>
                    <td className="py-2 font-display">{g.olcu}</td>
                    <td className="py-2 text-muted-foreground">{g.tip}</td>
                    <td className="py-2">{g.kesim}</td>
                    <td className="py-2">{g.levha}</td>
                    <td className="py-2">{g.kg.toFixed(1)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border font-semibold">
                  <td className="py-2" colSpan={4}>TOPLAM</td>
                  <td className="py-2">{totals.kesim}</td>
                  <td className="py-2">{totals.levha}</td>
                  <td className="py-2">{totals.kg.toFixed(1)}</td>
                </tr>

              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-industrial">
        <h2 className="mb-3 font-display text-lg tracking-wide">KAYIT DETAYLARI</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          {can("kayit.duzenle") || can("kayit.sil")
            ? "Yanlış girilen kesim kayıtlarını buradan düzeltebilir veya silebilirsiniz. Ağırlık otomatik yeniden hesaplanır."
            : "Kayıtları görüntüleyebilirsiniz. Düzenleme yetkisi yöneticide."}
        </p>
        {(rows ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Seçilen filtrelerde kayıt bulunamadı.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2">Zaman</th>
                  <th className="py-2">Tip</th>
                  <th className="py-2">Uzunluk</th>
                  <th className="py-2">Genişlik</th>
                  <th className="py-2">Kalınlık</th>
                  <th className="py-2">Levha</th>
                  <th className="py-2">kg</th>
                  <th className="py-2 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {(rows ?? []).map((r) => {
                  const editing = editId === r.id;
                  return (
                    <tr key={r.id} className="border-t border-border/60">
                      <td className="py-2 whitespace-nowrap">{timeFmt.format(new Date(r.baslangic))}</td>
                      <td className="py-2">
                        {editing ? (
                          <Input className="h-9 w-28" value={draft.tip} onChange={(e) => setDraft({ ...draft, tip: e.target.value })} />
                        ) : (
                          <span className="text-muted-foreground">{r.sac_tipi ?? "—"}</span>
                        )}
                      </td>
                      {(["uzunluk", "genislik", "kalinlik", "levha"] as const).map((f) => (
                        <td key={f} className="py-2">
                          {editing ? (
                            <Input
                              type="number"
                              step="0.01"
                              className="h-9 w-20"
                              value={draft[f]}
                              onChange={(e) => setDraft({ ...draft, [f]: e.target.value })}
                            />
                          ) : (
                            Number(
                              f === "uzunluk" ? r.uzunluk_mm
                                : f === "genislik" ? r.genislik_mm
                                : f === "kalinlik" ? r.kalinlik_mm
                                : r.levha_adedi ?? 0,
                            )
                          )}
                        </td>
                      ))}
                      <td className="py-2">{Number(r.toplam_agirlik_kg ?? 0).toFixed(1)}</td>
                      <td className="py-2">
                        <div className="flex justify-end gap-1">
                          {editing ? (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={async () => {
                                  const u = Number(draft.uzunluk), g = Number(draft.genislik);
                                  const k = Number(draft.kalinlik), a = Number(draft.levha);
                                  if (!(u > 0) || !(g > 0) || !(k > 0) || !(a > 0))
                                    return toast.error("Tüm ölçüler 0'dan büyük olmalı");
                                  const yog = Number(r.yogunluk ?? 7.85);
                                  const kg = levhaKg({ uzunluk_mm: u, genislik_mm: g, kalinlik_mm: k, yogunluk: yog }) * a;
                                  const { error } = await supabase
                                    .from("plasma_cuts")
                                    .update({
                                      uzunluk_mm: u, genislik_mm: g, kalinlik_mm: k,
                                      levha_adedi: a, sac_tipi: draft.tip.trim() || null,
                                      toplam_agirlik_kg: kg,
                                    })
                                    .eq("id", r.id);
                                  if (error) return toast.error(error.message);
                                  toast.success("Kayıt güncellendi");
                                  setEditId(null);
                                  qc.invalidateQueries({ queryKey: ["sac-kesim"] });
                                }}
                              >
                                <Check className="h-4 w-4 text-success" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => setEditId(null)}>
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              {can("kayit.duzenle") && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditId(r.id);
                                    setDraft({
                                      uzunluk: String(Number(r.uzunluk_mm)),
                                      genislik: String(Number(r.genislik_mm)),
                                      kalinlik: String(Number(r.kalinlik_mm)),
                                      levha: String(Number(r.levha_adedi ?? 0)),
                                      tip: r.sac_tipi ?? "",
                                    });
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {can("kayit.sil") && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={async () => {
                                    if (!confirm("Bu kesim kaydı silinsin mi?")) return;
                                    const { error } = await supabase.from("plasma_cuts").delete().eq("id", r.id);
                                    if (error) return toast.error(error.message);
                                    toast.success("Kayıt silindi");
                                    qc.invalidateQueries({ queryKey: ["sac-kesim"] });
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
