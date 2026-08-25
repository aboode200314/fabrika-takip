REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.permission_equivalents(text) FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.my_scope() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.machine_in_my_scope(uuid) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.permission_equivalents(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.my_scope() TO service_role;
GRANT EXECUTE ON FUNCTION public.machine_in_my_scope(uuid) TO service_role;