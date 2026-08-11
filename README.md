# Üretim Pusulası

✅ FINAL ENHANCED PROMPT (Turkish MES / OEE System)

Build a professional factory OEE (Overall Equipment Effectiveness) and lightweight MES web application for small and medium manufacturing companies.

The application must be fully in Turkish language (UI, labels, buttons, forms, dashboards, messages).

The system will be used by machine operators and production supervisors in factories.

It must be mobile-first, fast, simple, and optimized for industrial environments (glove-friendly, minimal clicks).

🎯 Main Goal

The application collects production data, downtime events, quality reports, and production step progress from operators.

All data is sent to n8n via configurable webhooks.

n8n processes the data and updates an Excel-based OEE dashboard automatically.

The system is not only an OEE tracker, but also a Production Tracking / MES light system.

👥 User Roles

Operatör (Operator)

Can:

 Giriş yapma

 Makine seçme

 Ürün seçme

 Operasyon seçme

 Üretim verisi girme

 Duruş bildirme

 Kalite hatası bildirme

Süpervizör (Supervisor)

Can:

 Tüm kayıtları görüntüleme

 Makine durumlarını izleme

 Üretim ilerlemesini takip etme

 Operatör performansını analiz etme

 Kayıtları düzenleme

🔐 Giriş Sayfası

Modern login screen in Turkish.

Fields:

 Personel ID

 Şifre

After login redirect:

 Operatör → Ana Panel

 Süpervizör → Yönetim Paneli

🏭 Ana Panel (Operatör)

Large touch-friendly buttons:

 Üretim Girişi

 Duruş Bildirimi

 Kalite Raporu

Design:

 Modern endüstriyel UI

 Dark / Light mode

 Tablet-friendly factory usage

🔥 NEW CORE FEATURE: Üretim Operasyon Takibi (Production Routing)

Each product has a production routing (operations flow).

Example:

Ürün: Mutfak Dolabı

Operations:

 Kesim (Cutting)

 Kenar Bantlama (Edge Banding)

 Delme (Drilling)

 Montaj (Assembly)

 Kapak Montajı (Door Installation)

 Final Kontrol (Final Inspection)

 Paketleme (Packaging)

Ürün: Masa

Operations:

 Kesim

 Delme

 Montaj

 Paketleme

👷 Operator Experience (IMPORTANT CHANGE)

Instead of only selecting product + quantity, the operator must select:

 Makine (Machine)

 Ürün (Product)

 Operasyon (Operation Dropdown based on product routing)

 Vardiya (Shift)

 Üretim Miktarı

 Red Miktarı (optional in production screen or separate quality screen)

📊 Production Logic

Each operation is tracked separately per product.

Example:

Order: 100 units Kitchen Cabinet

 Cutting → 100 completed

 Assembly → 70 completed

 Door Installation → 40 completed

 Packaging → 20 completed

System calculates:

 Progress per operation (%)

 Remaining work per stage

 Total completion status per product

📦 OPTIONAL CONCEPT (NOT REQUIRED FOR MVP)

Work Order System:

Example:

 WO-2026-001

 Product: Kitchen Cabinet

 Quantity: 100

Operators would select Work Order instead of product.

⚠️ BUT FOR MVP:
Do NOT include Work Orders to keep system simple.

🏭 Production Entry Form (OPERATÖR)

Fields (ALL IN TURKISH UI):

 Makine (Dropdown)

 Ürün (Dropdown)

 Operasyon (Dropdown - dynamic based on product routing)

 Operatör (Auto-filled)

 Vardiya:

 Sabah

 Akşam

 Gece

 Üretim Miktarı

 Gönder butonu

Submit → Send JSON to n8n webhook

⛔ Duruş Bildirimi (Downtime Report)

Fields:

 Makine

 Operatör

 Vardiya

 Duruş Kategorisi:

 Mekanik

 Elektrik

 Kurulum

 Malzeme

 Kalite

 Operatör

 Diğer

 Duruş Süresi (Dakika)

 Notlar

Submit → webhook (n8n)

🔍 Kalite Raporu

Fields:

 Makine

 Ürün

 Operatör

 Vardiya

 Red Miktarı

 Notlar

Submit → webhook

📊 Süpervizör Paneli (Yönetim Paneli)

Show:

 Toplam Üretim

 Toplam Duruş Süresi

 Toplam Fire

 Makine Durumları

 Son Aktiviteler

 Operatör Performansı

 Vardiya Performansı

 Ürün bazlı üretim ilerlemesi (NEW STRONG FEATURE)

🧩 Master Data Management

Makineler

 Makine Kodu

 Makine Adı

 Aktif/Pasif

Ürünler

 Ürün Kodu

 Ürün Adı

 İdeal Çevrim Süresi

 Üretim Routing (Operations list)

Operatörler

 Operatör ID

 Ad Soyad

 Departman

Duruş Nedenleri

 Kategori Adı

🔗 n8n INTEGRATION

All forms must send structured JSON to configurable webhook URLs.

Webhook Settings:

 Üretim Webhook URL

 Duruş Webhook URL

 Kalite Webhook URL

Example payload:

{
  "operator": "OP-001",
  "machine": "M-01",
  "product": "Mutfak Dolabı",
  "operation": "Montaj",
  "shift": "Sabah",
  "quantity": 50,
  "timestamp": "2026-06-24T10:00:00Z"
}

🎨 DESIGN REQUIREMENTS

 Full Turkish UI

 Industrial modern design

 Large buttons (glove-friendly)

 Minimal clicks

 Fast data entry

 Dark & Light Mode

 Tablet-first factory usage

 Clear progress indicators

⚙️ TECHNICAL REQUIREMENTS

Build full system:

Frontend:

 Responsive UI

 Role-based dashboards

 Turkish localization

Backend:

 Authentication system

 Role management

 API endpoints

 Webhook integration

Database:

 Users

 Machines

 Products (with routing)

 Production logs per operation

 Downtime logs

 Quality logs

🚀 FUTURE READY FEATURES

System must be structured for future expansion:

 Real-time OEE dashboard

 Live machine monitoring

 IoT / PLC integration

 QR code scanning for operations

 Inventory system

 ERP integration

 Odoo integration

 Predictive maintenance

 Full MES system evolution

🧠 FINAL VISION

This system is a lightweight but powerful MES/OEE hybrid system that enables:

 Production tracking per operation

 Real-time efficiency monitoring

 Downtime and quality tracking

 Full integration with n8n automation

 Excel-based reporting system

It is designed to be simple enough for small factories but scalable into a full MES platform.

بدي منك تعملي هاد التطبيق بناء على هاد الشرح

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://fabrika-takip.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6e0d542a-d24a-4c94-8cf7-b94ea4d7672f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
