## Progress Update - 2026-03-25

### Done
- Updated `README.md` with a full beginner-friendly documentation section.
- Added a complete project tree in a visual style similar to the requested image.
- Added a database structure tree in `README.md`.
- Added column data types (DataType) in the database tree section.
- Reorganized the database section for better readability (details/tables).
- Documented the purpose of each file currently موجود in the repository (frontend + backend + configs + assets).
- Fixed dev API URL selection in `api/config.ts` to respect `EXPO_PUBLIC_USE_API=true` (prevents Expo Go using a derived local URL).
- Added a place search bar on `app/(main)/map.tsx` to filter visible locations and highlight matching markers.
- Fixed `map.tsx` runtime crash by removing reliance on `useMemo` during place search filtering.
- Unified place type labels in UI (منزل/متجر تجاري/مجمّع سكني/مجمّع تجاري/أخرى) in `map.tsx` + `AddPlaceModal`.
- In `AddPlaceModal`: show selection labels as (المنازل/المتاجر/المجمعات السكنية/المجمعات التجارية/أخرى) and when choosing "منزل" display phone label as "رقم هاتف صاحب المنزل"، plus change "اسم المكان" و"صور" إلى "اسم المنزل" و"صور المنزل".
- Updated admin dashboard stat label from `أنواع الأماكن` to `أنواع المتاجر`.
- Improved type label normalization to support common plural/definite forms and diacritics so the correct options (المنازل/المتاجر/المجمعات...) show reliably in `AddPlaceModal`.
- In `AddPlaceModal`: dedupe + restrict type selection to the 5 canonical place types (house/store/commercialComplex/residentialComplex/other) with fixed UI order.
- Database: added `migrate-v6` to create extension tables for houses/stores/residential complexes/commercial complexes/other (`*_details` linked 1:1 to `places` via `place_id`).
- Backend/DB Sync: updated `places.service` to automatically sync `*_details` from `place_attributes + place_images`, and to upsert legacy `stores` (with `stores.id = places.id`) for `متجر تجاري` / `مجمّع تجاري` when `places.status=active` (keeps buying/services working).
- DB Utility: added `migrate-v7` to seed `categories` canonical rows + backfill existing `*_details` and legacy `stores`.
- Database: added `migrate-v8` to extend `store_products` with `main_category`, `sub_category`, and `company_name`.
- Backend/API + UI: updated store products endpoints + owner dashboard to let the owner set main/sub category + company and toggle `is_available` (controls what customers see).
- Admin workflow: updated `app/(main)/admin-stores.tsx` so admin can pick an owner when adding a store (calls `assignStoreOwner`).

### Notes
- Files referenced in workflow rules (`CYCLE.md`, `AGENTS.md`, `PLAN.md`, `agent.md`) were not found in this repository root at execution time.

### NEXT AGENT
- QA/Review Agent: verify the map screen loads without `useMemo` runtime errors and that place search filtering + marker highlight still work.
- QA/Review Agent: verify in `AddPlaceModal` that type selection shows only these 5 options (no duplicates) in the order: المنازل, المتاجر, المجمعات التجارية, المجمعات السكنية, أخرى.
- QA/Review Agent: verify in `AddPlaceModal` that selecting each type shows the fixed required fields (house/store/residential complex/commercial complex/other) and no phone/dynamic-attr UI appears.
- QA/Review Agent: verify when viewing a place on the map, the details panel displays the correct fixed fields from `place_attributes` (e.g. house_number/location_text/floors_count/per-floor JSON) and shows “خدمات المتجر” only for `متجر تجاري` + `مجمّع تجاري`.
- QA/Review Agent: verify DB sync: after creating/updating a place, the corresponding `*_details` row and (for active store-type) the legacy `stores` row with `stores.id = places.id` exist.
- QA/Review Agent: verify purchasing flow still works for `متجر تجاري` and `مجمّع تجاري` (orders use `store_products`/`store_id`).
- QA/Review Agent: verify DB extension tables exist after running `migrate:v6` and that no runtime/SQL errors appear due to schema changes.
- QA/Review Agent: verify stage 2 workflow end-to-end:
  - admin creates a store and assigns an owner via `admin-stores`
  - owner can add products with `main_category/sub_category/company_name`
  - owner can hide/show products via `is_available`
  - customers only see products when `is_available=true`

## Additional Update - 2026-03-25
### Done
- Fixed admin-stores button responsiveness by raising `storeActionRow`/`storeActionBtn` layering (`zIndex`) and improving delete confirmation error handling in `app/(main)/admin-stores.tsx`.

### NEXT AGENT
- QA/Review Agent: verify `تعديل` و`حذف` in `/(main)/admin-stores` respond on Web/Windows and that delete shows an alert on failure.
- QA/Review Agent: verify place type display labels render correctly in (1) store details pill, (2) category bar/bottom sheet, and (3) add place type selection.

### Update - 2026-03-25
- Backend: restrict `/api/place-types` to return only the fixed canonical types (منزل/متجر تجاري/مجمّع سكني/مجمّع تجاري/أخرى) and forbid create/update/remove for other types.
- Added `server/scripts/seed-place-types-constants.js` to insert/update the 5 canonical rows in `place_types`.
- Added optional `server/scripts/drop-unused-tables.js` (currently drops only `place_requests`), but it is not executed by default.

## Additional Update - 2026-03-25
### Done
- Admin dashboard: add a sixth stat card `أنواع الأماكن` that navigates to `/admin-categories`.
- Admin dashboard: make `أنواع المتاجر` count + list show only store-related place types by passing `filterKind=store` to `/admin-categories`.

### NEXT AGENT
- QA/Review Agent: verify admin dashboard cards (5->6) render correctly on Web/Windows, and that `أنواع المتاجر` does not show المنازل/المجمعات السكنية while `أنواع الأماكن` shows all types.

## Local dev setup fix - 2026-03-25
### Done
- Fixed backend port conflict (`EADDRINUSE`) by moving the API server to `PORT=3002` in `server/.env`.
- Updated Expo app env to point to the correct local API URL: `EXPO_PUBLIC_API_URL=http://localhost:3002`.
- Removed non-Expo server secrets/vars (`DATABASE_URL`, `JWT_SECRET`, `PORT`, etc.) from the root `.env` to avoid leaking them into the frontend bundler.
- Restarted Metro bundler on port `8081` to reload `.env`.

### NEXT AGENT
- QA/Review Agent: verify the app talks to the backend at `http://localhost:3002` (health endpoint + auth + places list).

## Local Postgres connection - 2026-03-25
### Done
- Switched backend `DATABASE_URL` in `server/.env` to local Postgres (`postgres@localhost:5432/tulkarm-map`) with password authentication.
- Updated migration script validation to allow localhost connection strings.
- Re-ran `npm run migrate:v1` successfully against local DB and started backend on `http://localhost:3002`.
- Restarted Expo Metro bundler so it reloads `.env` pointing to the local API.

### NEXT AGENT
- QA/Review Agent: verify CRUD flows (auth, create place, list places) using the local Postgres database.

## Product main/sub categories - 2026-03-25
### Done
- Added DB migration `V9` to create `product_main_categories` and `product_sub_categories`.
- Added backend CRUD endpoints:
  - `GET/POST/PATCH/DELETE /api/product-categories`
  - `GET/POST /api/product-categories/:id/subcategories`
  - `PATCH/DELETE /api/product-subcategories/:id`
- Added admin screens:
  - `/(main)/admin-main-categories` (إدارة التصنيفات الرئيسية) مع أزرار: تعديل/حذف/تصنيف فرعي
  - `/(main)/admin-sub-categories` لإدارة التصنيفات الفرعية
- Updated admin dashboard card to open “التصنيفات الرئيسية” and show the correct count.

### Update - 2026-03-25
- Extended product categories to support `emoji` and `arrow_color` (DB + backend + UI):
  - DB: updated `migrateV9` to add columns on `product_main_categories` and `product_sub_categories` (with `ADD COLUMN IF NOT EXISTS` for compatibility).
  - Backend: updated `productCategories.routes.js` to read/write `emoji` + `arrow_color`.
  - UI: updated admin screens to let admin set emoji + arrow color with presets + preview, and changed sort order input to be empty by default (so it doesn't show confusing `0`).

### NEXT AGENT
- QA/Review Agent: verify add/edit main/sub categories can save `emoji` + `arrow_color` and that they render in list cards.
- QA/Review Agent: verify `sort_order` works when left empty (defaults to 0) and sorting is correct.
- Integration Agent: connect owner product add/edit to pick main/sub from these lists instead of free text.

## Owner product category picker - 2026-03-25
### Done
- Updated `/(main)/owner-dashboard` product add modal to use dependent selection lists instead of free text.
- Main category now appears first and loads all store main categories from `/api/product-categories`.
- After selecting main category, sub-category selector appears and shows only items from `/api/product-categories/:id/subcategories`.
- Validation: main category is required; sub-category is required only when the selected main has sub-categories.

### NEXT AGENT
- QA/Review Agent: verify owner add-product flow on Web/Windows/mobile for main->sub dependent selection and correct validation.

## Admin stats breakdown - 2026-03-25
### Done
- Updated `/(main)/admin` stats cards to show published-place breakdown by type:
  - المنازل
  - المتاجر
  - المجمعات السكنية
  - المجمعات التجارية
  - أماكن أخرى
- Kept an additional card for `إجمالي الأماكن المنشورة`.
- Counts are derived from active places using `normalizePlaceTypeKind`.

### NEXT AGENT
- QA/Review Agent: verify admin dashboard type counts match active places and labels render correctly on Web/Windows.

## Update - 2026-03-30
### Done
- في `app/(main)/map.tsx` أصبح زر “الانتقال إلى المكان” يعمل حتى لو لم تكن الإحداثيات جاهزة، عبر طلب صلاحية الموقع عند الحاجة.
- يتم رسم مسار المشي ورقم “الأمتار المتبقية” (X م متبقية) وتحديثه مع تغير موقع المستخدم.

### NEXT AGENT
- QA/Review Agent: تأكد من أن زر “الانتقال إلى المكان” يرسم الخط ويعرض “X م متبقية” على Web/Windows، وأنه يظهر تنبيه مناسب عند فشل الحصول على الموقع.

## Update - 2026-03-30 (إضافة اختيار وسيلة الذهاب)
### Done
- عند الضغط على “الانتقال إلى المكان” يظهر اختيار لوسيلة الذهاب: `مشي` / `دراجة` / `سيارة`.
- بعد اختيار الوسيلة: يتم إخفاء واجهة التفاصيل (Sidebar + Category Bar + Store sheet) ويبدأ رسم الخط مع عرض `المدة الزمنية المتوقعة`.

## Update - 2026-03-30 (شاشة سلايدر 3 خطوات)
### Done
- تم استبدال `Alert` بخطوات واجهة داخل التطبيق (بدون تنبيهات): 
  - خطوة 1: صفحة تفاصيل المكان
  - خطوة 2: اختيار وسيلة الذهاب (4 خيارات: مشي/بسكليت/دراجة/سيارة)
  - خطوة 3: عرض موقعك + وجهتك + المسافة المتبقية والمدة، مع زرين `تأكيد` و `إلغاء`.
