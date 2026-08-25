import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, UserCog } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { YetkiMatrisi, RolYonetimi } from "@/components/yetki-matrisi";

interface Role { key: string; ad: string; aciklama: string | null; sira: number; sistem: boolean }

export function RollerTab() {
  const t = useT();
  const qc = useQueryClient();
  const { refresh } = useAuth();
  const [seciliUser, setSeciliUser] = useState("");

  const { data: roles, isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("roles").select("key,ad,aciklama,sira,sistem").order("sira");
      if (error) throw error;
      return (data ?? []) as Role[];
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
      <section className="rounded-2xl border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <UserCog className="h-5 w-5 text-primary" />
          <h3 className="font-display text-lg tracking-wide">{t("yon.rol.kullaniciRolleri")}</h3>
        </div>
        <Select value={seciliUser} onValueChange={setSeciliUser}>
          <SelectTrigger className="tap-target max-w-md"><SelectValue placeholder={t("yon.rol.kullaniciSec")} /></SelectTrigger>
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
              return (
                <label
                  key={r.key}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2.5"
                >
                  <span className="text-sm">
                    {r.ad}
                    {r.aciklama && <span className="block text-[11px] text-muted-foreground">{r.aciklama}</span>}
                  </span>
                  <Switch
                    checked={atali}
                    onCheckedChange={(v) => toggleAssign(seciliUser, r.key, v)}
                  />
                </label>
              );
            })}
          </div>
        )}
      </section>

      <YetkiMatrisi />

      <RolYonetimi />
    </div>
  );
}
