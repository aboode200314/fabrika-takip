import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine, Loader2, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { levhaKg, type StockRow } from "@/lib/sac";
import { useAuth } from "@/lib/auth";
import { profileLabel, type ProfileStock } from "@/lib/profile-stock";
import { useT } from "@/lib/i18n";

const dtFmt = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
});

interface MoveRow {
  id: string;
  stock_id: string | null;
  degisim: number;
  tip: string;
  yon: string | null;
  sebep: string | null;
  notlar: string | null;
  user_ad: string | null;
  bakiye_sonrasi: number | null;
  ters_kayit_id: string | null;
  created_at: string;
  malzeme_snapshot: ProfileStock | null;
}

export function StokHareketleri({ material = "sac" }: { material?: "sac" | "profil" }) {
  const t = useT();
  const qc = useQueryClient();
  const { can } = useAuth();

  const SEBEPLER_GIRIS = [
    t("stok.hareket.girisSebep1"),
    t("stok.hareket.girisSebep2"),
    t("stok.hareket.girisSebep3"),
    t("stok.hareket.girisSebep4"),
    t("stok.hareket.girisSebep5"),
  ];
  const SEBEPLER_CIKIS = [
    t("stok.hareket.cikisSebep1"),
    t("stok.hareket.cikisSebep2"),
    t("stok.hareket.cikisSebep3"),
    t("stok.hareket.cikisSebep4"),
    t("stok.hareket.cikisSebep5"),
  ];

  const [yon, setYon] = useState<"giris" | "cikis">("giris");
  const [stockId, setStockId] = useState("");
  const [adet, setAdet] = useState("");
  const [sebep, setSebep] = useState(SEBEPLER_GIRIS[0]);
  const [notlar, setNotlar] = useState("");
  const [filtre, setFiltre] = useState("hepsi");
  const [busy, setBusy] = useState(false);

  const { data: stocks } = useQuery({
    queryKey: ["sheet-stock", material],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sheet_stock")
        .select("*")
        .in("malzeme_turu", material === "sac" ? ["sac"] : ["profil", "boru"])
        .order("sac_tipi").order("kalinlik_mm");
      if (error) throw error;
      return (data ?? []) as ProfileStock[];
    },
  });

  const { data: moves, isLoading } = useQuery({
    queryKey: ["stock-moves-full", material, filtre],
    queryFn: async () => {
      let q = supabase
        .from("sheet_stock_moves")
        .select("id,stock_id,degisim,tip,yon,sebep,notlar,user_ad,bakiye_sonrasi,ters_kayit_id,created_at,malzeme_snapshot")
        .order("created_at", { ascending: false })
        .limit(300);
      q = material === "sac" ? q.is("malzeme_snapshot", null) : q.not("malzeme_snapshot", "is", null);
      if (filtre !== "hepsi") q = q.eq("stock_id", filtre);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as MoveRow[];
    },
  });

  const stokAdi = (id: string | null) => {
    const r = (stocks ?? []).find((x) => x.id === id);
    return r ? (material === "profil" ? profileLabel(r) : `${r.sac_tipi} · ${r.kalinlik_mm}mm · ${r.uzunluk_mm}×${r.genislik_mm}`) : "—";
  };
  const stokById = (id: string | null) => (stocks ?? []).find((x) => x.id === id);

  const ozet = useMemo(() => {
    const rows = moves ?? [];
    const giris = rows.filter((r) => r.degisim > 0).reduce((s, r) => s + Number(r.degisim), 0);
    const cikis = rows.filter((r) => r.degisim < 0).reduce((s, r) => s + Math.abs(Number(r.degisim)), 0);
    return { giris, cikis, net: giris - cikis, sayi: rows.length };
  }, [moves]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!can(yon === "giris" ? "stok.giris" : "stok.cikis")) {
      return toast.error(t("stok.err.yetkiYok"));
    }
    if (!stockId) return toast.error(t("stok.err.kalemSeciniz"));
    const a = Number(adet);
    if (!Number.isFinite(a) || a <= 0) return toast.error(t("stok.err.gecerliAdet"));
    const mevcut = stokById(stockId)?.adet ?? 0;
    if (yon === "cikis" && a > mevcut) {
      return toast.error(t("stok.err.yetersizStok").replace("{n}", String(mevcut)));
    }
    setBusy(true);
    const { error } = await supabase.from("sheet_stock_moves").insert({
      stock_id: stockId,
      degisim: yon === "giris" ? a : -a,
      tip: "manuel",
      sebep,
      notlar: notlar.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(yon === "giris" ? t("stok.success.girisKaydedildi") : t("stok.success.cikisKaydedildi"));
    setAdet(""); setNotlar("");
    qc.invalidateQueries({ queryKey: ["stock-moves-full"] });
    qc.invalidateQueries({ queryKey: ["sheet-stock"] });
    qc.invalidateQueries({ queryKey: ["profile-stock"] });
    qc.invalidateQueries({ queryKey: ["sheet-stock-moves"] });
  }

  async function tersle(m: MoveRow) {
    if (!can("stok.duzelt")) return toast.error(t("stok.err.duzeltmeYetkiYok"));
    if (!confirm(t("stok.confirm.tersle"))) return;
    const { error } = await supabase.from("sheet_stock_moves").insert({
      stock_id: m.stock_id,
      degisim: -Number(m.degisim),
      tip: "duzeltme",
      sebep: t("stok.duzeltmeSebep"),
      notlar: `${dtFmt.format(new Date(m.created_at))} ${t("stok.tarihliHareketIptal")}`,
      ters_kayit_id: m.id,
    });
    if (error) return toast.error(error.message);
    toast.success(t("stok.success.terslendi"));
    qc.invalidateQueries({ queryKey: ["stock-moves-full"] });
    qc.invalidateQueries({ queryKey: ["sheet-stock"] });
    qc.invalidateQueries({ queryKey: ["profile-stock"] });
  }

  const iptalEdilenler = new Set((moves ?? []).map((m) => m.ters_kayit_id).filter(Boolean) as string[]);

  return (
    <div className="space-y-4 pt-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Kpi label={t("stok.kpi.hareketSayisi")} value={String(ozet.sayi)} />
        <Kpi label={t("stok.kpi.toplamGiris")} value={`+${ozet.giris}`} tone="success" />
        <Kpi label={t("stok.kpi.toplamCikis")} value={`-${ozet.cikis}`} tone="danger" />
        <Kpi label={t("stok.kpi.netDegisim")} value={`${ozet.net > 0 ? "+" : ""}${ozet.net}`} />
      </div>

      <form onSubmit={submit} className="space-y-3 rounded-2xl border bg-card p-5">
        <h3 className="text-lg">{t(material === "sac" ? "stok.formTitle" : "profil.moves")}</h3>
        <div className="grid gap-3 lg:grid-cols-6">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("stok.hareketYonu")}</Label>
            <Select
              value={yon}
              onValueChange={(v) => {
                const y = v as "giris" | "cikis";
                setYon(y);
                setSebep((y === "giris" ? SEBEPLER_GIRIS : SEBEPLER_CIKIS)[0]);
              }}
            >
              <SelectTrigger className="tap-target"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="giris">{t("stok.giris")}</SelectItem>
                <SelectItem value="cikis">{t("stok.cikis")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 lg:col-span-2">
            <Label className="text-xs">{t("stok.stokKalemi")}</Label>
            <Select value={stockId} onValueChange={setStockId}>
              <SelectTrigger className="tap-target"><SelectValue placeholder={t("stok.seciniz")} /></SelectTrigger>
              <SelectContent>
                {stocks?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {stokAdi(s.id)} ({t("stok.mevcut")} {s.adet})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t(material === "sac" ? "stok.levhaAdedi" : "stok.adet")}</Label>
            <Input type="number" step="0.01" min={0} value={adet} onChange={(e) => setAdet(e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("stok.sebep")}</Label>
            <Select value={sebep} onValueChange={setSebep}>
              <SelectTrigger className="tap-target"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(yon === "giris" ? SEBEPLER_GIRIS : SEBEPLER_CIKIS).map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={busy} className="w-full gap-1">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" />
                : yon === "giris" ? <ArrowDownToLine className="h-4 w-4" /> : <ArrowUpFromLine className="h-4 w-4" />}
              {t("stok.kaydet")}
            </Button>
          </div>
          <div className="space-y-1.5 lg:col-span-6">
            <Label className="text-xs">{t("stok.notOpsiyonel")}</Label>
            <Input value={notlar} onChange={(e) => setNotlar(e.target.value)} placeholder={t("stok.notPlaceholder2")} />
          </div>
        </div>
        {material === "sac" && stockId && adet && Number(adet) > 0 && (
          <p className="text-xs text-muted-foreground">
            {t("stok.yaklasikAgirlik")}{" "}
            <span className="font-mono">
              {((levhaKg(stokById(stockId) as StockRow) * Number(adet)) / 1000).toFixed(3)} {t("stok.ton")}
            </span>
            {" · "}{t("stok.islemSonrasiBakiye")}{" "}
            <span className="font-mono">
              {(stokById(stockId)?.adet ?? 0) + (yon === "giris" ? Number(adet) : -Number(adet))} {t(material === "sac" ? "stok.levha" : "profil.unit")}
            </span>
          </p>
        )}
      </form>

      <div className="rounded-2xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div>
            <h3 className="text-lg">{t("stok.hareketGecmisi")}</h3>
            <p className="text-xs text-muted-foreground">
              {t("stok.hareketGecmisiDesc")}
            </p>
          </div>
          <Select value={filtre} onValueChange={setFiltre}>
            <SelectTrigger className="w-full max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="hepsi">{t("stok.tumStokKalemleri")}</SelectItem>
              {stocks?.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {stokAdi(s.id)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (moves ?? []).length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">{t("stok.henuzHareketKaydiYok")}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("stok.table.tarih")}</TableHead>
                  <TableHead>{t("stok.table.stokKalemi")}</TableHead>
                  <TableHead>{t("stok.table.tip")}</TableHead>
                  <TableHead>{t("stok.table.sebep")}</TableHead>
                  <TableHead>{t("stok.table.kullanici")}</TableHead>
                  <TableHead className="text-end">{t("stok.table.degisim")}</TableHead>
                  <TableHead className="text-end">{t("stok.table.bakiye")}</TableHead>
                  <TableHead>{t("stok.table.not")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {moves?.map((m) => {
                  const iptal = iptalEdilenler.has(m.id);
                  return (
                    <TableRow key={m.id} className={iptal ? "opacity-50" : ""}>
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {dtFmt.format(new Date(m.created_at))}
                      </TableCell>
                      <TableCell className="text-xs">{m.malzeme_snapshot ? profileLabel(m.malzeme_snapshot) : stokAdi(m.stock_id)}</TableCell>
                      <TableCell className="text-xs uppercase tracking-wide text-muted-foreground">{m.tip}</TableCell>
                      <TableCell className="text-xs">{m.sebep ?? "—"}</TableCell>
                      <TableCell className="text-xs">{m.user_ad ?? t("stok.sistem")}</TableCell>
                      <TableCell className={`text-end font-mono ${Number(m.degisim) > 0 ? "text-success" : "text-destructive"}`}>
                        {Number(m.degisim) > 0 ? "+" : ""}{m.degisim}
                      </TableCell>
                      <TableCell className="text-end font-mono">{m.bakiye_sonrasi ?? "—"}</TableCell>
                      <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
                        {iptal ? t("stok.iptalEdildi") : ""}{m.notlar ?? ""}
                      </TableCell>
                      <TableCell className="text-end">
                        {!iptal && !m.ters_kayit_id && can("stok.duzelt") && (
                          <Button variant="ghost" size="icon" title={t("stok.tersKayitlaIptalEt")} onClick={() => tersle(m)}>
                            <Undo2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-3xl ${tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : ""}`}>
        {value}
      </div>
    </div>
  );
}
