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

const dtFmt = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
});

const SEBEPLER_GIRIS = ["Satın alma", "Tedarikçi teslimi", "Üretimden iade", "Sayım düzeltmesi", "Diğer"];
const SEBEPLER_CIKIS = ["Üretim kullanımı", "Hurda / fire", "Başka bölüme transfer", "Sayım düzeltmesi", "Diğer"];

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
}

export function StokHareketleri() {
  const qc = useQueryClient();
  const { can } = useAuth();
  const [yon, setYon] = useState<"giris" | "cikis">("giris");
  const [stockId, setStockId] = useState("");
  const [adet, setAdet] = useState("");
  const [sebep, setSebep] = useState(SEBEPLER_GIRIS[0]);
  const [notlar, setNotlar] = useState("");
  const [filtre, setFiltre] = useState("hepsi");
  const [busy, setBusy] = useState(false);

  const { data: stocks } = useQuery({
    queryKey: ["sheet-stock"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sheet_stock")
        .select("id,sac_tipi,kalinlik_mm,uzunluk_mm,genislik_mm,adet,kritik_adet,yogunluk,notlar")
        .order("sac_tipi").order("kalinlik_mm");
      if (error) throw error;
      return (data ?? []) as StockRow[];
    },
  });

  const { data: moves, isLoading } = useQuery({
    queryKey: ["stock-moves-full", filtre],
    queryFn: async () => {
      let q = supabase
        .from("sheet_stock_moves")
        .select("id,stock_id,degisim,tip,yon,sebep,notlar,user_ad,bakiye_sonrasi,ters_kayit_id,created_at")
        .order("created_at", { ascending: false })
        .limit(300);
      if (filtre !== "hepsi") q = q.eq("stock_id", filtre);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as MoveRow[];
    },
  });

  const stokAdi = (id: string | null) => {
    const r = (stocks ?? []).find((x) => x.id === id);
    return r ? `${r.sac_tipi} · ${r.kalinlik_mm}mm · ${r.uzunluk_mm}×${r.genislik_mm}` : "—";
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
      return toast.error("Bu işlem için yetkiniz yok");
    }
    if (!stockId) return toast.error("Stok kalemi seçiniz");
    const a = Number(adet);
    if (!Number.isFinite(a) || a <= 0) return toast.error("Geçerli bir adet giriniz");
    const mevcut = stokById(stockId)?.adet ?? 0;
    if (yon === "cikis" && a > mevcut) {
      return toast.error(`Stokta yalnızca ${mevcut} levha var`);
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
    toast.success(yon === "giris" ? "Stok girişi kaydedildi" : "Stok çıkışı kaydedildi");
    setAdet(""); setNotlar("");
    qc.invalidateQueries({ queryKey: ["stock-moves-full"] });
    qc.invalidateQueries({ queryKey: ["sheet-stock"] });
    qc.invalidateQueries({ queryKey: ["sheet-stock-moves"] });
  }

  async function tersle(m: MoveRow) {
    if (!can("stok.duzelt")) return toast.error("Düzeltme yetkiniz yok");
    if (!confirm("Bu hareketi ters kayıtla iptal etmek istiyor musunuz? Orijinal kayıt silinmez.")) return;
    const { error } = await supabase.from("sheet_stock_moves").insert({
      stock_id: m.stock_id,
      degisim: -Number(m.degisim),
      tip: "duzeltme",
      sebep: "Hatalı hareket düzeltmesi",
      notlar: `${dtFmt.format(new Date(m.created_at))} tarihli hareket iptal edildi`,
      ters_kayit_id: m.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Ters kayıt oluşturuldu, stok düzeltildi");
    qc.invalidateQueries({ queryKey: ["stock-moves-full"] });
    qc.invalidateQueries({ queryKey: ["sheet-stock"] });
  }

  const iptalEdilenler = new Set((moves ?? []).map((m) => m.ters_kayit_id).filter(Boolean) as string[]);

  return (
    <div className="space-y-4 pt-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Kpi label="Hareket Sayısı" value={String(ozet.sayi)} />
        <Kpi label="Toplam Giriş" value={`+${ozet.giris}`} tone="success" />
        <Kpi label="Toplam Çıkış" value={`-${ozet.cikis}`} tone="danger" />
        <Kpi label="Net Değişim" value={`${ozet.net > 0 ? "+" : ""}${ozet.net}`} />
      </div>

      <form onSubmit={submit} className="space-y-3 rounded-2xl border bg-card p-5">
        <h3 className="text-lg">Sac Giriş / Çıkış Hareketi</h3>
        <div className="grid gap-3 lg:grid-cols-6">
          <div className="space-y-1.5">
            <Label className="text-xs">Hareket Yönü</Label>
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
                <SelectItem value="giris">Giriş (+)</SelectItem>
                <SelectItem value="cikis">Çıkış (−)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 lg:col-span-2">
            <Label className="text-xs">Stok Kalemi</Label>
            <Select value={stockId} onValueChange={setStockId}>
              <SelectTrigger className="tap-target"><SelectValue placeholder="Seçiniz" /></SelectTrigger>
              <SelectContent>
                {stocks?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.sac_tipi} · {s.kalinlik_mm}mm · {s.uzunluk_mm}×{s.genislik_mm} (mevcut {s.adet})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Levha Adedi</Label>
            <Input type="number" step="0.01" min={0} value={adet} onChange={(e) => setAdet(e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Sebep</Label>
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
              Kaydet
            </Button>
          </div>
          <div className="space-y-1.5 lg:col-span-6">
            <Label className="text-xs">Not (opsiyonel)</Label>
            <Input value={notlar} onChange={(e) => setNotlar(e.target.value)} placeholder="İrsaliye no, tedarikçi, açıklama…" />
          </div>
        </div>
        {stockId && adet && Number(adet) > 0 && (
          <p className="text-xs text-muted-foreground">
            Yaklaşık ağırlık:{" "}
            <span className="font-mono">
              {((levhaKg(stokById(stockId) as StockRow) * Number(adet)) / 1000).toFixed(3)} ton
            </span>
            {" · "}İşlem sonrası bakiye:{" "}
            <span className="font-mono">
              {(stokById(stockId)?.adet ?? 0) + (yon === "giris" ? Number(adet) : -Number(adet))} levha
            </span>
          </p>
        )}
      </form>

      <div className="rounded-2xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div>
            <h3 className="text-lg">Hareket Geçmişi</h3>
            <p className="text-xs text-muted-foreground">
              Kayıtlar silinemez veya değiştirilemez. Hatalı hareketler ters kayıtla düzeltilir.
            </p>
          </div>
          <Select value={filtre} onValueChange={setFiltre}>
            <SelectTrigger className="w-full max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="hepsi">Tüm stok kalemleri</SelectItem>
              {stocks?.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.sac_tipi} · {s.kalinlik_mm}mm · {s.uzunluk_mm}×{s.genislik_mm}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (moves ?? []).length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Henüz hareket kaydı yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Stok Kalemi</TableHead>
                  <TableHead>Tip</TableHead>
                  <TableHead>Sebep</TableHead>
                  <TableHead>Kullanıcı</TableHead>
                  <TableHead className="text-right">Değişim</TableHead>
                  <TableHead className="text-right">Bakiye</TableHead>
                  <TableHead>Not</TableHead>
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
                      <TableCell className="text-xs">{stokAdi(m.stock_id)}</TableCell>
                      <TableCell className="text-xs uppercase tracking-wide text-muted-foreground">{m.tip}</TableCell>
                      <TableCell className="text-xs">{m.sebep ?? "—"}</TableCell>
                      <TableCell className="text-xs">{m.user_ad ?? "Sistem"}</TableCell>
                      <TableCell className={`text-right font-mono ${Number(m.degisim) > 0 ? "text-success" : "text-destructive"}`}>
                        {Number(m.degisim) > 0 ? "+" : ""}{m.degisim}
                      </TableCell>
                      <TableCell className="text-right font-mono">{m.bakiye_sonrasi ?? "—"}</TableCell>
                      <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
                        {iptal ? "İptal edildi — " : ""}{m.notlar ?? ""}
                      </TableCell>
                      <TableCell className="text-right">
                        {!iptal && !m.ters_kayit_id && can("stok.duzelt") && (
                          <Button variant="ghost" size="icon" title="Ters kayıtla iptal et" onClick={() => tersle(m)}>
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
