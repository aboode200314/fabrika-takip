import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck, Crown } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_OPERATOR_PERMISSIONS,
  DATA_SCOPES,
  permissionEquivalents,
  type DataScope,
} from "@/lib/permissions";
import { useT } from "@/lib/i18n";

export function YetkilerTab() {
  const t = useT();
  const qc = useQueryClient();
  const [userId, setUserId] = useState("");

  const { data: profiles } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,ad_soyad,personel_id,veri_kapsam").order("ad_soyad");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: superAdmins } = useQuery({
    queryKey: ["super-admins"],
    queryFn: async () => {
      const { data, error } = await supabase.from("super_admins").select("user_id");
      if (error) throw error;
      return (data ?? []).map((r) => r.user_id);
    },
  });

  const { data: catalog } = useQuery({
    queryKey: ["permission-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase.from("permission_catalog").select("key,module,action,modul_ad,islem_ad,sira").order("sira");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: perms } = useQuery({
    queryKey: ["user-permissions", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_permissions").select("permission").eq("user_id", userId);
      if (error) throw error;
      return (data ?? []).map((r) => r.permission);
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
  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id,kod,ad").order("kod");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: departments } = useQuery({
    queryKey: ["departments-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("id,kod,ad").order("kod");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: userMachines } = useQuery({
    queryKey: ["user-machines", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_machines").select("machine_id").eq("user_id", userId);
      if (error) throw error;
      return (data ?? []).map((r) => r.machine_id);
    },
  });
  const { data: userProducts } = useQuery({
    queryKey: ["user-products", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_products").select("product_id").eq("user_id", userId);
      if (error) throw error;
      return (data ?? []).map((r) => r.product_id);
    },
  });
  const { data: userDepartments } = useQuery({
    queryKey: ["user-departments", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_departments").select("department_id").eq("user_id", userId);
      if (error) throw error;
      return (data ?? []).map((r) => r.department_id);
    },
  });

  const isSA = !!userId && (superAdmins ?? []).includes(userId);
  const effective = expandActive(perms?.length ? perms : DEFAULT_OPERATOR_PERMISSIONS);
  const currentScope = (profiles ?? []).find((p) => p.id === userId)?.veri_kapsam ?? "own";

  function expandActive(list: string[]): string[] {
    const out = new Set<string>();
    for (const p of list) for (const e of permissionEquivalents(p)) out.add(e);
    return [...out];
  }

  function hasPermission(key: string): boolean {
    return permissionEquivalents(key).some((k) => effective.includes(k));
  }

  async function togglePerm(key: string, on: boolean) {
    // ilk değişiklikte varsayılan set kalıcı hale getirilir
    if (!perms?.length) {
      await supabase.from("user_permissions").insert(
        DEFAULT_OPERATOR_PERMISSIONS.map((p) => ({ user_id: userId, permission: p })),
      );
    }
    if (on) {
      const { error } = await supabase.from("user_permissions").insert({ user_id: userId, permission: key });
      if (error && !error.message.includes("duplicate")) return toast.error(error.message);
    } else {
      const equivalents = permissionEquivalents(key);
      const { error } = await supabase
        .from("user_permissions").delete().eq("user_id", userId).in("permission", equivalents);
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["user-permissions", userId] });
  }

  async function toggleMachine(id: string, on: boolean) {
    if (on) await supabase.from("user_machines").insert({ user_id: userId, machine_id: id });
    else await supabase.from("user_machines").delete().eq("user_id", userId).eq("machine_id", id);
    qc.invalidateQueries({ queryKey: ["user-machines", userId] });
  }
  async function toggleProduct(id: string, on: boolean) {
    if (on) await supabase.from("user_products").insert({ user_id: userId, product_id: id });
    else await supabase.from("user_products").delete().eq("user_id", userId).eq("product_id", id);
    qc.invalidateQueries({ queryKey: ["user-products", userId] });
  }
  async function toggleDepartment(id: string, on: boolean) {
    if (on) await supabase.from("user_departments").insert({ user_id: userId, department_id: id });
    else await supabase.from("user_departments").delete().eq("user_id", userId).eq("department_id", id);
    qc.invalidateQueries({ queryKey: ["user-departments", userId] });
  }

  async function changeScope(scope: DataScope) {
    const { error } = await supabase.from("profiles").update({ veri_kapsam: scope }).eq("id", userId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["profiles-min"] });
    toast.success(t("yon.uy.scopeSaved", "Veri kapsamı güncellendi."));
  }

  const grouped = groupCatalog(catalog ?? []);

  return (
    <div className="space-y-5 pt-4">
      <section className="rounded-2xl border bg-card p-5 shadow-industrial">
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">
          {t("yon.uy.selectUser", "Kullanıcı Seç")}
        </Label>
        <Select value={userId} onValueChange={setUserId}>
          <SelectTrigger className="tap-target mt-2 max-w-md">
            <SelectValue placeholder={t("yon.uy.selectUserPh", "Kullanıcı seçiniz")} />
          </SelectTrigger>
          <SelectContent>
            {profiles?.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.ad_soyad ?? p.personel_id} ({p.personel_id})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isSA && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
            <Crown className="h-4 w-4" />
            {t("yon.uy.superAdminNotice", "Bu hesap Ana Yönetici (Super Admin) — tüm yetkilere sınırsız sahiptir.")}
          </div>
        )}
      </section>

      {userId && !isSA && (
        <>
          <section className="rounded-2xl border bg-card p-5 shadow-industrial">
            <h3 className="mb-3 font-display text-lg tracking-wide">{t("yon.uy.matrixTitle", "YETKİ MATRİSİ")}</h3>
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="w-full min-w-[640px] border-separate border-spacing-y-1.5 text-sm">
                <thead>
                  <tr>
                    <th className="text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("yon.uy.module", "Modül")}
                    </th>
                    {grouped.actions.map((a) => (
                      <th key={a.action} className="px-1 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {a.islem_ad ?? a.action}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grouped.rows.map((row) => (
                    <tr key={row.module}>
                      <td className="whitespace-nowrap rounded-l-lg bg-background px-3 py-2 text-sm font-medium">
                        {row.modul_ad ?? row.module}
                      </td>
                      {grouped.actions.map((a, idx) => {
                        const cell = row.cells[a.action];
                        return (
                          <td
                            key={a.action}
                            className={`bg-background px-1 py-2 text-center ${idx === grouped.actions.length - 1 ? "rounded-r-lg" : ""}`}
                          >
                            {cell ? (
                              <Switch
                                checked={hasPermission(cell.key)}
                                onCheckedChange={(v) => togglePerm(cell.key, v)}
                              />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-5 shadow-industrial">
            <h3 className="mb-1 font-display text-lg tracking-wide">{t("yon.uy.scopeTitle", "VERİ KAPSAMI")}</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              {t("yon.uy.scopeHelp", "Kullanıcının hangi kayıtları görebileceğini belirler.")}
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {DATA_SCOPES.map((s) => (
                <label
                  key={s.key}
                  className={`flex cursor-pointer flex-col gap-1 rounded-lg border px-3 py-2.5 ${currentScope === s.key ? "border-primary bg-primary/5" : "bg-background"}`}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="radio"
                      name="veri-kapsami"
                      className="tap-target h-4 w-4"
                      checked={currentScope === s.key}
                      onChange={() => changeScope(s.key)}
                    />
                    {t(`yon.uy.scope.${s.key}`, s.label)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {s.key === "own" &&
                      t("yon.uy.scope.own.desc", "Yalnızca kendi oluşturduğu kayıtları görür.")}
                    {s.key === "department" &&
                      t("yon.uy.scope.department.desc", "Kendi departmanı / hattındaki kayıtları görür.")}
                    {s.key === "all" &&
                      t("yon.uy.scope.all.desc", "Fabrikadaki tüm kayıtları görür.")}
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-5 shadow-industrial">
            <h3 className="mb-1 font-display text-lg tracking-wide">{t("yon.uy.machinesTitle", "MAKİNE YETKİLERİ")}</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              {t("yon.uy.noneAllHint", "Hiçbiri seçilmezse kullanıcı tümünü görebilir.")}
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {machines?.map((m) => (
                <ToggleRow
                  key={m.id}
                  label={`${m.kod} — ${m.ad}`}
                  checked={(userMachines ?? []).includes(m.id)}
                  onChange={(v) => toggleMachine(m.id, v)}
                />
              ))}
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-5 shadow-industrial">
            <h3 className="mb-1 font-display text-lg tracking-wide">{t("yon.uy.productsTitle", "ÜRÜN YETKİLERİ")}</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              {t("yon.uy.noneAllHint", "Hiçbiri seçilmezse kullanıcı tümünü görebilir.")}
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {products?.map((p) => (
                <ToggleRow
                  key={p.id}
                  label={`${p.kod} — ${p.ad}`}
                  checked={(userProducts ?? []).includes(p.id)}
                  onChange={(v) => toggleProduct(p.id, v)}
                />
              ))}
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-5 shadow-industrial">
            <h3 className="mb-1 font-display text-lg tracking-wide">{t("yon.uy.departmentsTitle", "DEPARTMAN YETKİLERİ")}</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              {t("yon.uy.noneAllHint", "Hiçbiri seçilmezse kullanıcı tümünü görebilir.")}
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {departments?.map((d) => (
                <ToggleRow
                  key={d.id}
                  label={`${d.kod} — ${d.ad}`}
                  checked={(userDepartments ?? []).includes(d.id)}
                  onChange={(v) => toggleDepartment(d.id, v)}
                />
              ))}
            </div>
          </section>
        </>
      )}

      {!userId && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4" /> {t("yon.uy.selectHint", "Yetkilerini düzenlemek için bir kullanıcı seçin.")}
        </p>
      )}
    </div>
  );
}

type CatalogRow = { key: string; module: string; action: string; modul_ad: string | null; islem_ad: string | null; sira: number };

function groupCatalog(catalog: CatalogRow[]) {
  const moduleOrder: { module: string; modul_ad: string | null }[] = [];
  const actionOrder: { action: string; islem_ad: string | null }[] = [];
  const cellMap = new Map<string, Map<string, CatalogRow>>();

  for (const row of catalog) {
    if (!moduleOrder.find((m) => m.module === row.module)) {
      moduleOrder.push({ module: row.module, modul_ad: row.modul_ad });
    }
    if (!actionOrder.find((a) => a.action === row.action)) {
      actionOrder.push({ action: row.action, islem_ad: row.islem_ad });
    }
    if (!cellMap.has(row.module)) cellMap.set(row.module, new Map());
    cellMap.get(row.module)!.set(row.action, row);
  }

  const rows = moduleOrder.map((m) => ({
    module: m.module,
    modul_ad: m.modul_ad,
    cells: Object.fromEntries(cellMap.get(m.module) ?? []) as Record<string, CatalogRow>,
  }));

  return { rows, actions: actionOrder };
}

function ToggleRow({
  label, checked, onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2.5">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
