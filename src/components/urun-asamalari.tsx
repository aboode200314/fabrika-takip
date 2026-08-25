import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Building2,
  CheckCircle2,
  Copy,
  ListOrdered,
  Pencil,
  Plus,
  Timer,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";

const NONE = "__none__";

type Machine = { id: string; kod: string; ad: string; department_id: string | null };
type Product = { id: string; kod: string; ad: string; department_id: string | null; silindi_at: string | null };
type Department = { id: string; kod: string; ad: string };
type Operation = {
  id: string;
  product_id: string;
  sira: number;
  ad: string;
  kod: string | null;
  aciklama: string | null;
  machine_id: string | null;
  tahmini_sure_saniye: number | null;
  hazirlik_dakika: number;
  hedef_adet: number | null;
  gereken_yetkinlik: string | null;
  kalite_kontrol: boolean;
};
type OpMachineLink = { id: string; operation_id: string; machine_id: string; varsayilan: boolean };

type StepFormState = {
  kod: string;
  ad: string;
  sira: string;
  tahmini_sure_saniye: string;
  hazirlik_dakika: string;
  hedef_adet: string;
  gereken_yetkinlik: string;
  kalite_kontrol: boolean;
  aciklama: string;
  machineIds: string[];
  defaultMachineId: string;
};

const emptyForm: StepFormState = {
  kod: "",
  ad: "",
  sira: "",
  tahmini_sure_saniye: "",
  hazirlik_dakika: "",
  hedef_adet: "",
  gereken_yetkinlik: "",
  kalite_kontrol: false,
  aciklama: "",
  machineIds: [],
  defaultMachineId: "",
};

function dk(saniye: number, t: ReturnType<typeof useT>) {
  if (!saniye) return "—";
  const m = Math.floor(saniye / 60);
  const s = Math.round(saniye % 60);
  return m > 0 ? `${m} ${t("yon.akis.dk")}${s ? ` ${s} ${t("yon.akis.sn")}` : ""}` : `${s} ${t("yon.akis.sn")}`;
}

/**
 * Ürün → Üretim akışı (Routing) → Makine bağlama.
 * Master Data: burada tanımlanan akış, üretim kaydı açıldığında kayda anlık görüntü
 * (snapshot) olarak yazılır; akış sonradan değişse bile eski kayıtlar bozulmaz.
 */
export function UrunAsamalari() {
  const t = useT();
  const qc = useQueryClient();
  const { can, isSuperAdmin } = useAuth();
  const canEdit = isSuperAdmin || can("flow.edit");
  const canCreate = isSuperAdmin || can("flow.create") || canEdit;
  const canDelete = isSuperAdmin || can("flow.delete") || canEdit;

  const [productId, setProductId] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<StepFormState>(emptyForm);
  const [editOp, setEditOp] = useState<Operation | null>(null);
  const [editForm, setEditForm] = useState<StepFormState>(emptyForm);

  const { data: products } = useQuery({
    queryKey: ["products-routing"],
    queryFn: async () =>
      ((await supabase.from("products").select("id,kod,ad,department_id,silindi_at").is("silindi_at", null).order("kod"))
        .data ?? []) as Product[],
  });
  const { data: machines } = useQuery({
    queryKey: ["machines-all"],
    queryFn: async () =>
      ((await supabase.from("machines").select("id,kod,ad,department_id").order("kod")).data ?? []) as Machine[],
  });
  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => ((await supabase.from("departments").select("id,kod,ad").order("ad")).data ?? []) as Department[],
  });
  const { data: ops } = useQuery({
    queryKey: ["product-operations", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_operations")
        .select(
          "id,product_id,sira,ad,kod,aciklama,machine_id,tahmini_sure_saniye,hazirlik_dakika,hedef_adet,gereken_yetkinlik,kalite_kontrol",
        )
        .eq("product_id", productId)
        .order("sira");
      if (error) throw error;
      return (data ?? []) as Operation[];
    },
  });
  const opIds = useMemo(() => (ops ?? []).map((o) => o.id), [ops]);
  const { data: opMachines } = useQuery({
    queryKey: ["operation-machines", productId, opIds.join(",")],
    enabled: opIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operation_machines")
        .select("id,operation_id,machine_id,varsayilan")
        .in("operation_id", opIds);
      if (error) throw error;
      return (data ?? []) as OpMachineLink[];
    },
  });

  const product = (products ?? []).find((p) => p.id === productId);
  const department = departments?.find((d) => d.id === product?.department_id);
  const list = ops ?? [];
  const toplamSure = list.reduce((s, o) => s + Number(o.tahmini_sure_saniye ?? 0), 0);
  const toplamHazirlik = list.reduce((s, o) => s + Number(o.hazirlik_dakika ?? 0), 0);

  const machinesFor = (opId: string) => (opMachines ?? []).filter((m) => m.operation_id === opId);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["product-operations", productId] });
    qc.invalidateQueries({ queryKey: ["operation-machines"] });
    qc.invalidateQueries({ queryKey: ["product-operations-all"] });
    qc.invalidateQueries({ queryKey: ["products-routing"] });
    qc.invalidateQueries({ queryKey: ["audit-logs"] });
  };

  function machineLabel(id: string) {
    const m = machines?.find((x) => x.id === id);
    return m ? `${m.kod} — ${m.ad}` : id;
  }

  function toggleMachine(form: StepFormState, setForm: (f: StepFormState) => void, id: string) {
    const has = form.machineIds.includes(id);
    const machineIds = has ? form.machineIds.filter((x) => x !== id) : [...form.machineIds, id];
    let defaultMachineId = form.defaultMachineId;
    if (has && defaultMachineId === id) defaultMachineId = machineIds[0] ?? "";
    if (!has && !defaultMachineId) defaultMachineId = id;
    setForm({ ...form, machineIds, defaultMachineId });
  }

  async function syncMachines(operationId: string, machineIds: string[], defaultMachineId: string) {
    // Simplest reliable approach: wipe & re-insert.
    await supabase.from("operation_machines").delete().eq("operation_id", operationId);
    if (machineIds.length > 0) {
      const rows = machineIds.map((machine_id) => ({
        operation_id: operationId,
        machine_id,
        varsayilan: machine_id === (defaultMachineId || machineIds[0]),
      }));
      const { error } = await supabase.from("operation_machines").insert(rows);
      if (error) toast.error(error.message);
    }
    const finalDefault = defaultMachineId || machineIds[0] || null;
    await supabase.from("product_operations").update({ machine_id: finalDefault }).eq("id", operationId);
  }

  function openAdd() {
    const nextSira = (list.at(-1)?.sira ?? 0) + 10;
    setAddForm({ ...emptyForm, sira: String(nextSira) });
    setAddOpen(true);
  }

  async function submitAdd() {
    if (!productId) return;
    if (!addForm.ad.trim()) return toast.error(t("yon.akis.adGerekli"));
    const { data, error } = await supabase
      .from("product_operations")
      .insert({
        product_id: productId,
        sira: Number(addForm.sira) || (list.at(-1)?.sira ?? 0) + 10,
        ad: addForm.ad.trim(),
        kod: addForm.kod.trim() || null,
        tahmini_sure_saniye: addForm.tahmini_sure_saniye ? Number(addForm.tahmini_sure_saniye) : null,
        hazirlik_dakika: addForm.hazirlik_dakika ? Number(addForm.hazirlik_dakika) : 0,
        hedef_adet: addForm.hedef_adet ? Number(addForm.hedef_adet) : null,
        gereken_yetkinlik: addForm.gereken_yetkinlik.trim() || null,
        kalite_kontrol: addForm.kalite_kontrol,
        aciklama: addForm.aciklama.trim() || null,
        machine_id: addForm.defaultMachineId || null,
      })
      .select("id")
      .single();
    if (error || !data) return toast.error(error?.message ?? t("yon.akis.hata"));
    if (addForm.machineIds.length > 0) {
      await syncMachines(data.id, addForm.machineIds, addForm.defaultMachineId);
    }
    toast.success(t("yon.akis.eklendi"));
    setAddOpen(false);
    refresh();
  }

  function openEdit(o: Operation) {
    const links = machinesFor(o.id);
    setEditForm({
      kod: o.kod ?? "",
      ad: o.ad,
      sira: String(o.sira),
      tahmini_sure_saniye: o.tahmini_sure_saniye?.toString() ?? "",
      hazirlik_dakika: o.hazirlik_dakika?.toString() ?? "",
      hedef_adet: o.hedef_adet?.toString() ?? "",
      gereken_yetkinlik: o.gereken_yetkinlik ?? "",
      kalite_kontrol: o.kalite_kontrol,
      aciklama: o.aciklama ?? "",
      machineIds: links.map((l) => l.machine_id),
      defaultMachineId: links.find((l) => l.varsayilan)?.machine_id ?? links[0]?.machine_id ?? o.machine_id ?? "",
    });
    setEditOp(o);
  }

  async function submitEdit() {
    if (!editOp) return;
    if (!editForm.ad.trim()) return toast.error(t("yon.akis.adGerekli"));
    const { error } = await supabase
      .from("product_operations")
      .update({
        kod: editForm.kod.trim() || null,
        ad: editForm.ad.trim(),
        sira: Number(editForm.sira) || editOp.sira,
        tahmini_sure_saniye: editForm.tahmini_sure_saniye ? Number(editForm.tahmini_sure_saniye) : null,
        hazirlik_dakika: editForm.hazirlik_dakika ? Number(editForm.hazirlik_dakika) : 0,
        hedef_adet: editForm.hedef_adet ? Number(editForm.hedef_adet) : null,
        gereken_yetkinlik: editForm.gereken_yetkinlik.trim() || null,
        kalite_kontrol: editForm.kalite_kontrol,
        aciklama: editForm.aciklama.trim() || null,
      })
      .eq("id", editOp.id);
    if (error) return toast.error(error.message);
    await syncMachines(editOp.id, editForm.machineIds, editForm.defaultMachineId);
    toast.success(t("yon.akis.guncellendi"));
    setEditOp(null);
    refresh();
  }

  async function remove(o: Operation) {
    if (!confirm(t("yon.akis.silConfirm").replace("{ad}", o.ad))) return;
    const { error } = await supabase.from("product_operations").delete().eq("id", o.id);
    if (error) return toast.error(error.message);
    toast.success(t("yon.akis.silindi"));
    refresh();
  }

  async function duplicate(o: Operation) {
    const links = machinesFor(o.id);
    const { data, error } = await supabase
      .from("product_operations")
      .insert({
        product_id: o.product_id,
        sira: o.sira + 5,
        ad: `${o.ad} (${t("yon.akis.kopyala")})`,
        kod: o.kod,
        tahmini_sure_saniye: o.tahmini_sure_saniye,
        hazirlik_dakika: o.hazirlik_dakika,
        hedef_adet: o.hedef_adet,
        gereken_yetkinlik: o.gereken_yetkinlik,
        kalite_kontrol: o.kalite_kontrol,
        aciklama: o.aciklama,
        machine_id: o.machine_id,
      })
      .select("id")
      .single();
    if (error || !data) return toast.error(error?.message ?? t("yon.akis.hata"));
    if (links.length > 0) {
      const defaultId = links.find((l) => l.varsayilan)?.machine_id ?? links[0].machine_id;
      await syncMachines(
        data.id,
        links.map((l) => l.machine_id),
        defaultId,
      );
    }
    toast.success(t("yon.akis.kopyalandi"));
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

  const machineOptions = product ? machines ?? [] : [];

  function MachinePicker({ form, setForm }: { form: StepFormState; setForm: (f: StepFormState) => void }) {
    return (
      <div className="space-y-2">
        <Label className="text-xs">{t("yon.akis.makineler")}</Label>
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-2">
          {machineOptions.length === 0 && (
            <p className="text-xs text-muted-foreground">{t("yon.akis.makineYok")}</p>
          )}
          {machineOptions.map((m) => {
            const checked = form.machineIds.includes(m.id);
            return (
              <div key={m.id} className="flex items-center justify-between gap-2 rounded-md px-1 py-1 hover:bg-accent/40">
                <label className="flex flex-1 items-center gap-2 text-sm">
                  <Checkbox checked={checked} onCheckedChange={() => toggleMachine(form, setForm, m.id)} />
                  {m.kod} — {m.ad}
                </label>
                {checked && (
                  <Button
                    type="button"
                    size="sm"
                    variant={form.defaultMachineId === m.id ? "default" : "ghost"}
                    className="h-6 px-2 text-[10px]"
                    onClick={() => setForm({ ...form, defaultMachineId: m.id })}
                  >
                    {form.defaultMachineId === m.id ? t("yon.akis.varsayilan") : t("yon.akis.varsayilanYap")}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function StepFields({ form, setForm }: { form: StepFormState; setForm: (f: StepFormState) => void }) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">{t("yon.akis.kod")}</Label>
          <Input placeholder={t("yon.akis.kodPh")} value={form.kod} onChange={(e) => setForm({ ...form, kod: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("yon.akis.sira")}</Label>
          <Input type="number" value={form.sira} onChange={(e) => setForm({ ...form, sira: e.target.value })} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">{t("yon.akis.ad")}</Label>
          <Input placeholder={t("yon.akis.adPh")} value={form.ad} onChange={(e) => setForm({ ...form, ad: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("yon.akis.sure")}</Label>
          <Input
            type="number"
            min="0"
            value={form.tahmini_sure_saniye}
            onChange={(e) => setForm({ ...form, tahmini_sure_saniye: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("yon.akis.hazirlik")}</Label>
          <Input
            type="number"
            min="0"
            value={form.hazirlik_dakika}
            onChange={(e) => setForm({ ...form, hazirlik_dakika: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("yon.akis.hedefAdet")}</Label>
          <Input type="number" min="0" value={form.hedef_adet} onChange={(e) => setForm({ ...form, hedef_adet: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("yon.akis.yetkinlik")}</Label>
          <Input
            placeholder={t("yon.akis.yetkinlikPh")}
            value={form.gereken_yetkinlik}
            onChange={(e) => setForm({ ...form, gereken_yetkinlik: e.target.value })}
          />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <Checkbox
            checked={form.kalite_kontrol}
            onCheckedChange={(v) => setForm({ ...form, kalite_kontrol: v === true })}
          />
          <Label className="text-xs font-normal">{t("yon.akis.kaliteKontrol")}</Label>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">{t("yon.akis.aciklama")}</Label>
          <Textarea
            placeholder={t("yon.akis.aciklamaPh")}
            value={form.aciklama}
            onChange={(e) => setForm({ ...form, aciklama: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <MachinePicker form={form} setForm={setForm} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-5 shadow-industrial">
        <div className="flex items-center gap-2">
          <ListOrdered className="h-5 w-5 text-primary" />
          <h3 className="text-lg">{t("yon.ua.title")}</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t("yon.ua.desc")}</p>
        {!canEdit && (
          <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{t("yon.akis.noPerm")}</p>
        )}
        <div className="mt-4 space-y-1.5">
          <Label className="text-xs">{t("yon.akis.urunSec")}</Label>
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger className="tap-target"><SelectValue placeholder={t("yon.akis.urunPh")} /></SelectTrigger>
            <SelectContent>
              {products?.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.kod} — {p.ad}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {product && (
            <div className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              {department ? `${department.kod} — ${department.ad}` : t("yon.akis.departmanYok")}
            </div>
          )}
        </div>
      </div>

      {!productId && (
        <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground shadow-industrial">
          {t("yon.akis.urunSeciniz")}
        </div>
      )}

      {productId && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{t("yon.akis.adimSayisi").replace("{n}", String(list.length))}</span>
            {canCreate && (
              <Button size="sm" className="gap-1 tap-target" onClick={openAdd}>
                <Plus className="h-4 w-4" />{t("yon.akis.adimEkle")}
              </Button>
            )}
          </div>

          {list.length === 0 && (
            <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground shadow-industrial">
              {t("yon.akis.henuzYok")}
            </p>
          )}

          <div className="space-y-0">
            {list.map((o, i) => {
              const links = machinesFor(o.id);
              return (
                <div key={o.id}>
                  <div className="rounded-2xl border bg-card p-4 shadow-industrial">
                    <div className="flex flex-wrap items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{o.ad}</span>
                          {o.kod && <Badge variant="secondary" className="font-mono text-[10px]">{o.kod}</Badge>}
                          {o.kalite_kontrol && (
                            <Badge className="gap-1 bg-emerald-600 text-[10px] text-white hover:bg-emerald-600">
                              <CheckCircle2 className="h-3 w-3" />{t("yon.akis.kaliteRozeti")}
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {links.length === 0 && (
                            <span className="text-xs text-muted-foreground">{t("yon.akis.makineYok")}</span>
                          )}
                          {links.map((l) => (
                            <Badge key={l.id} variant={l.varsayilan ? "default" : "outline"} className="text-[10px]">
                              {machineLabel(l.machine_id)}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><Timer className="h-3 w-3" />{dk(o.tahmini_sure_saniye ?? 0, t)}</span>
                          <span>{t("yon.akis.hazirlik")}: {o.hazirlik_dakika ?? 0} {t("yon.akis.dk")}</span>
                          {o.hedef_adet != null && <span>{t("yon.akis.hedefAdet")}: {o.hedef_adet}</span>}
                          {o.gereken_yetkinlik && <span>{t("yon.akis.yetkinlik")}: {o.gereken_yetkinlik}</span>}
                        </div>
                        {o.aciklama && <p className="text-xs text-muted-foreground">{o.aciklama}</p>}
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-1">
                        <Button variant="ghost" size="icon" disabled={i === 0 || !canEdit} onClick={() => move(i, -1)} title={t("yon.akis.yukari")}>
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" disabled={i === list.length - 1 || !canEdit} onClick={() => move(i, 1)} title={t("yon.akis.asagi")}>
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        {canEdit && (
                          <Button variant="ghost" size="icon" title={t("yon.akis.duzenle")} onClick={() => openEdit(o)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canCreate && (
                          <Button variant="ghost" size="icon" title={t("yon.akis.kopyala")} onClick={() => duplicate(o)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button variant="ghost" size="icon" title={t("yon.akis.sil")} onClick={() => remove(o)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  {i < list.length - 1 && (
                    <div className="flex justify-center py-1">
                      <ArrowDown className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {list.length > 0 && (
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card px-4 py-3 text-sm shadow-industrial">
              <span className="inline-flex items-center gap-2">
                <Timer className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">{t("yon.akis.toplamCevrim")}</span>
                <strong className="font-mono">{dk(toplamSure, t)}</strong>
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="text-muted-foreground">{t("yon.akis.toplamHazirlik")}</span>
                <strong className="font-mono">{toplamHazirlik} {t("yon.akis.dk")}</strong>
              </span>
            </div>
          )}
        </>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>{t("yon.akis.yeniAdim")}</DialogTitle></DialogHeader>
          <StepFields form={addForm} setForm={setAddForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>{t("yon.akis.vazgec")}</Button>
            <Button onClick={submitAdd}>{t("yon.akis.kaydet")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editOp} onOpenChange={(v) => !v && setEditOp(null)}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>{t("yon.akis.duzenleTitle")}</DialogTitle></DialogHeader>
          <StepFields form={editForm} setForm={setEditForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOp(null)}>{t("yon.akis.vazgec")}</Button>
            <Button onClick={submitEdit}>{t("yon.akis.kaydet")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
