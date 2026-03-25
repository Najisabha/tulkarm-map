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
