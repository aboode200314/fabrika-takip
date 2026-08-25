import { Layers } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StokTab } from "@/components/stok-tab";
import { StokHareketleri } from "@/components/stok-hareketleri";
import { useT } from "@/lib/i18n";

/** Sac stoğu ve stok hareketleri tek merkezde: bakiye + giriş/çıkış geçmişi. */
export function StokMerkezi() {
  const t = useT();
  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          <h3 className="text-lg">{t("stok.merkezi.title")}</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("stok.merkezi.desc")}
        </p>
      </div>

      <Tabs defaultValue="bakiye" className="space-y-4">
        <TabsList>
          <TabsTrigger value="bakiye">{t("stok.tab.bakiye")}</TabsTrigger>
          <TabsTrigger value="hareketler">{t("stok.tab.hareketler")}</TabsTrigger>
        </TabsList>
        <TabsContent value="bakiye"><StokTab /></TabsContent>
        <TabsContent value="hareketler"><StokHareketleri /></TabsContent>
      </Tabs>
    </div>
  );
}
