import type { StockRow } from "./sac";

export interface ProfileStock extends StockRow {
  malzeme_turu: "profil" | "boru";
  yukseklik_mm: number | null;
  dis_cap_mm: number | null;
  ic_cap_mm: number | null;
}

export function isSawMachine(m?: { kod?: string | null; ad?: string | null } | null) {
  return /testere|trstere|tr[sş]tere|saw/i.test(`${m?.kod ?? ""} ${m?.ad ?? ""}`);
}

export function profileLabel(s: ProfileStock) {
  const size = s.malzeme_turu === "boru"
    ? `Ø${s.dis_cap_mm} / Ø${s.ic_cap_mm} × ${s.uzunluk_mm}`
    : `${s.genislik_mm} × ${s.yukseklik_mm} × ${s.uzunluk_mm} × ${s.kalinlik_mm}`;
  return `${s.sac_tipi} · ${size} mm`;
}