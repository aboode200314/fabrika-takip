import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Crown, Loader2, Plus, Shield, Trash2, UserCog } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { ALL_PERMISSIONS, PAGE_PERMISSIONS, ACTION_PERMISSIONS } from "@/lib/permissions";
import { useAuth } from "@/lib/auth";

interface Role { key: string; ad: string; aciklama: string | null; sira: number; sistem: boolean }

export function RollerTab() {
  const qc = useQueryClient();
  const { isSuperAdmin, refresh } = useAuth();
  const [yeniKod, setYeniKod] = useState("");
  const [yeniAd, setYeniAd] = useState("");
  const [seciliUser, setSeciliUser] = useState("");

  const { data: roles, isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("roles").select("key,ad,aciklama,sira,sistem").order("sira");
      if (error) throw error;
      return (data ?? []) as Role[];
    },
  });

  const { data: rolePerms } = useQuery({
    queryKey: ["role-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("role_permissions").select("role_key,permission");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,ad_soyad,personel_id").order("ad_soyad");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: assigns } = useQuery({
    queryKey: ["role-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_role_assignments").select("id,user_id,role_key");
      if (error) throw error;
      return data ?? [];
    },
  });

  const hasPerm = (roleKey: string, perm: string) =>
    (rolePerms ?? []).some((r) => r.role_key === roleKey && r.permission === perm);

  async function togglePerm(roleKey: string, perm: string, on: boolean) {
    if (!isSuperAdmin) return toast.error("Rol yetkilerini yalnızca Ana Yönetici değiştirebilir");
    if (on) {
      const { error } = await supabase.from("role_permissions").insert({ role_key: roleKey, permission: perm });
      if (error && !error.message.includes("duplicate")) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("role_permissions").delete()
        .eq("role_key", roleKey).eq("permission", perm);
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["role-permissions"] });
  }

  async function rolEkle(e: React.FormEvent) {
    e.preventDefault();
    const key = yeniKod.trim().toLowerCase().replace(/\s+/g, "_");
    if (!key || !yeniAd.trim()) return toast.error("Rol kodu ve adı gerekli");
    const { error } = await supabase.from("roles").insert({ key, ad: yeniAd.trim(), sira: 200 });
    if (error) return toast.error(error.message);
    setYeniKod(""); setYeniAd(""); toast.success("Rol eklendi");
    qc.invalidateQueries({ queryKey: ["roles"] });
  }

  async function toggleAssign(userId: string, roleKey: string, on: boolean) {
    if (on) {
      const { error } = await supabase.from("user_role_assignments").insert({ user_id: userId, role_key: roleKey });
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("user_role_assignments").delete()
        .eq("user_id", userId).eq("role_key", roleKey);
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["role-assignments"] });
    await refresh();
  }

  if (isLoading) {
    return <div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const userRoles = (userId: string) => (assigns ?? []).filter((a) => a.user_id === userId).map((a) => a.role_key);

  return (
    <div className="space-y-5 pt-4">
      {!isSuperAdmin && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          <Crown className="h-4 w-4" /> Rol yetki matrisini yalnızca Ana Yönetici düzenleyebilir.
        </div>
      )}

      <section className="rounded-2xl border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <UserCog className="h-5 w-5 text-primary" />
          <h3 className="font-display text-lg tracking-wide">KULLANICI ROLLERİ</h3>
        </div>
        <Select value={seciliUser} onValueChange={setSeciliUser}>
          <SelectTrigger className="tap-target max-w-md"><SelectValue placeholder="Kullanıcı seçiniz" /></SelectTrigger>
          <SelectContent>
            {profiles?.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.ad_soyad ?? p.personel_id} ({p.personel_id})</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {seciliUser && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {roles?.map((r) => {
              const atali = userRoles(seciliUser).includes(r.key);
              const kilitli = r.key === "super_admin" && !isSuperAdmin;
              return (
                <label
                  key={r.key}
                  className={`flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2.5 ${kilitli ? "opacity-50" : ""}`}
                >
                  <span className="text-sm">
                    {r.ad}
                    {r.aciklama && <span className="block text-[11px] text-muted-foreground">{r.aciklama}</span>}
                  </span>
                  <Switch
                    checked={atali}
                    disabled={kilitli}
                    onCheckedChange={(v) => toggleAssign(seciliUser, r.key, v)}
                  />
                </label>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <div className="mb-1 flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h3 className="font-display text-lg tracking-wide">ROL YETKİ MATRİSİ</h3>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Yetkiler role bağlanır; kullanıcı bir rol aldığında o rolün tüm yetkilerini kazanır.
          Kişiye özel ek yetkiler "Yetkiler" sekmesinden verilir.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4 font-medium">Yetki</th>
                {roles?.map((r) => (
                  <th key={r.key} className="px-2 py-2 text-center text-xs font-medium">{r.ad}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={(roles?.length ?? 0) + 1} className="pt-3 text-[11px] uppercase tracking-widest text-muted-foreground">Sayfalar</td></tr>
              {PAGE_PERMISSIONS.map((p) => (
                <PermRow key={p.key} perm={p} roles={roles ?? []} hasPerm={hasPerm} onToggle={togglePerm} disabled={!isSuperAdmin} />
              ))}
              <tr><td colSpan={(roles?.length ?? 0) + 1} className="pt-3 text-[11px] uppercase tracking-widest text-muted-foreground">İşlemler</td></tr>
              {ACTION_PERMISSIONS.map((p) => (
                <PermRow key={p.key} perm={p} roles={roles ?? []} hasPerm={hasPerm} onToggle={togglePerm} disabled={!isSuperAdmin} />
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Ana Yönetici rolü her zaman tüm yetkilere sahiptir ({ALL_PERMISSIONS.length} yetki).
        </p>
      </section>

      {isSuperAdmin && (
        <section className="rounded-2xl border bg-card p-5">
          <h3 className="mb-3 font-display text-lg tracking-wide">YENİ ROL</h3>
          <form onSubmit={rolEkle} className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Rol Kodu</Label>
              <Input value={yeniKod} onChange={(e) => setYeniKod(e.target.value)} placeholder="kalite_sefi" className="w-44" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Rol Adı</Label>
              <Input value={yeniAd} onChange={(e) => setYeniAd(e.target.value)} placeholder="Kalite Şefi" className="w-56" />
            </div>
            <Button type="submit" className="gap-1"><Plus className="h-4 w-4" /> Ekle</Button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            {roles?.filter((r) => !r.sistem).map((r) => (
              <div key={r.key} className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
                {r.ad}
                <button
                  aria-label={`${r.ad} rolünü sil`}
                  onClick={async () => {
                    if (!confirm(`${r.ad} rolü silinsin mi?`)) return;
                    const { error } = await supabase.from("roles").delete().eq("key", r.key);
                    if (error) return toast.error(error.message);
                    qc.invalidateQueries({ queryKey: ["roles"] });
                    qc.invalidateQueries({ queryKey: ["role-assignments"] });
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PermRow({
  perm, roles, hasPerm, onToggle, disabled,
}: {
  perm: { key: string; label: string };
  roles: Role[];
  hasPerm: (roleKey: string, perm: string) => boolean;
  onToggle: (roleKey: string, perm: string, on: boolean) => void;
  disabled: boolean;
}) {
  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pr-4">{perm.label}</td>
      {roles.map((r) => {
        const sabit = r.key === "super_admin";
        return (
          <td key={r.key} className="px-2 py-2 text-center">
            <Switch
              checked={sabit || hasPerm(r.key, perm.key)}
              disabled={disabled || sabit}
              onCheckedChange={(v) => onToggle(r.key, perm.key, v)}
              aria-label={`${r.ad} — ${perm.label}`}
            />
          </td>
        );
      })}
    </tr>
  );
}
