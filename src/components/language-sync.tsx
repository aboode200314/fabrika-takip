import { useEffect, useRef } from "react";

import { useAuth } from "@/lib/auth";
import { useI18n, type Lang } from "@/lib/i18n";

/**
 * Kullanıcı giriş yaptığında profilinde kayıtlı dili uygular.
 * Dil değişikliği LanguageSwitcher tarafından profile yazılır.
 */
export function LanguageSync() {
  const { profile } = useAuth();
  const { lang, setLang } = useI18n();
  const applied = useRef<string | null>(null);

  useEffect(() => {
    const dil = profile?.dil;
    if (!dil || !["tr", "en", "ar"].includes(dil)) return;
    if (applied.current === profile.id) return;
    applied.current = profile.id;
    if (dil !== lang) setLang(dil as Lang);
  }, [profile?.id, profile?.dil, lang, setLang]);

  return null;
}
