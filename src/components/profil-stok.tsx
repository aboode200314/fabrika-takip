import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { profileLabel, type ProfileStock } from "@/lib/profile-stock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StokHareketleri } from "./stok-hareketleri";

const empty = { id: "", type: "profil", grade: "", width: "", height: "", length: "6000", thickness: "", outer: "", inner: "", quantity: "0", note: "" };
export function ProfilStok() {
  const t = useT();
  const { role, isSuperAdmin } = useAuth();
  const editable = isSuperAdmin || role === "supervisor";
  const qc = useQueryClient();
  const [draft, setDraft] = useState(empty);
  const [busy, setBusy] = useState(false);
  const { data: stocks = [], isLoading, error } = useQuery({
    queryKey: ["profile-stock"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sheet_stock").select("*").in("malzeme_turu", ["profil", "boru"]).order("sac_tipi");
      if (error) throw error;
      return data as ProfileStock[];
    },
    refetchInterval: 15000,
  });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const length = Number(draft.length), width = Number(draft.width), height = Number(draft.height), thickness = Number(draft.thickness), outer = Number(draft.outer), inner = Number(draft.inner), quantity = Number(draft.quantity);
    if (!draft.grade.trim() || !(length > 0) || !Number.isFinite(quantity) || quantity < 0 || (draft.type === "profil" ? !(width > 0 && height > 0 && thickness > 0 && thickness * 2 < Math.min(width, height)) : !(outer > inner && inner >= 0))) return toast.error(t("profil.invalid"));
    setBusy(true);
    const payload = { malzeme_turu: draft.type, sac_tipi: draft.grade.trim(), uzunluk_mm: length, genislik_mm: draft.type === "profil" ? width : outer, yukseklik_mm: draft.type === "profil" ? height : null, kalinlik_mm: draft.type === "profil" ? thickness : (outer - inner) / 2, dis_cap_mm: draft.type === "boru" ? outer : null, ic_cap_mm: draft.type === "boru" ? inner : null, notlar: draft.note.trim() || null };
    // Existing items keep their balance; quantity changes use the existing movement engine.
    const result = draft.id
      ? await supabase.from("sheet_stock").update(payload).eq("id", draft.id)
      : await supabase.from("sheet_stock").insert({ ...payload, adet: 0 }).select("id").single();
    if (result.error) { setBusy(false); return toast.error(result.error.message); }
    const id = draft.id || result.data?.id;
    if (!draft.id && quantity > 0 && id) {
      const { error } = await supabase.from("sheet_stock_moves").insert({ stock_id: id, degisim: quantity, tip: "manuel", sebep: t("stok.hareket.girisSebep1") });
      if (error) { setBusy(false); qc.invalidateQueries(); setDraft({ ...draft, id }); return toast.error(error.message); }
    }
    setBusy(false); setDraft(empty); qc.invalidateQueries(); toast.success(t("stok.success.guncellendi"));
  }
  const field = (key: keyof typeof empty, label: string) => <div className="space-y-1.5"><Label htmlFor={`profile-${key}`}>{t(label)}</Label><Input id={`profile-${key}`} type={key === "grade" || key === "note" ? "text" : "number"} min="0" step="any" required={key !== "note"} value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} /></div>;
  return <div className="space-y-4">
    {editable && <form onSubmit={save} className="space-y-3 rounded-lg border bg-card p-5">
      <h3 className="text-lg">{t(draft.id ? "common.edit" : "profil.new")}</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5"><Label>{t("profil.type")}</Label><Select value={draft.type} onValueChange={type => setDraft({ ...draft, type })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="profil">{t("profil.profile")}</SelectItem><SelectItem value="boru">{t("profil.pipe")}</SelectItem></SelectContent></Select></div>
        {field("grade", "profil.grade")}{field("length", "stok.uzunluk")}
        {draft.type === "profil" ? <>{field("width", "stok.genislik")}{field("height", "profil.height")}{field("thickness", "stok.kalinlik")}</> : <>{field("outer", "profil.outer")}{field("inner", "profil.inner")}</>}
        {!draft.id && field("quantity", "stok.adet")}{field("note", "stok.notOpsiyonel")}
      </div>
      <div className="flex gap-2"><Button disabled={busy} type="submit">{draft.id ? <Save /> : <Plus />}{t("common.save")}</Button>{draft.id && <Button variant="outline" type="button" onClick={() => setDraft(empty)}>{t("common.cancel")}</Button>}</div>
    </form>}
    {error && <p className="text-destructive">{error.message}</p>}
    <div className="overflow-x-auto rounded-lg border bg-card"><Table><TableHeader><TableRow><TableHead>{t("profil.type")}</TableHead><TableHead>{t("stok.table.olcu")}</TableHead><TableHead>{t("stok.table.mevcutAdet")}</TableHead><TableHead>{t("stok.table.not")}</TableHead><TableHead /></TableRow></TableHeader><TableBody>
      {stocks.map(s => <TableRow key={s.id}><TableCell>{t(s.malzeme_turu === "profil" ? "profil.profile" : "profil.pipe")}</TableCell><TableCell className="font-mono whitespace-nowrap">{profileLabel(s)}</TableCell><TableCell>{s.adet}</TableCell><TableCell>{s.notlar ?? "—"}</TableCell><TableCell>{editable && <Button variant="ghost" size="icon" title={t("common.edit")} onClick={() => setDraft({ id: s.id, type: s.malzeme_turu, grade: s.sac_tipi, width: String(s.genislik_mm), height: String(s.yukseklik_mm ?? ""), length: String(s.uzunluk_mm), thickness: String(s.kalinlik_mm), outer: String(s.dis_cap_mm ?? ""), inner: String(s.ic_cap_mm ?? ""), quantity: String(s.adet), note: s.notlar ?? "" })}><Pencil /></Button>}</TableCell></TableRow>)}
      {!stocks.length && <TableRow><TableCell colSpan={5}>{t(isLoading ? "common.loading" : "common.noData")}</TableCell></TableRow>}
    </TableBody></Table></div>
    <StokHareketleri material="profil" />
  </div>;
}