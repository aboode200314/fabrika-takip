import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

const dtFmt = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
});

const TABLO_ADLARI: Record<string, string> = {
  products: "Ürünler",
  sheet_stock: "Sac Stok",
  sheet_stock_moves: "Stok Hareketleri",
  production_sessions: "Üretim Oturumları",
  plasma_cuts: "Plazma Kesimleri",
  profiles: "Kullanıcılar",
};
const ISLEM_ADLARI: Record<string, string> = {
  INSERT: "Ekleme", UPDATE: "Güncelleme", DELETE: "Silme",
};

interface AuditRow {
  id: string;
  actor_ad: string | null;
  tablo: string;
  kayit_id: string | null;
  islem: string;
  eski_veri: Record<string, unknown> | null;
  yeni_veri: Record<string, unknown> | null;
  degisen_alanlar: string[] | null;
  created_at: string;
}

export function DenetimKaydi({ kayitId }: { kayitId?: string }) {
  const [tablo, setTablo] = useState("hepsi");
  const [islem, setIslem] = useState("hepsi");
  const [ara, setAra] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["audit-logs", tablo, islem, kayitId],
    queryFn: async () => {
      let q = supabase
        .from("audit_logs")
        .select("id,actor_ad,tablo,kayit_id,islem,eski_veri,yeni_veri,degisen_alanlar,created_at")
        .order("created_at", { ascending: false })
        .limit(300);
      if (tablo !== "hepsi") q = q.eq("tablo", tablo);
      if (islem !== "hepsi") q = q.eq("islem", islem);
      if (kayitId) q = q.eq("kayit_id", kayitId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AuditRow[];
    },
  });

  const rows = (data ?? []).filter((r) => {
    if (!ara.trim()) return true;
    const s = ara.toLowerCase();
    return (r.actor_ad ?? "").toLowerCase().includes(s)
      || JSON.stringify(r.yeni_veri ?? r.eski_veri ?? {}).toLowerCase().includes(s);
  });

  return (
    <div className="space-y-4 pt-4">
      {!kayitId && (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Tablo</Label>
            <Select value={tablo} onValueChange={setTablo}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hepsi">Tümü</SelectItem>
                {Object.entries(TABLO_ADLARI).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">İşlem</Label>
            <Select value={islem} onValueChange={setIslem}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hepsi">Tümü</SelectItem>
                <SelectItem value="INSERT">Ekleme</SelectItem>
                <SelectItem value="UPDATE">Güncelleme</SelectItem>
                <SelectItem value="DELETE">Silme</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[200px] flex-1 space-y-1.5">
            <Label className="text-xs">Ara</Label>
            <Input value={ara} onChange={(e) => setAra(e.target.value)} placeholder="Kullanıcı veya değer…" />
          </div>
        </div>
      )}

      <div className="rounded-2xl border bg-card">
        <div className="flex items-center gap-2 border-b p-4">
          <History className="h-4 w-4 text-primary" />
          <span className="text-sm text-muted-foreground">
            Kim, ne zaman, neyi değiştirdi — kayıtlar değiştirilemez ve silinemez.
          </span>
        </div>
        {isLoading ? (
          <div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : error ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Denetim kaydını görme yetkiniz yok.</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Kayıt bulunamadı.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Kullanıcı</TableHead>
                  <TableHead>Tablo</TableHead>
                  <TableHead>İşlem</TableHead>
                  <TableHead>Değişiklik</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {dtFmt.format(new Date(r.created_at))}
                    </TableCell>
                    <TableCell className="text-xs">{r.actor_ad ?? "Sistem"}</TableCell>
                    <TableCell className="text-xs">{TABLO_ADLARI[r.tablo] ?? r.tablo}</TableCell>
                    <TableCell className="text-xs">{ISLEM_ADLARI[r.islem] ?? r.islem}</TableCell>
                    <TableCell className="text-xs">
                      <Degisiklik row={r} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

const GIZLI = new Set(["id", "created_at", "updated_at"]);

function Degisiklik({ row }: { row: AuditRow }) {
  const fmt = (v: unknown) =>
    v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);

  if (row.islem === "UPDATE") {
    const alanlar = (row.degisen_alanlar ?? []).filter((k) => !GIZLI.has(k));
    if (alanlar.length === 0) return <span className="text-muted-foreground">—</span>;
    return (
      <ul className="space-y-0.5">
        {alanlar.map((k) => (
          <li key={k}>
            <span className="font-mono text-muted-foreground">{k}</span>{": "}
            <span className="line-through opacity-60">{fmt(row.eski_veri?.[k])}</span>
            {" → "}
            <span className="font-medium">{fmt(row.yeni_veri?.[k])}</span>
          </li>
        ))}
      </ul>
    );
  }

  const veri = row.islem === "DELETE" ? row.eski_veri : row.yeni_veri;
  const alanlar = Object.keys(veri ?? {}).filter((k) => !GIZLI.has(k) && veri?.[k] !== null).slice(0, 6);
  return (
    <span className="text-muted-foreground">
      {alanlar.map((k) => `${k}: ${fmt(veri?.[k])}`).join(" · ") || "—"}
    </span>
  );
}
