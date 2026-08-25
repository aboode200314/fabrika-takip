GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_scope() TO authenticated;
GRANT EXECUTE ON FUNCTION public.machine_in_my_scope(uuid) TO authenticated;