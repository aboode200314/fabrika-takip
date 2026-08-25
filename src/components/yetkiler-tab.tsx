import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck, Crown } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { PAGE_PERMISSIONS, ACTION_PERMISSIONS, DEFAULT_OPERATOR_PERMISSIONS } from "@/lib/permissions";

export function YetkilerTab() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState("");

  const { data: profiles } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,ad_soyad,personel_id").order("ad_soyad");
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

  const isSA = !!userId && (superAdmins ?? []).includes(userId);
  const effective = (perms?.length ? perms : DEFAULT_OPERATOR_PERMISSIONS) ?? [];

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
      const { error } = await supabase
        .from("user_permissions").delete().eq("user_id", userId).eq("permission", key);
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

  return (
    <div className="space-y-5 pt-4">
      <section className="rounded-2xl border bg-card p-5 shadow-industrial">
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Kullanıcı Seç</Label>
        <Select value={userId} onValueChange={setUserId}>
          <SelectTrigger className="tap-target mt-2 max-w-md"><SelectValue placeholder="Kullanıcı seçiniz" /></SelectTrigger>
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
            <Crown className="h-4 w-4" /> Bu hesap Ana Yönetici (Super Admin) — tüm yetkilere sınırsız sahiptir.
          </div>
        )}
      </section>

      {userId && !isSA && (
        <>
          <PermGroup
            title="SAYFA YETKİLERİ"
            items={PAGE_PERMISSIONS}
            active={effective}
            onToggle={togglePerm}
          />
          <PermGroup
            title="İŞLEM YETKİLERİ"
            items={ACTION_PERMISSIONS}
            active={effective}
            onToggle={togglePerm}
          />

          <section className="rounded-2xl border bg-card p-5 shadow-industrial">
            <h3 className="mb-1 font-display text-lg tracking-wide">MAKİNE YETKİLERİ</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Hiçbiri seçilmezse kullanıcı tüm makineleri görebilir.
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
            <h3 className="mb-1 font-display text-lg tracking-wide">ÜRÜN YETKİLERİ</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Hiçbiri seçilmezse kullanıcı tüm ürünleri görebilir.
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
        </>
      )}

      {!userId && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4" /> Yetkilerini düzenlemek için bir kullanıcı seçin.
        </p>
      )}
    </div>
  );
}

function PermGroup({
  title, items, active, onToggle,
}: {
  title: string;
  items: readonly { key: string; label: string }[];
  active: string[];
  onToggle: (key: string, on: boolean) => void;
}) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-industrial">
      <h3 className="mb-3 font-display text-lg tracking-wide">{title}</h3>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => (
          <ToggleRow
            key={i.key}
            label={i.label}
            checked={active.includes(i.key)}
            onChange={(v) => onToggle(i.key, v)}
          />
        ))}
      </div>
    </section>
  );
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
