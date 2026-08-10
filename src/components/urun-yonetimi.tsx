import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Archive, ArchiveRestore, History, Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { DenetimKaydi } from "@/components/denetim-kaydi";
import { useAuth } from "@/lib/auth";

interface Product {
  id: string;
  kod: string;
  ad: string;
  aciklama: string | null;
  olcu: string | null;
  birim_agirlik_kg: number | null;
  ideal_cevrim_saniye: number | null;
  silindi_at: string | null;
}

const SELECT = "id,kod,ad,aciklama,olcu,birim_agirlik_kg,ideal_cevrim_saniye,silindi_at";

export function UrunYonetimi() {
  const qc = useQueryClient();
  const { can, isSuperAdmin } = useAuth();
  const [arsivGoster, setArsivGoster] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [gecmis, setGecmis] = useState<Product | null>(null);
  const [kod, setKod] = useState("");
  const [ad, setAd] = useState("");
  const [cs, setCs] = useState("");

  const yetkili = can("urun.duzenle");

  const { data: products, isLoading } = useQuery({
    queryKey: ["products-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select(SELECT).order("kod");
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

  const rows = (products ?? []).filter((p) => (arsivGoster ? true : !p.silindi_at));

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["products-all"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["audit-logs"] });
  }

  async function ekle(e: React.FormEvent) {
    e.preventDefault();
    if (!kod.trim() || !ad.trim()) return toast.error("Kod ve ad gerekli");
    const { error } = await supabase.from("products").insert({
      kod: kod.trim(), ad: ad.trim(), ideal_cevrim_saniye: cs ? Number(cs) : null,
    });
    if (error) return toast.error(error.message);
    setKod(""); setAd(""); setCs(""); toast.success("Ürün eklendi");
    invalidate();
  }

  async function kaydet() {
    if (!editing) return;
    const { error } = await supabase.from("products").update({
      kod: editing.kod.trim(),
      ad: editing.ad.trim(),
      aciklama: editing.aciklama?.trim() || null,
      olcu: editing.olcu?.trim() || null,
      birim_agirlik_kg: editing.birim_agirlik_kg ?? null,
      ideal_cevrim_saniye: editing.ideal_cevrim_saniye ?? null,
    }).eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success("Ürün güncellendi — değişiklik denetim kaydına yazıldı");
    setEditing(null);
    invalidate();
  }

  async function arsivle(p: Product, geriAl: boolean) {
    const { error } = await supabase.from("products")
      .update({ silindi_at: geriAl ? null : new Date().toISOString() }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(geriAl ? "Ürün yeniden aktif" : "Ürün arşivlendi — geçmiş kayıtlar korundu");
    invalidate();
  }

  if (isLoading) {
    return <div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {yetkili && (
        <form className="flex flex-wrap gap-2 rounded-xl border bg-card p-4" onSubmit={ekle}>
          <Input placeholder="Kod" value={kod} onChange={(e) => setKod(e.target.value)} className="w-28" />
          <Input placeholder="Ad" value={ad} onChange={(e) => setAd(e.target.value)} className="min-w-[160px] flex-1" />
          <Input placeholder="Çevrim (sn)" type="number" value={cs} onChange={(e) => setCs(e.target.value)} className="w-32" />
          <Button type="submit" className="gap-1"><Plus className="h-4 w-4" />Ekle</Button>
        </form>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Ürünler silinmez; arşivlenir. Böylece eski üretim ve rapor kayıtları bozulmaz, ürün kodu ve kimliği korunur.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={arsivGoster} onCheckedChange={setArsivGoster} /> Arşivi göster
        </label>
      </div>

      <div className="rounded-xl border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kod</TableHead>
              <TableHead>Ad</TableHead>
              <TableHead>Ölçü</TableHead>
              <TableHead className="text-right">Birim kg</TableHead>
              <TableHead className="text-right">Çevrim</TableHead>
              <TableHead>Açıklama</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.id} className={p.silindi_at ? "opacity-50" : ""}>
                <TableCell className="font-mono">{p.kod}</TableCell>
                <TableCell>
                  {p.ad}
                  {p.silindi_at && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">arşiv</span>}
                </TableCell>
                <TableCell className="text-xs">{p.olcu ?? "—"}</TableCell>
                <TableCell className="text-right font-mono text-xs">{p.birim_agirlik_kg ?? "—"}</TableCell>
                <TableCell className="text-right font-mono text-xs">{p.ideal_cevrim_saniye ?? "—"} sn</TableCell>
                <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">{p.aciklama ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  <Button variant="ghost" size="icon" title="Değişiklik geçmişi" onClick={() => setGecmis(p)}>
                    <History className="h-4 w-4" />
                  </Button>
                  {yetkili && (
                    <>
                      <Button variant="ghost" size="icon" title="Düzenle" onClick={() => setEditing(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        title={p.silindi_at ? "Arşivden çıkar" : "Arşivle"}
                        onClick={() => arsivle(p, !!p.silindi_at)}
                      >
                        {p.silindi_at ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                      </Button>
                    </>
                  )}
                  {isSuperAdmin && (
                    <Button
                      variant="ghost" size="icon" title="Kalıcı sil (yalnızca Ana Yönetici)"
                      onClick={async () => {
                        if (!confirm(`${p.kod} kalıcı olarak silinsin mi? Bağlı kayıtlar varsa silinemez.`)) return;
                        const { error } = await supabase.from("products").delete().eq("id", p.id);
                        if (error) return toast.error("Bu ürüne bağlı üretim kayıtları var — arşivlemeyi kullanın.");
                        invalidate();
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editing && (
        <section className="rounded-2xl border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-lg tracking-wide">ÜRÜN DÜZENLE — {editing.kod}</h3>
            <Button variant="ghost" size="icon" onClick={() => setEditing(null)} aria-label="Kapat">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Kod" value={editing.kod} onChange={(v) => setEditing({ ...editing, kod: v })} />
            <Field label="Ad" value={editing.ad} onChange={(v) => setEditing({ ...editing, ad: v })} />
            <Field label="Ölçü" value={editing.olcu ?? ""} onChange={(v) => setEditing({ ...editing, olcu: v })} placeholder="2000×800×4 mm" />
            <Field
              label="Birim Ağırlık (kg)" type="number" value={editing.birim_agirlik_kg?.toString() ?? ""}
              onChange={(v) => setEditing({ ...editing, birim_agirlik_kg: v ? Number(v) : null })}
            />
            <Field
              label="İdeal Çevrim (sn)" type="number" value={editing.ideal_cevrim_saniye?.toString() ?? ""}
              onChange={(v) => setEditing({ ...editing, ideal_cevrim_saniye: v ? Number(v) : null })}
            />
            <Field label="Açıklama" value={editing.aciklama ?? ""} onChange={(v) => setEditing({ ...editing, aciklama: v })} />
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={kaydet} className="gap-1"><Save className="h-4 w-4" /> Kaydet</Button>
            <Button variant="outline" onClick={() => setEditing(null)}>Vazgeç</Button>
          </div>
        </section>
      )}

      {gecmis && (
        <section className="rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg tracking-wide">DEĞİŞİKLİK GEÇMİŞİ — {gecmis.kod}</h3>
            <Button variant="ghost" size="icon" onClick={() => setGecmis(null)} aria-label="Kapat">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DenetimKaydi kayitId={gecmis.id} />
        </section>
      )}
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
