import { Globe } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LANGUAGES, useI18n, type Lang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export function LanguageSwitcher({ variant = "default" }: { variant?: "default" | "sidebar" }) {
  const { lang, setLang, t } = useI18n();
  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  async function pick(code: Lang) {
    setLang(code);
    // Oturum varsa dil tercihi kullanıcı profiline yazılır
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await supabase.from("profiles").update({ dil: code }).eq("id", data.user.id);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("lang.title")}
        className={`tap-target inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          variant === "sidebar"
            ? "opacity-80 hover:bg-white/10 hover:opacity-100"
            : "border border-border bg-background hover:bg-accent"
        }`}
      >
        <Globe className="h-4 w-4" />
        <span className="uppercase">{current.code}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Globe className="h-3.5 w-3.5" /> {t("lang.title")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LANGUAGES.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => void pick(l.code)}
            className={l.code === lang ? "font-semibold text-primary" : ""}
          >
            <span className="me-2">{l.flag}</span>
            {l.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
