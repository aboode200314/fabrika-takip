import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ListOrdered, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

const NONE = "__none__";

/** Ürün üretim aşamaları (iş akışı) tanımlama. */
export function UrunAsamalari() {
  const qc = useQueryClient();
  const [productId, setProductId] = useState("");
  const [ad, setAd] = useState("");
  const [machineId, setMachineId] = useState(NONE);
  const [aciklama, setAciklama] = useState("");

  const { data: products } = useQuery({
    queryKey: ["products-all"],
    queryFn: async () => (await supabase.from("products").select("id,kod,ad").order("kod")).data ?? [],
  });
  const { data: machines } = useQuery({
    queryKey: ["machines-all"],
    queryFn: async () => (await supabase.from("machines").select("id,kod,ad").order("kod")).data ?? [],
  });
  const { data: ops } = useQuery({
    queryKey: ["product-operations", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_operations")
        .select("id,sira,ad,machine_id,aciklama")
        .eq("product_id", productId)
        .order("sira");
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["product-operations", productId] });
    qc.invalidateQueries({ queryKey: ["product-operations-all"] });
  };

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!productId) return toast.error("Önce ürün seçiniz");
    if (!ad.trim()) return toast.error("Aşama adı gerekli");
    const sira = ((ops ?? []).at(-1)?.sira ?? 0) + 1;
    const { error } = await supabase.from("product_operations").insert({
      product_id: productId,
      sira,
      ad: ad.trim(),
      machine_id: machineId === NONE ? null : machineId,
      aciklama: aciklama.trim() || null,
    });
    if (error) return toast.error(error.message);
    setAd(""); setAciklama(""); setMachineId(NONE);
    toast.success("Aşama eklendi");
    refresh();
  }

  async function move(index: number, dir: -1 | 1) {
    const list = ops ?? [];
    const a = list[index];
    const b = list[index + dir];
    if (!a || !b) return;
    await supabase.from("product_operations").update({ sira: b.sira }).eq("id", a.id);
    await supabase.from("product_operations").update({ sira: a.sira }).eq("id", b.id);
    refresh();
  }

  async function patch(id: string, values: { ad?: string; machine_id?: string | null; aciklama?: string | null }) {
    const { error } = await supabase.from("product_operations").update(values).eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2">
          <ListOrdered className="h-5 w-5 text-primary" />
          <h3 className="text-lg">Ürün Üretim Aşamaları</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Örn. Trailer Şasi: Sac kesim (CNC Plazma) → Büküm → Montaj → Kaynak → Taşlama → Boya → Son montaj → Son kontrol.
          Her aşamayı sorumlu makineye bağlarsanız operatör panelinde yalnızca kendi makinesinin aşaması görünür.
        </p>
        <div className="mt-4 max-w-md space-y-1.5">
          <Label className="text-xs">Ürün</Label>
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger className="tap-target"><SelectValue placeholder="Ürün seçiniz" /></SelectTrigger>
            <SelectContent>
              {products?.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.kod} — {p.ad}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {productId && (
        <>
          <form onSubmit={add} className="grid gap-2 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <Input placeholder="Aşama adı (örn. Kaynak)" value={ad} onChange={(e) => setAd(e.target.value)} />
            <Select value={machineId} onValueChange={setMachineId}>
              <SelectTrigger><SelectValue placeholder="Sorumlu makine" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Makine bağlı değil</SelectItem>
                {machines?.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.kod} — {m.ad}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Açıklama (opsiyonel)" value={aciklama} onChange={(e) => setAciklama(e.target.value)} />
            <Button type="submit" className="gap-1"><Plus className="h-4 w-4" />Ekle</Button>
          </form>

          <div className="space-y-2">
            {(ops ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Bu ürün için henüz aşama tanımlanmadı.</p>
            )}
            {(ops ?? []).map((o, i) => (
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
                    <SelectItem value={NONE}>Makine bağlı değil</SelectItem>
                    {machines?.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.kod} — {m.ad}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" disabled={i === (ops ?? []).length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    if (!confirm(`"${o.ad}" aşamasını silmek istiyor musunuz?`)) return;
                    const { error } = await supabase.from("product_operations").delete().eq("id", o.id);
                    if (error) return toast.error(error.message);
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
