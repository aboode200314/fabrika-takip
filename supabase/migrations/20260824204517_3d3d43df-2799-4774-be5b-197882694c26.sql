-- 1. Revoke EXECUTE on internal / trigger SECURITY DEFINER functions from API roles
REVOKE ALL ON FUNCTION public.audit_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.production_sessions_snapshot() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sheet_stock_moves_apply() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sheet_stock_moves_snapshot() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.work_breaks_validate() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sheet_stock_apply() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sheet_stock_restore() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.plasma_cuts_validate() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.production_sessions_calc() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.session_pauses_calc() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- 2. Helper functions used by the app: signed-in users only, never anonymous
REVOKE ALL ON FUNCTION public.has_app_role(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.live_pauses() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.live_sessions() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_department_ids() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_permissions() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.net_work_minutes(smallint) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_app_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.live_pauses() TO authenticated;
GRANT EXECUTE ON FUNCTION public.live_sessions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_department_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.net_work_minutes(smallint) TO authenticated;

-- 3. audit_logs: explicit immutability for app roles
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM anon, authenticated;
REVOKE ALL ON public.audit_logs FROM anon;
DROP POLICY IF EXISTS audit_logs_no_insert ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_no_update ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_no_delete ON public.audit_logs;
CREATE POLICY audit_logs_no_insert ON public.audit_logs FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY audit_logs_no_update ON public.audit_logs FOR UPDATE TO anon, authenticated USING (false);
CREATE POLICY audit_logs_no_delete ON public.audit_logs FOR DELETE TO anon, authenticated USING (false);

-- 4. sheet_stock_moves: append-only, explicit deny on update/delete
REVOKE UPDATE, DELETE ON public.sheet_stock_moves FROM anon, authenticated;
REVOKE ALL ON public.sheet_stock_moves FROM anon;
DROP POLICY IF EXISTS sheet_stock_moves_no_update ON public.sheet_stock_moves;
DROP POLICY IF EXISTS sheet_stock_moves_no_delete ON public.sheet_stock_moves;
CREATE POLICY sheet_stock_moves_no_update ON public.sheet_stock_moves FOR UPDATE TO anon, authenticated USING (false);
CREATE POLICY sheet_stock_moves_no_delete ON public.sheet_stock_moves FOR DELETE TO anon, authenticated USING (false);

-- 5. webhook_settings: super admin only, explicit policies
REVOKE ALL ON public.webhook_settings FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_settings TO authenticated;
GRANT ALL ON public.webhook_settings TO service_role;
ALTER TABLE public.webhook_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS webhook_settings_admin_read ON public.webhook_settings;
DROP POLICY IF EXISTS webhook_settings_admin_write ON public.webhook_settings;
CREATE POLICY webhook_settings_admin_read ON public.webhook_settings FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY webhook_settings_admin_write ON public.webhook_settings FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));