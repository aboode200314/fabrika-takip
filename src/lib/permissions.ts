export const PAGE_PERMISSIONS = [
  { key: "page.panel", label: "Ana Panel (Canlı Üretim)" },
  { key: "page.raporlar", label: "Raporlar" },
  { key: "page.yonetim", label: "Yönetim" },
  { key: "page.kullanicilar", label: "Kullanıcı Yönetimi" },
  { key: "page.ayarlar", label: "Sistem Ayarları (Vardiya/Mola)" },
  { key: "page.stok", label: "Stok" },
  { key: "page.denetim", label: "Denetim Kaydı (Audit Log)" },
] as const;


export const ACTION_PERMISSIONS = [
  { key: "kayit.ekle", label: "Ekleme" },
  { key: "kayit.duzenle", label: "Düzenleme" },
  { key: "kayit.sil", label: "Silme" },
  { key: "rapor.yazdir", label: "Yazdırma" },
  { key: "rapor.disaaktar", label: "Dışa Aktarma" },
  { key: "kayit.onayla", label: "Onaylama" },
  { key: "kayit.iptal", label: "İptal Etme" },
  { key: "urun.duzenle", label: "Ürün Tanımı Düzenleme" },
  { key: "stok.giris", label: "Stok Girişi" },
  { key: "stok.cikis", label: "Stok Çıkışı" },
  { key: "stok.duzelt", label: "Stok Hareketi Düzeltme" },
] as const;

export const ALL_PERMISSIONS = [...PAGE_PERMISSIONS, ...ACTION_PERMISSIONS];

export const PERMISSION_LABELS: Record<string, string> = Object.fromEntries(
  ALL_PERMISSIONS.map((p) => [p.key, p.label]),
);

/** Hiç özel yetki tanımlanmamış operatörler için varsayılan yetkiler. */
export const DEFAULT_OPERATOR_PERMISSIONS = [
  "page.panel",
  "page.raporlar",
  "kayit.ekle",
];

export const WEEKDAYS = [
  { gun: 1, ad: "Pazartesi" },
  { gun: 2, ad: "Salı" },
  { gun: 3, ad: "Çarşamba" },
  { gun: 4, ad: "Perşembe" },
  { gun: 5, ad: "Cuma" },
  { gun: 6, ad: "Cumartesi" },
  { gun: 0, ad: "Pazar" },
] as const;

export type PermissionKey = (typeof ALL_PERMISSIONS)[number]["key"] | (string & {});
