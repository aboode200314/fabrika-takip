export const PAGE_PERMISSIONS = [
  { key: "page.panel", label: "Ana Panel (Canlı)" },
  { key: "page.uretim", label: "Üretim" },
  { key: "page.durus", label: "Duruş" },
  { key: "page.kalite", label: "Kalite" },
  { key: "page.raporlar", label: "Raporlar" },
  { key: "page.yonetim", label: "Yönetim" },
  { key: "page.kullanicilar", label: "Kullanıcı Yönetimi" },
  { key: "page.ayarlar", label: "Sistem Ayarları" },
  { key: "page.stok", label: "Stok" },
] as const;


export const ACTION_PERMISSIONS = [
  { key: "kayit.ekle", label: "Ekleme" },
  { key: "kayit.duzenle", label: "Düzenleme" },
  { key: "kayit.sil", label: "Silme" },
  { key: "rapor.yazdir", label: "Yazdırma" },
  { key: "rapor.disaaktar", label: "Dışa Aktarma" },
  { key: "kayit.onayla", label: "Onaylama" },
  { key: "kayit.iptal", label: "İptal Etme" },
] as const;

export const ALL_PERMISSIONS = [...PAGE_PERMISSIONS, ...ACTION_PERMISSIONS];

/** Hiç özel yetki tanımlanmamış operatörler için varsayılan yetkiler. */
export const DEFAULT_OPERATOR_PERMISSIONS = [
  "page.panel",
  "page.uretim",
  "page.durus",
  "page.kalite",
  "page.raporlar",
  "kayit.ekle",
];


export type PermissionKey = (typeof ALL_PERMISSIONS)[number]["key"] | (string & {});
