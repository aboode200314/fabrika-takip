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

/* =========================================================================
 * MERKEZİ YETKİ MODELİ (Modül × İşlem)
 * Veritabanı: public.permission_catalog + public.permission_aliases
 * ========================================================================= */

export const PERMISSION_MODULES = [
  { key: "dashboard", label: "Panel" },
  { key: "production", label: "Üretim" },
  { key: "machines", label: "Makineler" },
  { key: "products", label: "Ürünler" },
  { key: "flow", label: "Üretim Akışı" },
  { key: "downtime", label: "Duruş" },
  { key: "quality", label: "Kalite" },
  { key: "oee", label: "OEE" },
  { key: "inventory", label: "Stok" },
  { key: "purchasing", label: "Satın Alma" },
  { key: "reports", label: "Raporlar" },
  { key: "users", label: "Kullanıcılar" },
  { key: "permissions", label: "Yetkiler" },
  { key: "settings", label: "Ayarlar" },
  { key: "audit", label: "Denetim" },
] as const;

export const PERMISSION_ACTIONS = [
  { key: "view", label: "Görüntüle" },
  { key: "create", label: "Ekle" },
  { key: "edit", label: "Düzenle" },
  { key: "delete", label: "Sil" },
  { key: "approve", label: "Onayla" },
  { key: "cancel", label: "İptal" },
  { key: "consume", label: "Çıkış" },
  { key: "export", label: "Dışa Aktar" },
  { key: "print", label: "Yazdır" },
  { key: "manage", label: "Yönet" },
] as const;

/** Eski anahtar -> yeni (modül.işlem) anahtarı. DB'deki permission_aliases ile birebir aynı. */
export const PERMISSION_ALIASES: Record<string, string> = {
  "page.panel": "dashboard.view",
  "page.raporlar": "reports.view",
  "page.yonetim": "settings.view",
  "page.kullanicilar": "users.view",
  "page.ayarlar": "settings.manage",
  "page.stok": "inventory.view",
  "page.denetim": "audit.view",
  "page.uretim": "production.view",
  "page.canli": "dashboard.view",
  "page.durus": "downtime.view",
  "page.kalite": "quality.view",
  "kayit.ekle": "production.create",
  "kayit.duzenle": "production.edit",
  "kayit.sil": "production.delete",
  "kayit.onayla": "production.approve",
  "kayit.iptal": "production.cancel",
  "rapor.yazdir": "reports.print",
  "rapor.disaaktar": "reports.export",
  "urun.duzenle": "products.edit",
  "stok.giris": "inventory.create",
  "stok.cikis": "inventory.consume",
  "stok.duzelt": "inventory.edit",
};

/** Bir yetki anahtarının tüm eşdeğerleri (eski + yeni). */
export function permissionEquivalents(perm: string): string[] {
  const set = new Set<string>([perm]);
  const canonical = PERMISSION_ALIASES[perm];
  if (canonical) set.add(canonical);
  for (const [alias, canon] of Object.entries(PERMISSION_ALIASES)) {
    if (canon === perm) set.add(alias);
  }
  return [...set];
}

/** Kullanıcının yetki listesini eski/yeni karşılıklarıyla genişletir. */
export function expandPermissions(perms: string[]): string[] {
  const out = new Set<string>();
  for (const p of perms) for (const e of permissionEquivalents(p)) out.add(e);
  return [...out];
}

/** Veri kapsamı seçenekleri (profiles.veri_kapsam). */
export const DATA_SCOPES = [
  { key: "own", label: "Yalnızca kendi kayıtları" },
  { key: "department", label: "Departmanı / üretim hattı" },
  { key: "all", label: "Tüm fabrika" },
] as const;
export type DataScope = (typeof DATA_SCOPES)[number]["key"];
