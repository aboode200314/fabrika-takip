import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CreateSchema = z.object({
  personel_id: z.string().trim().min(1),
  ad_soyad: z.string().trim().min(1),
  departman: z.string().trim().optional().nullable(),
  unvan: z.string().trim().optional().nullable(),
  password: z.string().min(6),
  role: z.enum(["operator", "supervisor"]).default("operator"),
});


export const createWorkerAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // verify caller is supervisor
    const { data: isSup } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "supervisor",
    });
    if (!isSup) throw new Response("Forbidden", { status: 403 });

    const personelId = data.personel_id.trim().toLowerCase();
    const email = `${personelId}@fabrika.local`;

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        personel_id: personelId,
        ad_soyad: data.ad_soyad,
        departman: data.departman ?? null,
      },
    });
    if (error || !created.user) throw new Response(error?.message ?? "Hata", { status: 400 });

    await supabaseAdmin
      .from("profiles")
      .update({ unvan: data.unvan ?? null, departman: data.departman ?? null })
      .eq("id", created.user.id);

    if (data.role === "supervisor") {
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: created.user.id, role: "supervisor" });
    }
    return { id: created.user.id };
  });

export const setWorkerTitle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ user_id: z.string().uuid(), unvan: z.string().trim().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isSup } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "supervisor",
    });
    if (!isSup) throw new Response("Forbidden", { status: 403 });
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ unvan: data.unvan || null })
      .eq("id", data.user_id);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });


export const deleteWorkerAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isSup } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "supervisor",
    });
    if (!isSup) throw new Response("Forbidden", { status: 403 });
    if (data.user_id === context.userId) throw new Response("Kendinizi silemezsiniz", { status: 400 });
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

export const listWorkers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isSup } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "supervisor",
    });
    if (!isSup) throw new Response("Forbidden", { status: 403 });

    const [{ data: profiles }, { data: roles }] = await Promise.all([
      context.supabase.from("profiles").select("id,personel_id,ad_soyad,departman,unvan,created_at").order("created_at", { ascending: false }),
      context.supabase.from("user_roles").select("user_id,role"),
    ]);
    const roleMap = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    }
    return (profiles ?? []).map((p) => ({ ...p, roles: roleMap.get(p.id) ?? [] }));
  });

export const setWorkerRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    user_id: z.string().uuid(),
    supervisor: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isSup } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "supervisor",
    });
    if (!isSup) throw new Response("Forbidden", { status: 403 });
    if (data.supervisor) {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.user_id, role: "supervisor" }, { onConflict: "user_id,role" });
    } else {
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.user_id)
        .eq("role", "supervisor");
    }
    return { ok: true };
  });

export const resetWorkerPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ user_id: z.string().uuid(), password: z.string().min(6) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isSup } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "supervisor",
    });
    if (!isSup) throw new Response("Forbidden", { status: 403 });
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.password,
    });
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

export const changeOwnPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ password: z.string().min(6) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      password: data.password,
    });
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });
