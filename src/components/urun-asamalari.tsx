import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ListOrdered, Plus, Timer, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/i18n";

const NONE = "__none__";

function dk(saniye: number, t: ReturnType<typeof useT>) {
  if (!saniye) return "—";
  const m = Math.floor(saniye / 60);
  const s = Math.round(saniye % 60);
  return m > 0 ? `${m} ${t("yon.ua.dk")}${s ? ` ${s} ${t("yon.ua.sn")}` : ""}` : `${s} ${t("yon.ua.sn")}`;
}

/**
 * Ürün → Üretim akışı (Routing) → Makine bağlama.
 * Master Data: burada tanımlanan akış, üretim kaydı açıldığında kayda anlık görüntü
 * (snapshot) olarak yazılır; akış sonradan değişse bile eski kayıtlar bozulmaz.
 */
export function UrunAsamalari() {
  const t = useT();
  const qc = useQueryClient();
  const [productId, setProductId] = useState("");
  const [ad, setAd] = useState("");
  const [machineId, setMachineId] = useState(NONE);
  const [sure, setSure] = useState("");
  const [aciklama, setAciklama] = useState("");

  const { data: products } = useQuery({
    queryKey: ["products-routing"],
    queryFn: async () =>
      (await supabase.from("products").select("id,kod,ad,department_id,silindi_at").order("kod")).data ?? [],
  });
  const { data: machines } = useQuery({
    queryKey: ["machines-all"],
    queryFn: async () => (await supabase.from("machines").select("id,kod,ad,department_id").order("kod")).data ?? [],
  });
  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => (await supabase.from("departments").select("id,kod,ad").order("ad")).data ?? [],
  });
  const { data: ops } = useQuery({
    queryKey: ["product-operations", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_operations")
        .select("id,sira,ad,machine_id,aciklama,tahmini_sure_saniye")
        .eq("product_id", productId)
        .order("sira");
      if (error) throw error;
      return data ?? [];
    },
  });

  const product = (products ?? []).find((p) => p.id === productId);
  const list = ops ?? [];
  const toplamSure = list.reduce((s, o) => s + Number(o.tahmini_sure_saniye ?? 0), 0);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["product-operations", productId] });
    qc.invalidateQueries({ queryKey: ["product-operations-all"] });
    qc.invalidateQueries({ queryKey: ["products-routing"] });
    qc.invalidateQueries({ queryKey: ["audit-logs"] });
  };

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!productId) return toast.error(t("yon.ua.oncekiUrunSec"));
    if (!ad.trim()) return toast.error(t("yon.ua.asamaAdiGerekli"));
    const sira = (list.at(-1)?.sira ?? 0) + 1;
    const { error } = await supabase.from("product_operations").insert({
      product_id: productId,
      sira,
      ad: ad.trim(),
      machine_id: machineId === NONE ? null : machineId,
      tahmini_sure_saniye: sure ? Number(sure) : null,
      aciklama: aciklama.trim() || null,
    });
    if (error) return toast.error(error.message);
    setAd(""); setAciklama(""); setSure(""); setMachineId(NONE);
    toast.success(t("yon.ua.eklendi"));
    refresh();
  }

  async function move(index: number, dir: -1 | 1) {
    const a = list[index];
    const b = list[index + dir];
    if (!a || !b) return;
    await supabase.from("product_operations").update({ sira: b.sira }).eq("id", a.id);
    await supabase.from("product_operations").update({ sira: a.sira }).eq("id", b.id);
    refresh();
  }

  async function patch(
    id: string,
    values: { ad?: string; machine_id?: string | null; aciklama?: string | null; tahmini_sure_saniye?: number | null },
  ) {
    const { error } = await supabase.from("product_operations").update(values).eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  }

  async function setProductDepartment(v: string) {
    if (!productId) return;
    const { error } = await supabase
      .from("products")
      .update({ department_id: v === NONE ? null : v })
      .eq("id", productId);
    if (error) return toast.error(error.message);
    toast.success(t("yon.ua.departmanGuncellendi"));
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2">
          <ListOrdered className="h-5 w-5 text-primary" />
          <h3 className="text-lg">{t("yon.ua.title")}</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("yon.ua.desc")}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("yon.ua.urunLabel")}</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="tap-target"><SelectValue placeholder={t("yon.ua.urunPh")} /></SelectTrigger>
              <SelectContent>
                {products?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.kod} — {p.ad}{p.silindi_at ? t("yon.ua.arsivSuffix") : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {productId && (
            <div className="space-y-1.5">
              <Label className="text-xs">{t("yon.ua.departmanLabel")}</Label>
              <Select value={product?.department_id ?? NONE} onValueChange={setProductDepartment}>
                <SelectTrigger className="tap-target"><SelectValue placeholder={t("yon.ua.departmanPh")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("yon.ua.baglıDegil")}</SelectItem>
                  {departments?.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.kod} — {d.ad}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {productId && (
        <>
          <form onSubmit={add} className="grid gap-2 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_1fr_120px_1fr_auto]">
            <Input placeholder={t("yon.ua.asamaAdiPh")} value={ad} onChange={(e) => setAd(e.target.value)} />
            <Select value={machineId} onValueChange={setMachineId}>
              <SelectTrigger><SelectValue placeholder={t("yon.ua.sorumluMakinePh")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("yon.ua.makineBagliDegil")}</SelectItem>
                {machines?.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.kod} — {m.ad}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder={t("yon.ua.surePh")} type="number" min="0" value={sure} onChange={(e) => setSure(e.target.value)} />
            <Input placeholder={t("yon.ua.aciklamaPh")} value={aciklama} onChange={(e) => setAciklama(e.target.value)} />
            <Button type="submit" className="gap-1"><Plus className="h-4 w-4" />{t("yon.mk.ekle")}</Button>
          </form>

          <div className="flex items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm">
            <Timer className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">{t("yon.ua.toplamCevrim")}</span>
            <strong className="font-mono">{dk(toplamSure, t)}</strong>
            <span className="ml-auto text-xs text-muted-foreground">{t("yon.ua.asamaSayisi", "{n} aşama").replace("{n}", String(list.length))}</span>
          </div>

          <div className="space-y-2">
            {list.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("yon.ua.henuzTanimlanmadi")}</p>
            )}
            {list.map((o, i) => (
              <div key={o.id} className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <Input
                  defaultValue={o.ad}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== o.ad && patch(o.id, { ad: e.target.value.trim() })}
                  className="min-w-[160px] flex-1"
                />
                <Select
                  value={o.machine_id ?? NONE}
                  onValueChange={(v) => patch(o.id, { machine_id: v === NONE ? null : v })}
                >
                  <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t("yon.ua.makineBagliDegil")}</SelectItem>
                    {machines?.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.kod} — {m.ad}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="0"
                  className="w-28"
                  placeholder={t("yon.ua.surePh")}
                  defaultValue={o.tahmini_sure_saniye?.toString() ?? ""}
                  onBlur={(e) => {
                    const v = e.target.value ? Number(e.target.value) : null;
                    if (v !== (o.tahmini_sure_saniye ?? null)) patch(o.id, { tahmini_sure_saniye: v });
                  }}
                />
                <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => move(i, -1)} title={t("yon.ua.yukari")}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" disabled={i === list.length - 1} onClick={() => move(i, 1)} title={t("yon.ua.asagi")}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title={t("yon.ua.silTitle")}
                  onClick={async () => {
                    if (!confirm(t("yon.ua.silConfirm", '"{ad}" aşaması silinsin mi? Eski üretim kayıtları korunur.').replace("{ad}", o.ad))) return;
                    const { error } = await supabase.from("product_operations").delete().eq("id", o.id);
                    if (error) return toast.error(error.message);
                    toast.success(t("yon.ua.silindi"));
                    refresh();
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
