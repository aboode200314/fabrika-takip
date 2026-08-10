import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_OPERATOR_PERMISSIONS } from "@/lib/permissions";

export type AppRole = "operator" | "supervisor";

export interface ProfileData {
  id: string;
  personel_id: string;
  ad_soyad: string;
  departman: string | null;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: ProfileData | null;
  role: AppRole | null;
  /** Atanmış rol anahtarları (super_admin, admin, supervisor, worker, …) */
  roleKeys: string[];
  isSuperAdmin: boolean;
  permissions: string[];
  can: (perm: string) => boolean;
  hasRoleKey: (key: string) => boolean;
  /** null => tüm makineler serbest */
  allowedMachineIds: string[] | null;
  /** null => tüm ürünler serbest */
  allowedProductIds: string[] | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function personelIdToEmail(personelId: string): string {
  return `${personelId.trim().toLowerCase()}@fabrika.local`;
}

async function loadProfileAndRole(userId: string) {
  const [{ data: profile }, { data: roles }, { data: sa }, { data: perms }, { data: ums }, { data: ups }, { data: assigns }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("super_admins").select("user_id").eq("user_id", userId).maybeSingle(),
      supabase.from("user_permissions").select("permission").eq("user_id", userId),
      supabase.from("user_machines").select("machine_id").eq("user_id", userId),
      supabase.from("user_products").select("product_id").eq("user_id", userId),
      supabase.from("user_role_assignments").select("role_key").eq("user_id", userId),
    ]);

  const roleKeys = (assigns ?? []).map((r) => r.role_key);
  const { data: rolePerms } = roleKeys.length
    ? await supabase.from("role_permissions").select("permission").in("role_key", roleKeys)
    : { data: [] as { permission: string }[] };

  let role: AppRole = "operator";
  if (roles?.some((r) => r.role === "supervisor")) role = "supervisor";
  const isSuperAdmin = !!sa || roleKeys.includes("super_admin");
  if (roleKeys.includes("admin") || roleKeys.includes("supervisor")) role = "supervisor";

  const explicit = (perms ?? []).map((p) => p.permission);
  const fromRoles = (rolePerms ?? []).map((p) => p.permission);
  const merged = Array.from(new Set([...explicit, ...fromRoles]));
  const permissions = merged.length > 0 ? merged : DEFAULT_OPERATOR_PERMISSIONS;

  return {
    profile: (profile as ProfileData | null) ?? null,
    role,
    roleKeys,
    isSuperAdmin,
    permissions,
    allowedMachineIds: (ums ?? []).length > 0 ? (ums ?? []).map((m) => m.machine_id) : null,
    allowedProductIds: (ups ?? []).length > 0 ? (ups ?? []).map((p) => p.product_id) : null,
  };
}


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [roleKeys, setRoleKeys] = useState<string[]>([]);
  const [allowedMachineIds, setAllowedMachineIds] = useState<string[] | null>(null);
  const [allowedProductIds, setAllowedProductIds] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  const hydrate = async (sess: Session | null) => {
    setSession(sess);
    setUser(sess?.user ?? null);
    if (sess?.user) {
      const r = await loadProfileAndRole(sess.user.id);
      setProfile(r.profile);
      setRole(r.role);
      setRoleKeys(r.roleKeys);
      setIsSuperAdmin(r.isSuperAdmin);
      setPermissions(r.permissions);
      setAllowedMachineIds(r.isSuperAdmin ? null : r.allowedMachineIds);
      setAllowedProductIds(r.isSuperAdmin ? null : r.allowedProductIds);
    } else {
      setProfile(null);
      setRole(null);
      setRoleKeys([]);
      setIsSuperAdmin(false);
      setPermissions([]);
      setAllowedMachineIds(null);
      setAllowedProductIds(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      // defer to avoid deadlocks
      setTimeout(() => void hydrate(sess), 0);
    });
    void supabase.auth.getSession().then(({ data }) => hydrate(data.session));
    return () => sub.subscription.unsubscribe();
  }, []);

  const can = (perm: string) =>
    isSuperAdmin || role === "supervisor" || permissions.includes(perm);
  const hasRoleKey = (key: string) => isSuperAdmin || roleKeys.includes(key);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        roleKeys,
        isSuperAdmin,
        permissions,
        can,
        hasRoleKey,

        allowedMachineIds,
        allowedProductIds,
        loading,
        refresh: async () => {
          const { data } = await supabase.auth.getSession();
          await hydrate(data.session);
        },
        signOut: async () => {
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
