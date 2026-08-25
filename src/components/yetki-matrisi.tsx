import { Fragment, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Crown, Loader2, Plus, Shield, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { PERMISSION_MODULES, PERMISSION_ACTIONS, permissionEquivalents } from "@/lib/permissions";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";

interface Role { key: string; ad: string; aciklama: string | null; sira: number; sistem: boolean }
interface CatalogItem {
  key: string; module: string; action: string; modul_ad: string | null; islem_ad: string | null; sira: number; sistem: boolean;
}
interface RolePerm { role_key: string; permission: string }

export function YetkiMatrisi() {
  const t = useT();
  const qc = useQueryClient();
  const { isSuperAdmin, can } = useAuth();
  const canEdit = isSuperAdmin || can("permissions.manage");

  const [yeniModul, setYeniModul] = useState("");
  const [yeniIslem, setYeniIslem] = useState("");

  const { data: roles, isLoading: rolesLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("roles").select("key,ad,aciklama,sira,sistem").order("sira");
      if (error) throw error;
      return (data ?? []) as Role[];
    },
  });

  const { data: catalog, isLoading: catalogLoading } = useQuery({
    queryKey: ["permission-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase.from("permission_catalog").select("key,module,action,modul_ad,islem_ad,sira,sistem").order("sira");
      if (error) throw error;
      return (data ?? []) as CatalogItem[];
    },
  });

  const { data: rolePerms } = useQuery({
    queryKey: ["role-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("role_permissions").select("role_key,permission");
      if (error) throw error;
      return (data ?? []) as RolePerm[];
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<string, CatalogItem[]>();
    for (const item of catalog ?? []) {
      if (!map.has(item.module)) map.set(item.module, []);
      map.get(item.module)!.push(item);
    }
    return [...map.entries()];
  }, [catalog]);

  const hasPerm = (roleKey: string, permKey: string) => {
    const equivs = permissionEquivalents(permKey);
    return (rolePerms ?? []).some((r) => r.role_key === roleKey && equivs.includes(r.permission));
  };

  async function togglePerm(roleKey: string, permKey: string, on: boolean) {
    if (!canEdit) return toast.error(t("yon.rol.onlyAdmin"));
    if (on) {
      const { error } = await supabase.from("role_permissions").insert({ role_key: roleKey, permission: permKey });
      if (error && !error.message.includes("duplicate")) return toast.error(error.message);
    } else {
      const equivs = permissionEquivalents(permKey);
      const { error } = await supabase.from("role_permissions").delete()
        .eq("role_key", roleKey).in("permission", equivs);
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["role-permissions"] });
  }

  async function yeniYetkiEkle(e: React.FormEvent) {
    e.preventDefault();
    if (!yeniModul || !yeniIslem) return toast.error(t("yon.rol.modulIslemGerekli"));
    const key = `${yeniModul}.${yeniIslem}`;
    const modInfo = PERMISSION_MODULES.find((m) => m.key === yeniModul);
    const actInfo = PERMISSION_ACTIONS.find((a) => a.key === yeniIslem);
    const { error } = await supabase.from("permission_catalog").insert({
      key,
      module: yeniModul,
      action: yeniIslem,
      modul_ad: modInfo?.label ?? yeniModul,
      islem_ad: actInfo?.label ?? yeniIslem,
      sira: 900,
      sistem: false,
    });
    if (error) return toast.error(error.message.includes("duplicate") ? t("yon.rol.yetkiZatenVar") : error.message);
    setYeniModul(""); setYeniIslem("");
    toast.success(t("yon.rol.yetkiEklendi"));
    qc.invalidateQueries({ queryKey: ["permission-catalog"] });
  }

  if (rolesLoading || catalogLoading) {
    return <div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="mb-1 flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        <h3 className="font-display text-lg tracking-wide">{t("yon.rol.matrisTitle")}</h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">{t("yon.rol.matrisDesc")}</p>

      {!canEdit && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          <Crown className="h-4 w-4" /> {t("yon.rol.onlyAdminBanner")}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th className="sticky left-0 z-10 bg-muted/40 py-2 pl-3 pr-4 font-medium">{t("yon.rol.yetkiHeader")}</th>
              {roles?.map((r) => (
                <th key={r.key} className="px-2 py-2 text-center text-xs font-medium">{r.ad}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grouped.map(([moduleKey, items]) => {
              const modLabel = t(`yon.module.${moduleKey}`, items[0]?.modul_ad ?? moduleKey);
              return (
                <Fragment key={moduleKey}>
                  <tr className="border-b bg-muted/20">
                    <td colSpan={(roles?.length ?? 0) + 1} className="sticky left-0 z-10 bg-muted/20 py-1.5 pl-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {modLabel}
                    </td>
                  </tr>
                  {items.map((item) => {
                    const actionLabel = t(`yon.action.${item.action}`, item.islem_ad ?? item.action);
                    return (
                      <tr key={item.key} className="border-b last:border-0 hover:bg-muted/10">
                        <td className="sticky left-0 z-10 bg-card py-2 pl-3 pr-4">
                          <span className="text-sm">{actionLabel}</span>
                        </td>
                        {roles?.map((r) => {
                          const sabit = r.key === "super_admin";
                          return (
                            <td key={r.key} className="px-2 py-2 text-center">
                              <Switch
                                checked={sabit || hasPerm(r.key, item.key)}
                                disabled={!canEdit || sabit}
                                onCheckedChange={(v) => togglePerm(r.key, item.key, v)}
                                aria-label={`${r.ad} — ${modLabel} — ${actionLabel}`}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <form onSubmit={yeniYetkiEkle} className="mt-4 flex flex-wrap items-end gap-2 border-t pt-4">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("yon.rol.yeniYetkiModul")}</Label>
            <Select value={yeniModul} onValueChange={setYeniModul}>
              <SelectTrigger className="tap-target w-48"><SelectValue placeholder={t("yon.rol.modulSec")} /></SelectTrigger>
              <SelectContent>
                {PERMISSION_MODULES.map((m) => (
                  <SelectItem key={m.key} value={m.key}>{t(`yon.module.${m.key}`, m.label)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("yon.rol.yeniYetkiIslem")}</Label>
            <Select value={yeniIslem} onValueChange={setYeniIslem}>
              <SelectTrigger className="tap-target w-48"><SelectValue placeholder={t("yon.rol.islemSec")} /></SelectTrigger>
              <SelectContent>
                {PERMISSION_ACTIONS.map((a) => (
                  <SelectItem key={a.key} value={a.key}>{t(`yon.action.${a.key}`, a.label)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" variant="outline" className="gap-1"><Plus className="h-4 w-4" /> {t("yon.rol.yeniYetkiEkle")}</Button>
        </form>
      )}
    </section>
  );
}

export function RolYonetimi() {
  const t = useT();
  const qc = useQueryClient();
  const { isSuperAdmin, can } = useAuth();
  const canEdit = isSuperAdmin || can("permissions.manage");

  const [yeniKod, setYeniKod] = useState("");
  const [yeniAd, setYeniAd] = useState("");
  const [yeniAciklama, setYeniAciklama] = useState("");
  const [yeniSira, setYeniSira] = useState("200");
  const [duzenlenenRol, setDuzenlenenRol] = useState<string | null>(null);
  const [duzenlenenAciklama, setDuzenlenenAciklama] = useState("");

  const { data: roles } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("roles").select("key,ad,aciklama,sira,sistem").order("sira");
      if (error) throw error;
      return (data ?? []) as Role[];
    },
  });

  function slugify(s: string) {
    return s
      .trim()
      .toLowerCase()
      .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  async function rolEkle(e: React.FormEvent) {
    e.preventDefault();
    const key = yeniKod.trim() ? slugify(yeniKod) : slugify(yeniAd);
    if (!key || !yeniAd.trim()) return toast.error(t("yon.rol.kodAdGerekli"));
    const { error } = await supabase.from("roles").insert({
      key, ad: yeniAd.trim(), aciklama: yeniAciklama.trim() || null, sira: Number(yeniSira) || 200,
    });
    if (error) return toast.error(error.message);
    setYeniKod(""); setYeniAd(""); setYeniAciklama(""); setYeniSira("200");
    toast.success(t("yon.rol.eklendi"));
    qc.invalidateQueries({ queryKey: ["roles"] });
  }

  async function aciklamaGuncelle(key: string) {
    const { error } = await supabase.from("roles").update({ aciklama: duzenlenenAciklama.trim() || null }).eq("key", key);
    if (error) return toast.error(error.message);
    setDuzenlenenRol(null);
    toast.success(t("yon.rol.guncellendi"));
    qc.invalidateQueries({ queryKey: ["roles"] });
  }

  async function rolSil(r: Role) {
    if (!confirm(t("yon.rol.rolSilConfirm").replace("{ad}", r.ad))) return;
    const { error } = await supabase.from("roles").delete().eq("key", r.key);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["roles"] });
    qc.invalidateQueries({ queryKey: ["role-assignments"] });
  }

  if (!canEdit) return null;

  return (
    <section className="rounded-2xl border bg-card p-5">
      <h3 className="mb-3 font-display text-lg tracking-wide">{t("yon.rol.yeniRol")}</h3>
      <form onSubmit={rolEkle} className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">{t("yon.rol.rolKodu")}</Label>
          <Input value={yeniKod} onChange={(e) => setYeniKod(e.target.value)} placeholder={t("yon.rol.kodPh")} className="w-44" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("yon.rol.rolAdi")}</Label>
          <Input value={yeniAd} onChange={(e) => setYeniAd(e.target.value)} placeholder={t("yon.rol.adPh")} className="w-56" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("yon.th.aciklama")}</Label>
          <Input value={yeniAciklama} onChange={(e) => setYeniAciklama(e.target.value)} placeholder={t("yon.rol.aciklamaPh")} className="w-56" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("yon.rol.sira")}</Label>
          <Input type="number" value={yeniSira} onChange={(e) => setYeniSira(e.target.value)} className="w-20" />
        </div>
        <Button type="submit" className="gap-1"><Plus className="h-4 w-4" /> {t("yon.mk.ekle")}</Button>
      </form>

      <div className="mt-4 space-y-2">
        {roles?.filter((r) => !r.sistem).map((r) => (
          <div key={r.key} className="flex flex-wrap items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
            <span className="font-medium">{r.ad}</span>
            <span className="text-[11px] text-muted-foreground">({r.key})</span>
            {duzenlenenRol === r.key ? (
              <>
                <Input
                  value={duzenlenenAciklama}
                  onChange={(e) => setDuzenlenenAciklama(e.target.value)}
                  className="h-7 w-56 text-xs"
                  placeholder={t("yon.th.aciklama")}
                />
                <Button size="sm" variant="outline" className="h-7" onClick={() => aciklamaGuncelle(r.key)}>{t("yon.mk.ekle")}</Button>
                <Button size="sm" variant="ghost" className="h-7" onClick={() => setDuzenlenenRol(null)}>{t("yon.uy.vazgec")}</Button>
              </>
            ) : (
              <>
                <span className="flex-1 text-xs text-muted-foreground">{r.aciklama}</span>
                <button
                  className="text-xs text-primary underline-offset-2 hover:underline"
                  onClick={() => { setDuzenlenenRol(r.key); setDuzenlenenAciklama(r.aciklama ?? ""); }}
                >
                  {t("yon.uy.duzenleTitle")}
                </button>
              </>
            )}
            <button
              aria-label={t("yon.rol.rolSil").replace("{ad}", r.ad)}
              onClick={() => rolSil(r)}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
