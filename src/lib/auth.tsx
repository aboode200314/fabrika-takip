import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function personelIdToEmail(personelId: string): string {
  return `${personelId.trim().toLowerCase()}@fabrika.local`;
}

async function loadProfileAndRole(userId: string) {
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  let role: AppRole = "operator";
  if (roles?.some((r) => r.role === "supervisor")) role = "supervisor";
  return { profile: (profile as ProfileData | null) ?? null, role };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const hydrate = async (sess: Session | null) => {
    setSession(sess);
    setUser(sess?.user ?? null);
    if (sess?.user) {
      const { profile, role } = await loadProfileAndRole(sess.user.id);
      setProfile(profile);
      setRole(role);
    } else {
      setProfile(null);
      setRole(null);
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

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
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
