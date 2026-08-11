import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

const NONE = "__none__";

/**
 * Departman / üretim hattı tanımları, makine bağlama ve kullanıcı kapsamı.
 * Kullanıcının kapsamı = sorumlu olduğu departmanlar; panel ve raporlarda
 * makine listesi bu kapsama göre daraltılır.
 */
export function DepartmanKapsam() {
  const qc = useQueryClient();
  const [kod, setKod] = useState("");
  const [ad, setAd] = useState("");
  const [userId, setUserId] = useState("");

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("id,kod,ad,aktif").order("ad");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: machines } = useQuery({
    queryKey: ["machines-all"],
    queryFn: async () => (await supabase.from("machines").select("id,kod,ad,department_id").order("kod")).data ?? [],
  });
  const { data: profiles } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => (await supabase.from("profiles").select("id,ad_soyad,personel_id").order("ad_soyad")).data ?? [],
  });
  const { data: scope } = useQuery({
    queryKey: ["user-departments", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_departments").select("department_id").eq("user_id", userId);
      if (error) throw error;
      return (data ?? []).map((r) => r.department_id);
    },
  });

  const refreshDeps = () => {
    qc.invalidateQueries({ queryKey: ["departments"] });
    qc.invalidateQueries({ queryKey: ["machines-all"] });
    qc.invalidateQueries({ queryKey: ["audit-logs"] });
  };

  async function ekle(e: React.FormEvent) {
    e.preventDefault();
    if (!kod.trim() || !ad.trim()) return toast.error("Kod ve ad gerekli");
    const { error } = await supabase.from("departments").insert({ kod: kod.trim(), ad: ad.trim() });
    if (error) return toast.error(error.message);
    setKod(""); setAd(""); toast.success("Departman eklendi");
    refreshDeps();
  }

  async function toggleScope(depId: string, on: boolean) {
    if (!userId) return;
    if (on) {
      const { error } = await supabase.from("user_departments").insert({ user_id: userId, department_id: depId });
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("user_departments").delete().eq("user_id", userId).eq("department_id", depId);
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["user-departments", userId] });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h3 className="text-lg">Departman / Üretim Hattı</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Makineler ve ürünler bir departmana bağlanır. Bir süpervizöre departman kapsamı verildiğinde
          panel ve raporlarda yalnızca o departmanın makineleri görünür.
        </p>
      </div>

      <form className="flex flex-wrap gap-2 rounded-xl border bg-card p-4" onSubmit={ekle}>
        <Input placeholder="Kod (örn. KESIM)" value={kod} onChange={(e) => setKod(e.target.value)} className="w-40" />
        <Input placeholder="Ad (örn. Sac Kesim Hattı)" value={ad} onChange={(e) => setAd(e.target.value)} className="min-w-[200px] flex-1" />
        <Button type="submit" className="gap-1"><Plus className="h-4 w-4" />Ekle</Button>
      </form>

      <div className="rounded-xl border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kod</TableHead>
              <TableHead>Ad</TableHead>
              <TableHead>Makine</TableHead>
              <TableHead>Aktif</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(departments ?? []).map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-mono">{d.kod}</TableCell>
                <TableCell>{d.ad}</TableCell>
                <TableCell className="text-xs">
                  {(machines ?? []).filter((m) => m.department_id === d.id).length}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={d.aktif}
                    onCheckedChange={async (v) => {
                      await supabase.from("departments").update({ aktif: v }).eq("id", d.id);
                      refreshDeps();
                    }}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost" size="icon" title="Sil"
                    onClick={async () => {
                      if (!confirm(`${d.ad} silinsin mi?`)) return;
                      const { error } = await supabase.from("departments").delete().eq("id", d.id);
                      if (error) return toast.error("Bu departmana bağlı kayıtlar var.");
                      refreshDeps();
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <section className="rounded-2xl border bg-card p-5">
        <h4 className="mb-3 text-base">Makine → Departman bağlantısı</h4>
        <div className="grid gap-2 sm:grid-cols-2">
          {(machines ?? []).map((m) => (
            <div key={m.id} className="flex items-center gap-2 rounded-lg border p-2">
              <span className="min-w-0 flex-1 truncate text-sm">
                <span className="font-mono text-xs text-muted-foreground">{m.kod}</span> {m.ad}
              </span>
              <Select
                value={m.department_id ?? NONE}
                onValueChange={async (v) => {
                  await supabase.from("machines").update({ department_id: v === NONE ? null : v }).eq("id", m.id);
                  refreshDeps();
                }}
              >
                <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Bağlı değil</SelectItem>
                  {departments?.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.ad}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <h4 className="mb-3 text-base">Kullanıcı kapsamı</h4>
        <div className="max-w-md space-y-1.5">
          <Label className="text-xs">Kullanıcı</Label>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger className="tap-target"><SelectValue placeholder="Kullanıcı seçiniz" /></SelectTrigger>
            <SelectContent>
              {profiles?.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.ad_soyad} ({p.personel_id})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {userId && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {(departments ?? []).map((d) => (
              <label key={d.id} className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                <span>{d.ad}</span>
                <Switch
                  checked={(scope ?? []).includes(d.id)}
                  onCheckedChange={(v) => toggleScope(d.id, v)}
                />
              </label>
            ))}
            {(scope ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Kapsam seçilmediğinde kullanıcı, makine/ürün yetkileri kadar geniş erişime sahiptir.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
