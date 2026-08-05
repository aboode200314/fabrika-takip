export const SAC_TIPLERI = [
  { ad: "DKP", yogunluk: 7.85 },
  { ad: "S235 / ST37 (Siyah Sac)", yogunluk: 7.85 },
  { ad: "S355 (Yüksek Mukavemetli)", yogunluk: 7.85 },
  { ad: "Galvaniz", yogunluk: 7.85 },
  { ad: "Paslanmaz 304", yogunluk: 7.9 },
  { ad: "Paslanmaz 316", yogunluk: 8.0 },
  { ad: "Alüminyum", yogunluk: 2.7 },
  { ad: "Diğer", yogunluk: 7.85 },
];

/** Makine adı/kodundan CNC Plazma olup olmadığını anlar (yazım hatalarına toleranslı). */
export function isPlasmaMachine(m?: { kod?: string | null; ad?: string | null } | null) {
  if (!m) return false;
  const raw = `${m.kod ?? ""} ${m.ad ?? ""}`
    .toLowerCase()
    .replace(/i̇/g, "i")
    .replace(/[^a-z0-9]/g, "");
  // plazma, plasma, palzma, palsma, plazm, plasm gibi varyasyonlar
  if (/(pla[zs]m|pal[zs]m|plzm|plsm)/.test(raw)) return true;
  // harf sırası karışık yazımlar için: p,l,a,z/s,m harflerinin tümü varsa
  const compact = raw.replace(/[^plazsm]/g, "");
  return /p/.test(compact) && /l/.test(compact) && /a/.test(compact) && /[zs]/.test(compact) && /m/.test(compact) && raw.includes("cnc");
}


export interface StockRow {
  id: string;
  sac_tipi: string;
  kalinlik_mm: number;
  uzunluk_mm: number;
  genislik_mm: number;
  adet: number;
  kritik_adet: number;
  yogunluk: number;
  notlar: string | null;
}

/** Tek levhanın kg cinsinden ağırlığı. */
export function levhaKg(r: Pick<StockRow, "uzunluk_mm" | "genislik_mm" | "kalinlik_mm" | "yogunluk">) {
  return (Number(r.uzunluk_mm) * Number(r.genislik_mm) * Number(r.kalinlik_mm) * Number(r.yogunluk)) / 1_000_000;
}
