import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { panelDict } from "@/lib/i18n-dicts/panel";
import { makinelerDict } from "@/lib/i18n-dicts/makineler";
import { raporlarDict } from "@/lib/i18n-dicts/raporlar";
import { yonetimDict } from "@/lib/i18n-dicts/yonetim";
import { stokDict } from "@/lib/i18n-dicts/stok";

export type Lang = "tr" | "en" | "ar";

export const LANGUAGES: { code: Lang; label: string; flag: string; dir: "ltr" | "rtl" }[] = [
  { code: "tr", label: "Türkçe", flag: "🇹🇷", dir: "ltr" },
  { code: "en", label: "English", flag: "🇬🇧", dir: "ltr" },
  { code: "ar", label: "العربية", flag: "🇸🇦", dir: "rtl" },
];

const STORAGE_KEY = "gvn.lang";

type Dict = Record<string, string>;

const tr: Dict = {
  "app.title": "ÜRETİM TAKİP SİSTEMİ",
  "app.subtitle": "OEE · Makine performansı · Sac stok",
  "app.section": "Üretim",

  "nav.panel": "Panel",
  "nav.machines": "Makineler",
  "nav.reports": "Raporlar",
  "nav.management": "Yönetim",

  "role.supervisor": "Süpervizör",
  "role.operator": "Operatör",
  "role.superAdmin": "Ana Yönetici",

  "auth.signOut": "Çıkış",
  "auth.signIn": "Giriş Yap",
  "auth.personelId": "Personel ID",
  "auth.password": "Şifre",
  "auth.personelIdPlaceholder": "örn. op001",
  "auth.loginFailed": "Giriş başarısız",
  "auth.loginSuccess": "Giriş başarılı",
  "auth.personelIdRequired": "Personel ID gerekli",
  "auth.passwordMin": "Şifre en az 6 karakter",
  "auth.noAccountNote":
    "Yeni hesaplar yalnızca yönetici tarafından Yönetim → Kullanıcılar bölümünden oluşturulur. Hesabınız yoksa yöneticinize başvurun.",
  "auth.footer": "GVN Trailer · Endüstriyel tablet ve telefon için tasarlandı.",

  "lang.title": "Dil",
  "lang.changed": "Dil değiştirildi",

  "common.save": "Kaydet",
  "common.cancel": "İptal",
  "common.delete": "Sil",
  "common.edit": "Düzenle",
  "common.add": "Ekle",
  "common.search": "Ara",
  "common.filter": "Filtre",
  "common.loading": "Yükleniyor…",
  "common.noData": "Kayıt bulunamadı",
  "common.retry": "Tekrar dene",
  "common.home": "Ana sayfa",
  "common.export": "Dışa aktar",
  "common.print": "Yazdır",
  "common.active": "Aktif",
  "common.inactive": "Pasif",

  "error.notFoundTitle": "Sayfa bulunamadı",
  "error.notFoundBody": "Aradığınız sayfa mevcut değil veya taşınmış olabilir.",
  "error.notFoundBack": "Ana sayfaya dön",
  "error.pageTitle": "Bu sayfa yüklenemedi",
  "error.pageBody": "Bir şeyler ters gitti. Yenilemeyi veya ana sayfaya dönmeyi deneyin.",
};

const en: Dict = {
  "app.title": "PRODUCTION TRACKING SYSTEM",
  "app.subtitle": "OEE · Machine performance · Sheet stock",
  "app.section": "Production",

  "nav.panel": "Dashboard",
  "nav.machines": "Machines",
  "nav.reports": "Reports",
  "nav.management": "Management",

  "role.supervisor": "Supervisor",
  "role.operator": "Operator",
  "role.superAdmin": "Super Admin",

  "auth.signOut": "Sign out",
  "auth.signIn": "Sign in",
  "auth.personelId": "Employee ID",
  "auth.password": "Password",
  "auth.personelIdPlaceholder": "e.g. op001",
  "auth.loginFailed": "Sign-in failed",
  "auth.loginSuccess": "Signed in",
  "auth.personelIdRequired": "Employee ID is required",
  "auth.passwordMin": "Password must be at least 6 characters",
  "auth.noAccountNote":
    "New accounts are created only by an administrator under Management → Users. Contact your administrator if you don't have an account.",
  "auth.footer": "GVN Trailer · Designed for industrial tablets and phones.",

  "lang.title": "Language",
  "lang.changed": "Language changed",

  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.add": "Add",
  "common.search": "Search",
  "common.filter": "Filter",
  "common.loading": "Loading…",
  "common.noData": "No records found",
  "common.retry": "Try again",
  "common.home": "Home",
  "common.export": "Export",
  "common.print": "Print",
  "common.active": "Active",
  "common.inactive": "Inactive",

  "error.notFoundTitle": "Page not found",
  "error.notFoundBody": "The page you are looking for doesn't exist or has moved.",
  "error.notFoundBack": "Back to home",
  "error.pageTitle": "This page could not be loaded",
  "error.pageBody": "Something went wrong. Try refreshing or going back home.",
};

const ar: Dict = {
  "app.title": "نظام متابعة الإنتاج",
  "app.subtitle": "OEE · أداء الماكينات · مخزون الصاج",
  "app.section": "الإنتاج",

  "nav.panel": "لوحة التحكم",
  "nav.machines": "الماكينات",
  "nav.reports": "التقارير",
  "nav.management": "الإدارة",

  "role.supervisor": "مشرف",
  "role.operator": "عامل",
  "role.superAdmin": "المدير العام",

  "auth.signOut": "خروج",
  "auth.signIn": "تسجيل الدخول",
  "auth.personelId": "رقم الموظف",
  "auth.password": "كلمة المرور",
  "auth.personelIdPlaceholder": "مثال: op001",
  "auth.loginFailed": "فشل تسجيل الدخول",
  "auth.loginSuccess": "تم تسجيل الدخول",
  "auth.personelIdRequired": "رقم الموظف مطلوب",
  "auth.passwordMin": "كلمة المرور 6 أحرف على الأقل",
  "auth.noAccountNote":
    "الحسابات الجديدة تُنشأ من قبل المدير فقط من الإدارة → المستخدمون. تواصل مع المدير إذا لم يكن لديك حساب.",
  "auth.footer": "GVN Trailer · مصمم للأجهزة اللوحية والهواتف الصناعية.",

  "lang.title": "اللغة",
  "lang.changed": "تم تغيير اللغة",

  "common.save": "حفظ",
  "common.cancel": "إلغاء",
  "common.delete": "حذف",
  "common.edit": "تعديل",
  "common.add": "إضافة",
  "common.search": "بحث",
  "common.filter": "تصفية",
  "common.loading": "جارٍ التحميل…",
  "common.noData": "لا توجد سجلات",
  "common.retry": "إعادة المحاولة",
  "common.home": "الرئيسية",
  "common.export": "تصدير",
  "common.print": "طباعة",
  "common.active": "نشط",
  "common.inactive": "غير نشط",

  "error.notFoundTitle": "الصفحة غير موجودة",
  "error.notFoundBody": "الصفحة التي تبحث عنها غير موجودة أو تم نقلها.",
  "error.notFoundBack": "العودة إلى الرئيسية",
  "error.pageTitle": "تعذر تحميل هذه الصفحة",
  "error.pageBody": "حدث خطأ ما. جرّب التحديث أو العودة إلى الصفحة الرئيسية.",
};

const NAMESPACES = [panelDict, makinelerDict, raporlarDict, yonetimDict, stokDict];

const DICTS: Record<Lang, Dict> = {
  tr: Object.assign({}, tr, ...NAMESPACES.map((n) => n.tr)),
  en: Object.assign({}, en, ...NAMESPACES.map((n) => n.en)),
  ar: Object.assign({}, ar, ...NAMESPACES.map((n) => n.ar)),
};

interface I18nState {
  lang: Lang;
  dir: "ltr" | "rtl";
  setLang: (l: Lang) => void;
  t: (key: string, fallback?: string) => string;
}

const I18nContext = createContext<I18nState | undefined>(undefined);

function readStored(): Lang {
  if (typeof window === "undefined") return "tr";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "tr" || v === "en" || v === "ar" ? v : "tr";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("tr");

  useEffect(() => {
    setLangState(readStored());
  }, []);

  const dir: "ltr" | "rtl" = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const t = useCallback(
    (key: string, fallback?: string) => DICTS[lang][key] ?? DICTS.tr[key] ?? fallback ?? key,
    [lang],
  );

  const value = useMemo(() => ({ lang, dir, setLang, t }), [lang, dir, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}

/** Kısayol: sadece çeviri fonksiyonu. */
export function useT() {
  return useI18n().t;
}
