import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Save, Loader2, PackageOpen, ArrowDownUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { SAC_TIPLERI, levhaKg, type StockRow } from "@/lib/sac";
import { useT } from "@/lib/i18n";

const dtFmt = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
});

export function StokTab() {
  const t = useT();
  const qc = useQueryClient();
  const [sacTipi, setSacTipi] = useState(SAC_TIPLERI[0].ad);
  const [kalinlik, setKalinlik] = useState("");
  const [uzunluk, setUzunluk] = useState("6000");
  const [genislik, setGenislik] = useState("1500");
  const [adet, setAdet] = useState("");
  const [kritik, setKritik] = useState("0");
  const [notlar, setNotlar] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ id: string; adet: string } | null>(null);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["sheet-stock"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sheet_stock")
        .select("id,sac_tipi,kalinlik_mm,uzunluk_mm,genislik_mm,adet,kritik_adet,yogunluk,notlar")
        .order("sac_tipi")
        .order("kalinlik_mm");
      if (error) throw error;
      return (data ?? []) as StockRow[];
    },
  });

  const { data: moves } = useQuery({
    queryKey: ["sheet-stock-moves"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sheet_stock_moves")
        .select("id,stock_id,degisim,tip,notlar,created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const k = Number(kalinlik), u = Number(uzunluk), g = Number(genislik), a = Number(adet);
    if (!(k > 0)) return toast.error(t("stok.err.kalinlikGir"));
    if (!(u > 0) || !(g > 0)) return toast.error(t("stok.err.olculeriGir"));
    if (!(a >= 0)) return toast.error(t("stok.err.adetGir"));
    setBusy(true);
    const { error } = await supabase.from("sheet_stock").insert({
      sac_tipi: sacTipi,
      kalinlik_mm: k,
      uzunluk_mm: u,
      genislik_mm: g,
      adet: a,
      kritik_adet: Number(kritik) || 0,
      yogunluk: SAC_TIPLERI.find((s) => s.ad === sacTipi)?.yogunluk ?? 7.85,
      notlar: notlar.trim() || null,
    });
    setBusy(false);
    if (error) {
      return toast.error(
        error.code === "23505" ? t("stok.err.kayitVar") : error.message,
      );
    }
    toast.success(t("stok.success.eklendi"));
    setKalinlik(""); setAdet(""); setNotlar("");
    qc.invalidateQueries({ queryKey: ["sheet-stock"] });
  }

  async function saveAdet() {
    if (!editing) return;
    const a = Number(editing.adet);
    if (!Number.isFinite(a) || a < 0) return toast.error(t("stok.err.gecersizAdet"));
    const { error } = await supabase.from("sheet_stock").update({ adet: a }).eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success(t("stok.success.guncellendi"));
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["sheet-stock"] });
  }

  const toplamLevha = (rows ?? []).reduce((s, r) => s + r.adet, 0);
  const toplamTon = (rows ?? []).reduce((s, r) => s + levhaKg(r) * r.adet, 0) / 1000;
  const stokAdi = (id: string | null) => {
    const r = (rows ?? []).find((x) => x.id === id);
    return r ? `${r.sac_tipi} · ${r.kalinlik_mm}mm · ${r.uzunluk_mm}×${r.genislik_mm}` : "—";
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{t("stok.kpi.kalemi")}</div>
          <div className="mt-1 font-display text-3xl">{rows?.length ?? 0}</div>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{t("stok.kpi.toplamLevha")}</div>
          <div className="mt-1 font-display text-3xl">{toplamLevha}</div>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{t("stok.kpi.toplamTonaj")}</div>
          <div className="mt-1 font-display text-3xl">{toplamTon.toFixed(2)}<span className="ms-1 text-sm text-muted-foreground">{t("stok.ton")}</span></div>
        </div>
      </div>

      <form onSubmit={add} className="space-y-3 rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-2">
          <PackageOpen className="h-5 w-5 text-primary" />
          <h3 className="text-lg">{t("stok.yeniKalem")}</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="space-y-1.5 lg:col-span-2">
            <Label className="text-xs">{t("stok.sacTuru")}</Label>
            <Select value={sacTipi} onValueChange={setSacTipi}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SAC_TIPLERI.map((s) => <SelectItem key={s.ad} value={s.ad}>{s.ad}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("stok.kalinlik")}</Label>
            <Input type="number" step="0.1" min={0.1} value={kalinlik} onChange={(e) => setKalinlik(e.target.value)} placeholder="10" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("stok.uzunluk")}</Label>
            <Input type="number" min={1} value={uzunluk} onChange={(e) => setUzunluk(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("stok.genislik")}</Label>
            <Input type="number" min={1} value={genislik} onChange={(e) => setGenislik(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("stok.adet")}</Label>
            <Input type="number" min={0} value={adet} onChange={(e) => setAdet(e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("stok.kritikSeviye")}</Label>
            <Input type="number" min={0} value={kritik} onChange={(e) => setKritik(e.target.value)} />
          </div>
          <div className="space-y-1.5 lg:col-span-4">
            <Label className="text-xs">{t("stok.notOpsiyonel")}</Label>
            <Input value={notlar} onChange={(e) => setNotlar(e.target.value)} placeholder={t("stok.notPlaceholder")} />
          </div>
          <div className="flex items-end lg:col-span-2">
            <Button type="submit" disabled={busy} className="w-full gap-1">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {t("stok.ekle")}
            </Button>
          </div>
        </div>
      </form>

      <div className="rounded-2xl border bg-card overflow-x-auto">
        <div className="border-b p-4 text-sm text-muted-foreground">
          {t("stok.table.duzeltmeIpucu")}
        </div>
        {isLoading ? (
          <div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("stok.table.sacTuru")}</TableHead>
                <TableHead>{t("stok.table.kalinlik")}</TableHead>
                <TableHead>{t("stok.table.olcu")}</TableHead>
                <TableHead className="text-end">{t("stok.table.levhaAgirligi")}</TableHead>
                <TableHead className="text-end">{t("stok.table.mevcutAdet")}</TableHead>
                <TableHead className="text-end">{t("stok.table.toplamKg")}</TableHead>
                <TableHead>{t("stok.table.not")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows?.map((r) => {
                const kritikMi = r.adet <= r.kritik_adet;
                return (
                  <TableRow key={r.id} className={kritikMi ? "bg-destructive/5" : ""}>
                    <TableCell>{r.sac_tipi}</TableCell>
                    <TableCell className="font-mono">{r.kalinlik_mm} mm</TableCell>
                    <TableCell className="font-mono">{r.uzunluk_mm}×{r.genislik_mm}</TableCell>
                    <TableCell className="text-end">{levhaKg(r).toFixed(1)} kg</TableCell>
                    <TableCell className="text-end">
                      {editing?.id === r.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <Input type="number" min={0} value={editing.adet} autoFocus className="h-8 w-20 text-end"
                            onChange={(e) => setEditing({ id: r.id, adet: e.target.value })} />
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveAdet}>
                            <Save className="h-3.5 w-3.5 text-success" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          className={`rounded-md border border-dashed px-2 py-1 font-display transition-colors hover:border-primary hover:text-primary ${kritikMi ? "text-destructive" : ""}`}
                          onClick={() => setEditing({ id: r.id, adet: String(r.adet) })}
                        >
                          {r.adet}
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="text-end text-muted-foreground">{(levhaKg(r) * r.adet).toFixed(0)}</TableCell>
                    <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground">{r.notlar ?? "—"}</TableCell>
                    <TableCell className="text-end">
                      <Button variant="ghost" size="icon" onClick={async () => {
                        if (!confirm(t("stok.confirm.sil"))) return;
                        const { error } = await supabase.from("sheet_stock").delete().eq("id", r.id);
                        if (error) return toast.error(error.message);
                        toast.success(t("stok.success.silindi"));
                        qc.invalidateQueries({ queryKey: ["sheet-stock"] });
                      }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    {t("stok.table.bosKalem")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="rounded-2xl border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-lg">{t("stok.sonHareketler")}</h3>
        </div>
        {!moves?.length ? (
          <p className="text-sm text-muted-foreground">{t("stok.henuzHareketYok")}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {moves.map((m: any) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2 last:border-0">
                <span className="text-muted-foreground">{dtFmt.format(new Date(m.created_at))}</span>
                <span>{stokAdi(m.stock_id)}</span>
                <span className={m.degisim < 0 ? "font-display text-destructive" : "font-display text-success"}>
                  {m.degisim > 0 ? "+" : ""}{m.degisim} {t("stok.levha")}
                </span>
                <span className="text-xs text-muted-foreground">{m.notlar ?? m.tip}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
