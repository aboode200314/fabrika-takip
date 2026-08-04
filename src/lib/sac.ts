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

/** Makine adı/kodundan CNC Plazma olup olmadığını anlar. */
export function isPlasmaMachine(m?: { kod?: string | null; ad?: string | null } | null) {
  if (!m) return false;
  const t = `${m.kod ?? ""} ${m.ad ?? ""}`.toLowerCase();
  return t.includes("plazma") || t.includes("plasma");
}
