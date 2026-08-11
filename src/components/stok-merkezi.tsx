import { Layers } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StokTab } from "@/components/stok-tab";
import { StokHareketleri } from "@/components/stok-hareketleri";

/** Sac stoğu ve stok hareketleri tek merkezde: bakiye + giriş/çıkış geçmişi. */
export function StokMerkezi() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          <h3 className="text-lg">Sac Stok Merkezi</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Stok kalemleri kalıcı tanımdır; her giriş/çıkış hareket kaydı olarak saklanır ve hareket sonrası bakiye
          korunur. Hatalı hareket silinmez — "Ters kayıt" ile düzeltilir, böylece geçmiş izlenebilir kalır.
        </p>
      </div>

      <Tabs defaultValue="bakiye" className="space-y-4">
        <TabsList>
          <TabsTrigger value="bakiye">Stok Bakiyesi</TabsTrigger>
          <TabsTrigger value="hareketler">Giriş / Çıkış Hareketleri</TabsTrigger>
        </TabsList>
        <TabsContent value="bakiye"><StokTab /></TabsContent>
        <TabsContent value="hareketler"><StokHareketleri /></TabsContent>
      </Tabs>
    </div>
  );
}
