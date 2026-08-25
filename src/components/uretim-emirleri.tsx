import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Loader2,
  Package,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const NONE = "__none__";

type Durum = "open" | "in_progress" | "done" | "cancelled";

const DURUM_LIST: Durum[] = ["open", "in_progress", "done", "cancelled"];

function durumLabel(t: ReturnType<typeof useT>, d: string) {
  switch (d) {
    case "open":
      return t("emir.durum.open", "Açık");
    case "in_progress":
      return t("emir.durum.inProgress", "Devam Ediyor");
    case "done":
      return t("emir.durum.done", "Tamamlandı");
    case "cancelled":
      return t("emir.durum.cancelled", "İptal");
    default:
      return d;
  }
}

function durumBadgeClass(d: string) {
  switch (d) {
    case "open":
      return "bg-muted text-foreground";
    case "in_progress":
      return "bg-primary/15 text-primary";
    case "done":
      return "bg-emerald-500/15 text-emerald-600";
    case "cancelled":
      return "bg-destructive/15 text-destructive";
    default:
      return "bg-muted text-foreground";
  }
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("tr-TR");
  } catch {
    return d;
  }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function suggestKod(existing: string[]) {
  const ymd = new Date();
  const y = ymd.getFullYear();
  const m = String(ymd.getMonth() + 1).padStart(2, "0");
  const d = String(ymd.getDate()).padStart(2, "0");
  const prefix = `EMR-${y}${m}${d}-`;
  let n = 1;
  const nums = existing
    .filter((k) => k.startsWith(prefix))
    .map((k) => Number(k.slice(prefix.length)))
    .filter((x) => !Number.isNaN(x));
  if (nums.length) n = Math.max(...nums) + 1;
  return `${prefix}${String(n).padStart(2, "0")}`;
}

function ProgressBar({ pct, danger }: { pct: number; danger?: boolean }) {
  const clamped = Math.max(0, Math.min(100, pct || 0));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full transition-all", danger ? "bg-destructive" : "bg-primary")}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function UretimEmirleri() {
  const t = useT();
  const qc = useQueryClient();
  const { can, isSuperAdmin } = useAuth();

  const canCreate = isSuperAdmin || can("production.create");
  const canEdit = isSuperAdmin || can("production.edit");
  const canDelete = isSuperAdmin || can("production.delete");

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>(NONE);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  // form state
  const [kod, setKod] = useState("");
  const [kodTouched, setKodTouched] = useState(false);
  const [productId, setProductId] = useState("");
  const [departmentId, setDepartmentId] = useState(NONE);
  const [hedefAdet, setHedefAdet] = useState("");
  const [teslimTarihi, setTeslimTarihi] = useState("");
  const [oncelik, setOncelik] = useState("0");
  const [notlar, setNotlar] = useState("");

  const { data: orders, isLoading } = useQuery({
    queryKey: ["production-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: progress } = useQuery({
    queryKey: ["order-progress"],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_order_progress").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: opProgress } = useQuery({
    queryKey: ["order-operation-progress"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_order_operation_progress")
        .select("*")
        .order("sira", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products-for-orders"],
    queryFn: async () =>
      (await supabase.from("products").select("id,kod,ad,silindi_at").order("kod")).data ?? [],
  });

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => (await supabase.from("departments").select("id,kod,ad").order("ad")).data ?? [],
  });

  const progressByOrder = useMemo(() => {
    const m = new Map<string, NonNullable<typeof progress>[number]>();
    (progress ?? []).forEach((p) => {
      if (p.order_id) m.set(p.order_id, p);
    });
    return m;
  }, [progress]);

  const opsByOrder = useMemo(() => {
    const m = new Map<string, typeof opProgress>();
    (opProgress ?? []).forEach((o) => {
      if (!o.order_id) return;
      const arr = m.get(o.order_id) ?? [];
      arr.push(o);
      m.set(o.order_id, arr as any);
    });
    return m;
  }, [opProgress]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["production-orders"] });
    qc.invalidateQueries({ queryKey: ["order-progress"] });
    qc.invalidateQueries({ queryKey: ["order-operation-progress"] });
    qc.invalidateQueries({ queryKey: ["audit-logs"] });
  };

  const list = orders ?? [];
  const filtered = list.filter((o) => {
    if (statusFilter !== NONE && o.durum !== statusFilter) return false;
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      const productMatch =
        (o.urun_kod_snapshot ?? "").toLowerCase().includes(s) ||
        (o.urun_ad_snapshot ?? "").toLowerCase().includes(s);
      if (!o.kod.toLowerCase().includes(s) && !productMatch) return false;
    }
    return true;
  });

  // KPIs
  const openCount = list.filter((o) => o.durum === "open").length;
  const inProgressCount = list.filter((o) => o.durum === "in_progress").length;
  const now = new Date();
  const doneToday = list.filter(
    (o) => o.durum === "done" && new Date(o.updated_at).toDateString() === now.toDateString(),
  ).length;
  const doneThisMonth = list.filter((o) => {
    if (o.durum !== "done") return false;
    const d = new Date(o.updated_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
  const totalRemaining = list.reduce((sum, o) => {
    if (o.durum === "done" || o.durum === "cancelled") return sum;
    const p = progressByOrder.get(o.id);
    const uretilen = p?.toplam_uretilen ?? 0;
    return sum + Math.max(0, o.hedef_adet - uretilen);
  }, 0);

  function resetForm() {
    setKod("");
    setKodTouched(false);
    setProductId("");
    setDepartmentId(NONE);
    setHedefAdet("");
    setTeslimTarihi("");
    setOncelik("0");
    setNotlar("");
  }

  const suggestedKod = suggestKod(list.map((o) => o.kod));

  async function createOrder(e: React.FormEvent) {
    e.preventDefault();
    const finalKod = (kodTouched ? kod : suggestedKod).trim();
    if (!finalKod) return toast.error(t("emir.kodGerekli", "Emir kodu gerekli"));
    if (!productId) return toast.error(t("emir.urunGerekli", "Ürün seçimi gerekli"));
    if (!hedefAdet || Number(hedefAdet) <= 0) return toast.error(t("emir.hedefGerekli", "Hedef adet gerekli"));
    const selectedProduct = products?.find((p) => p.id === productId);
    const { error } = await supabase.from("production_orders").insert({
      kod: finalKod,
      product_id: productId,
      department_id: departmentId === NONE ? null : departmentId,
      hedef_adet: Number(hedefAdet),
      teslim_tarihi: teslimTarihi || null,
      oncelik: Number(oncelik) || 0,
      notlar: notlar.trim() || null,
      urun_kod_snapshot: selectedProduct?.kod ?? null,
      urun_ad_snapshot: selectedProduct?.ad ?? null,
      durum: "open",
    });
    if (error) return toast.error(error.message);
    toast.success(t("emir.olusturuldu", "Üretim emri oluşturuldu"));
    resetForm();
    setShowForm(false);
    refresh();
  }

  async function patchOrder(id: string, values: Partial<{
    hedef_adet: number;
    teslim_tarihi: string | null;
    oncelik: number;
    durum: string;
    notlar: string | null;
  }>) {
    const { error } = await supabase.from("production_orders").update(values).eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  }

  async function deleteOrder(id: string, kod: string) {
    if (!confirm(t("emir.silConfirm", `"${kod}" üretim emri silinsin mi?`).replace("{kod}", kod))) return;
    const { error } = await supabase.from("production_orders").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("emir.silindi", "Üretim emri silindi"));
    refresh();
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const kpis = [
    {
      key: "open",
      label: t("emir.kpi.acik", "Açık Emirler"),
      value: openCount,
      icon: ClipboardList,
    },
    {
      key: "in_progress",
      label: t("emir.kpi.devam", "Devam Eden"),
      value: inProgressCount,
      icon: Loader2,
    },
    {
      key: "done_today",
      label: t("emir.kpi.bugun", "Bugün Tamamlanan"),
      value: doneToday,
      icon: CheckCircle2,
    },
    {
      key: "done_month",
      label: t("emir.kpi.ayTamamlanan", "Bu Ay Tamamlanan"),
      value: doneThisMonth,
      icon: CalendarClock,
    },
    {
      key: "remaining",
      label: t("emir.kpi.kalanAdet", "Toplam Kalan Adet"),
      value: totalRemaining,
      icon: Package,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.key} className="rounded-2xl border bg-card p-4 shadow-industrial">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <k.icon className="h-4 w-4 text-primary" />
              <span>{k.label}</span>
            </div>
            <div className="mt-2 text-2xl font-bold">{k.value}</div>
          </div>
        ))}
      </div>

      {canCreate && (
        <div className="rounded-2xl border bg-card p-4 shadow-industrial sm:p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              <h3 className="text-lg">{t("emir.yeniEmir", "Yeni Üretim Emri")}</h3>
            </div>
            <Button
              type="button"
              variant={showForm ? "outline" : "default"}
              size="sm"
              className="tap-target gap-1"
              onClick={() => setShowForm((s) => !s)}
            >
              <Plus className="h-4 w-4" />
              {showForm ? t("emir.iptal", "Vazgeç") : t("emir.yeni", "Yeni")}
            </Button>
          </div>

          {showForm && (
            <form onSubmit={createOrder} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("emir.kod", "Emir Kodu")}</Label>
                <Input
                  placeholder={suggestedKod}
                  value={kodTouched ? kod : suggestedKod}
                  onChange={(e) => {
                    setKodTouched(true);
                    setKod(e.target.value);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("emir.urun", "Ürün")}</Label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger className="tap-target">
                    <SelectValue placeholder={t("emir.urunSec", "Ürün seçin")} />
                  </SelectTrigger>
                  <SelectContent>
                    {products?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.kod} — {p.ad}
                        {p.silindi_at ? t("yon.ua.arsivSuffix", " (arşiv)") : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("emir.departman", "Departman")}</Label>
                <Select value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger className="tap-target">
                    <SelectValue placeholder={t("emir.departmanSec", "Departman seçin")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t("emir.departmanYok", "Belirtilmedi")}</SelectItem>
                    {departments?.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.kod} — {d.ad}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("emir.hedefAdet", "Hedef Adet")}</Label>
                <Input
                  type="number"
                  min="1"
                  value={hedefAdet}
                  onChange={(e) => setHedefAdet(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("emir.terminTarihi", "Termin Tarihi")}</Label>
                <Input type="date" min={todayIso()} value={teslimTarihi} onChange={(e) => setTeslimTarihi(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("emir.oncelik", "Öncelik")}</Label>
                <Input type="number" value={oncelik} onChange={(e) => setOncelik(e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                <Label className="text-xs">{t("emir.notlar", "Notlar")}</Label>
                <Textarea value={notlar} onChange={(e) => setNotlar(e.target.value)} rows={2} />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <Button type="submit" className="tap-target gap-1">
                  <Plus className="h-4 w-4" />
                  {t("emir.olustur", "Emri Oluştur")}
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-2xl border bg-card p-3 shadow-industrial sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder={t("emir.ara", "Emir kodu veya ürün ara...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="tap-target w-full sm:w-56">
            <SelectValue placeholder={t("emir.durumFiltre", "Durum")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{t("emir.tumDurumlar", "Tüm Durumlar")}</SelectItem>
            {DURUM_LIST.map((d) => (
              <SelectItem key={d} value={d}>
                {durumLabel(t, d)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card shadow-industrial">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="w-8 p-3"></th>
              <th className="p-3">{t("emir.th.kod", "Kod")}</th>
              <th className="p-3">{t("emir.th.urun", "Ürün")}</th>
              <th className="p-3">{t("emir.th.hedef", "Hedef")}</th>
              <th className="p-3">{t("emir.th.ilerleme", "İlerleme")}</th>
              <th className="p-3">{t("emir.th.termin", "Termin")}</th>
              <th className="p-3">{t("emir.th.oncelik", "Öncelik")}</th>
              <th className="p-3">{t("emir.th.durum", "Durum")}</th>
              <th className="p-3 text-right">{t("emir.th.islem", "İşlem")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-muted-foreground">
                  {t("emir.yukleniyor", "Yükleniyor...")}
                </td>
              </tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-muted-foreground">
                  {t("emir.kayitYok", "Kayıt bulunamadı")}
                </td>
              </tr>
            )}
            {filtered.map((o) => {
              const p = progressByOrder.get(o.id);
              const uretilen = p?.toplam_uretilen ?? 0;
              const fire = p?.toplam_fire ?? 0;
              const pct = p?.yuzde ?? (o.hedef_adet ? (uretilen / o.hedef_adet) * 100 : 0);
              const overdue =
                !!o.teslim_tarihi &&
                o.durum !== "done" &&
                o.durum !== "cancelled" &&
                new Date(o.teslim_tarihi) < new Date(todayIso());
              const isOpen = expanded.has(o.id);
              const ops = opsByOrder.get(o.id) ?? [];
              return (
                <>
                  <tr key={o.id} className="border-b align-top last:border-0 hover:bg-muted/20">
                    <td className="p-3">
                      <button
                        type="button"
                        className="tap-target flex h-6 w-6 items-center justify-center rounded hover:bg-muted"
                        onClick={() => toggleExpand(o.id)}
                        title={t("emir.detay", "Adım bazlı ilerlemeyi göster")}
                      >
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className="p-3 font-medium">{o.kod}</td>
                    <td className="p-3">
                      <div className="max-w-[200px] truncate">{o.urun_kod_snapshot ?? "—"}</div>
                      <div className="max-w-[200px] truncate text-xs text-muted-foreground">{o.urun_ad_snapshot ?? ""}</div>
                    </td>
                    <td className="p-3">
                      {canEdit ? (
                        <Input
                          type="number"
                          min="1"
                          className="w-24"
                          defaultValue={o.hedef_adet}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (v > 0 && v !== o.hedef_adet) patchOrder(o.id, { hedef_adet: v });
                          }}
                        />
                      ) : (
                        o.hedef_adet
                      )}
                    </td>
                    <td className="p-3">
                      <div className="w-40 space-y-1">
                        <ProgressBar pct={pct} />
                        <div className="text-xs text-muted-foreground">
                          {uretilen}/{o.hedef_adet} ({pct.toFixed(0)}%){fire > 0 ? ` · ${t("emir.fire", "Fire")}: ${fire}` : ""}
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      {canEdit ? (
                        <Input
                          type="date"
                          className="w-36"
                          defaultValue={o.teslim_tarihi ?? ""}
                          onBlur={(e) => {
                            const v = e.target.value || null;
                            if (v !== o.teslim_tarihi) patchOrder(o.id, { teslim_tarihi: v });
                          }}
                        />
                      ) : (
                        <span className={cn(overdue && "font-semibold text-destructive")}>{fmtDate(o.teslim_tarihi)}</span>
                      )}
                      {overdue && (
                        <div className="mt-1 flex items-center gap-1 text-xs font-medium text-destructive">
                          <AlertTriangle className="h-3 w-3" /> {t("emir.gecikti", "Gecikti")}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      {canEdit ? (
                        <Input
                          type="number"
                          className="w-16"
                          defaultValue={o.oncelik}
                          onBlur={(e) => {
                            const v = Number(e.target.value) || 0;
                            if (v !== o.oncelik) patchOrder(o.id, { oncelik: v });
                          }}
                        />
                      ) : (
                        o.oncelik
                      )}
                    </td>
                    <td className="p-3">
                      {canEdit ? (
                        <Select value={o.durum} onValueChange={(v) => patchOrder(o.id, { durum: v })}>
                          <SelectTrigger className="tap-target w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DURUM_LIST.map((d) => (
                              <SelectItem key={d} value={d}>
                                {durumLabel(t, d)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className={cn("rounded-full px-2 py-1 text-xs font-medium", durumBadgeClass(o.durum))}>
                          {durumLabel(t, o.durum)}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title={t("emir.sil", "Sil")}
                          onClick={() => deleteOrder(o.id, o.kod)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={`${o.id}-detail`} className="border-b bg-muted/10 last:border-0">
                      <td></td>
                      <td colSpan={8} className="p-3">
                        {canEdit && (
                          <div className="mb-3 space-y-1.5">
                            <Label className="text-xs">{t("emir.notlar", "Notlar")}</Label>
                            <Textarea
                              rows={2}
                              defaultValue={o.notlar ?? ""}
                              onBlur={(e) => {
                                const v = e.target.value.trim() || null;
                                if (v !== o.notlar) patchOrder(o.id, { notlar: v });
                              }}
                            />
                          </div>
                        )}
                        {!canEdit && o.notlar && (
                          <p className="mb-3 text-xs text-muted-foreground">{o.notlar}</p>
                        )}
                        {ops.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            {t("emir.adimYok", "Bu ürün için tanımlı üretim akışı bulunmuyor.")}
                          </p>
                        ) : (
                          <div className="space-y-2">
                            <div className="text-xs font-medium text-muted-foreground">
                              {t("emir.adimIlerlemesi", "Adım Bazlı İlerleme")}
                            </div>
                            {ops
                              .slice()
                              .sort((a, b) => (a.sira ?? 0) - (b.sira ?? 0))
                              .map((op) => (
                                <div key={op.operation_id} className="flex flex-col gap-1 rounded-lg border bg-card p-2 sm:flex-row sm:items-center sm:gap-3">
                                  <div className="flex w-full items-center gap-2 sm:w-56">
                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                                      {op.sira}
                                    </span>
                                    <span className="truncate text-sm">{op.operation_ad}</span>
                                  </div>
                                  <div className="flex-1 space-y-1">
                                    <ProgressBar pct={op.yuzde ?? 0} />
                                  </div>
                                  <div className="w-full text-xs text-muted-foreground sm:w-40 sm:text-right">
                                    {op.uretilen ?? 0}/{op.hedef_adet ?? o.hedef_adet} ({(op.yuzde ?? 0).toFixed(0)}%)
                                    {op.fire ? ` · ${t("emir.fire", "Fire")}: ${op.fire}` : ""}
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
