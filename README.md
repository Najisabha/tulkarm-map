# طولكرم — دليل مدينة طولكرم على الخريطة

تطبيق خريطة تفاعلية لمدينة طولكرم لاستكشاف الأماكن، البيوت، المحلات التجارية، والمجمعات السكنية والتجارية. يعمل على **Expo / React Native** ويدعم **الموبايل والويب**. الخادم مبني على **Node.js + Express + PostgreSQL** مع **JWT** للمصادقة و**Cloudinary** لرفع الصور.

---

## جدول المحتويات

### للبدء بسرعة
- [نسخة سريعة (5 خطوات)](#نسخة-سريعة-5-خطوات)
- [البدء السريع (واجهة فقط)](#البدء-السريع-واجهة-فقط)
- [إعداد الخادم (Backend)](#إعداد-الخادم-backend)
- [Google Maps API و Leaflet](#google-maps-api-و-leaflet)

### التشغيل والنشر
- [هجرات قاعدة البيانات](#هجرات-قاعدة-البيانات)
- [نسخ احتياطي لقاعدة البيانات](#نسخ-احتياطي-لقاعدة-البيانات)
- [نشر على Vercel](#نشر-على-vercel)

### فهم النظام
- [نظرة عامة تقنية](#نظرة-عامة-تقنية)
- [هيكل الـ API](#هيكل-الـ-api)
- [نماذج البيانات](#نماذج-البيانات)
- [مخطط قاعدة البيانات](#مخطط-قاعدة-البيانات)
- [التصنيفات الشجرية والمجمعات](#التصنيفات-الشجرية-والمجمعات)
- [صلاحيات الأطراف](#صلاحيات-الأطراف)
- [التوجيه (Routing)](#التوجيه-routing)
- [هيكل الملفات](#هيكل-الملفات)
- [سير عمل إضافة مكان](#سير-عمل-إضافة-مكان)
- [مصادر إضافية](#مصادر-إضافية)

---

## نسخة سريعة (5 خطوات)

### المشروع باختصار

- **الواجهة:** Expo + React Native + TypeScript (موبايل + ويب).
- **الخادم:** Node.js + Express (ESM).
- **قاعدة البيانات:** PostgreSQL (Neon في الإنتاج).
- **المصادقة:** JWT (Access قصير + Refresh مخزّن في DB كـ hash).
- **رفع الصور:** Cloudinary.
- **الخريطة:** Google Maps على iOS/Android، وعلى الويب يدعم Google Maps أو Leaflet كبديل.

### التشغيل في 5 خطوات

```bash
# 1) تثبيت الواجهة
npm install

# 2) تثبيت الخادم
cd server && npm install && cd ..

# 3) إنشاء ملفات البيئة
copy .env.example .env                 # Windows
copy server\.env.example server\.env

# 4) تطبيق المخطط على PostgreSQL
cd server && npm run migrate && cd ..

# 5) تشغيل الخادم والواجهة في طرفيتين منفصلتين
cd server && npm run dev               # الطرفية 1: الخادم على :3000
npx expo start                         # الطرفية 2: Expo
```

### أهم متغيرات البيئة

**في `server/.env`** (انظر [`server/src/config/env.js`](server/src/config/env.js)):

```env
DATABASE_URL=postgresql://postgres:PASSWORD@localhost:5432/tulkarm-map
PORT=3000
JWT_SECRET=سر-طويل-عشوائي
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY_DAYS=30
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CORS_ORIGIN=*
NODE_ENV=development
```

**في `.env`** بجذر المشروع (انظر [`.env.example`](.env.example) و[`api/config.ts`](api/config.ts)):

```env
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_USE_API=true
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=...
# اختياري
# EXPO_PUBLIC_API_PORT=3000
# EXPO_PUBLIC_FORCE_LEAFLET_MAP=true
```

> إذا كان `EXPO_PUBLIC_API_URL` يشير إلى نطاق جبهة فقط (مثل `vercel.app`) أثناء التطوير، يستنتج التطبيق عنوان الـ API تلقائياً من مضيف Metro (نفس IP حاسوبك) عبر [`api/config.ts`](api/config.ts).

---

## البدء السريع (واجهة فقط)

```bash
npm install
npx expo start
```

من المخرجات يمكنك فتح التطبيق عبر:

- [Development build](https://docs.expo.dev/develop/development-builds/introduction/).
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/).
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/).
- [Expo Go](https://expo.dev/go).
- الويب عبر `npx expo start --web`.

> لتشغيل التطبيق ببيانات حقيقية يجب إعداد الخادم وقاعدة البيانات أولاً.

---

## إعداد الخادم (Backend)

### 1) تثبيت الاعتماديات

```bash
cd server
npm install
```

### 2) إعداد متغيّرات البيئة

```bash
copy .env.example .env   # Windows
cp .env.example .env     # Mac/Linux
```

ثم عدّل `server/.env` بقيم محلية صحيحة (DATABASE_URL، JWT، Cloudinary).

### 3) تطبيق المخطط

```bash
npm run migrate
```

سكربت [`server/scripts/migrate-v1.js`](server/scripts/migrate-v1.js) **idempotent**: ينشئ الجداول والامتدادات والمؤشرات إن لم تكن موجودة، ويُنشئ حساب مدير افتراضي إذا لم يكن في القاعدة.

> يمكن تشغيل نفس الأمر من جذر المشروع أيضاً:
>
> ```bash
> npm run migrate
> ```

#### حساب المدير الافتراضي

عند أول تشغيل للهجرة، يُنشئ السكربت حساب مدير وفق متغيرات البيئة:

| المتغير | الافتراضي |
|---------|----------|
| `ADMIN_EMAIL` | `admin@system.local` |
| `ADMIN_PASSWORD` | `ChangeMe123!` |

> غيّر `ADMIN_PASSWORD` فوراً في الإنتاج.

### 4) تشغيل الخادم

```bash
npm start          # تشغيل عادي
npm run dev        # وضع المراقبة (--watch)
```

عند النجاح يجب أن ترى رسائل من نوع: `DB connected` و `Server listening on port 3000`، وفحص صحة الخادم متاح على `GET /api/health`.

### 5) ربط التطبيق بالخادم

في `.env` بجذر المشروع:

```env
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_WEB_KEY
```

> - **Android Emulator:** استخدم `http://10.0.2.2:3000`.
> - **جهاز فعلي على نفس الشبكة:** استخدم IP حاسوبك مثل `http://192.168.1.5:3000`.

---

## Google Maps API و Leaflet

التطبيق يستخدم Google Maps على الموبايل (`react-native-maps`)، وعلى الويب يستخدم [`@react-google-maps/api`](https://www.npmjs.com/package/@react-google-maps/api) أو [`react-leaflet`](https://react-leaflet.js.org/) كبديل آمن — انظر [`components/MapWrapper/index.web.tsx`](components/MapWrapper/index.web.tsx).

1. أنشئ مشروعاً في [Google Cloud](https://console.cloud.google.com) وفعّل:
   - Maps SDK for Android.
   - Maps SDK for iOS.
   - Maps JavaScript API (للويب).
2. أنشئ مفاتيح API من Credentials.
3. في `app.json` استبدل `YOUR_ANDROID_GOOGLE_MAPS_API_KEY` و`YOUR_IOS_GOOGLE_MAPS_API_KEY`.
4. في `.env` بالجذر ضع: `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=...`.
5. أعد تشغيل Expo بعد أي تعديل على `.env`.

### استخدام Leaflet كبديل (للويب)

إذا واجهت رسالة "This page didn't load Google Maps correctly"، يمكنك التبديل إلى Leaflet دون مفاتيح:

```env
EXPO_PUBLIC_FORCE_LEAFLET_MAP=true
```

### استكشاف خطأ Google Maps

1. **تفعيل الفوترة:** يجب ربط مشروع Google Cloud بحساب فوترة فعّال.
2. **Maps JavaScript API:** تأكد من تفعيلها من [مكتبة Google APIs](https://console.cloud.google.com/apis/library).
3. **HTTP referrers:** أضف `http://localhost:*` و`http://127.0.0.1:*` للمفتاح أثناء التطوير.

---

## هجرات قاعدة البيانات

| الأمر (من `server/`) | الوصف |
|---------------------|-------|
| `npm run migrate` | تطبيق المخطط الكامل (Idempotent) + إصلاح FK قديم في `reports` + Seed (المدير الافتراضي + إعدادات `app_settings`). |
| `npm run init-db` | اسم بديل لنفس السكربت. |

> السكربت يعمل ضمن transaction واحد ويستخدم `IF NOT EXISTS` بشكل واسع، فالتشغيل المتكرر آمن.

> **ملاحظة عن الجذر:** الأمر `npm run migrate` في الجذر يستدعي نفس سكربت الخادم. أمر `npm run migrate:all` ظاهر في `package.json` بالجذر لكن لا يوجد له هدف مقابل في `server/` حالياً، لذا الأمر المعتمد هو `npm run migrate`.

---

## نسخ احتياطي لقاعدة البيانات

سكربت [`server/scripts/backup-db.js`](server/scripts/backup-db.js) يستخدم `pg_dump` ويحفظ النسخة في `server/backups/`.

```bash
cd server
npm run backup                  # نسخة كاملة (مخطط + بيانات)
SCHEMA_ONLY=1 npm run backup    # مخطط فقط (مناسب للنشر)
```

من جذر المشروع: `npm run backup:db` يستدعي نفس السكربت.

### تحديد مكان `pg_dump`

- `PG_DUMP=...` لمسار كامل لـ `pg_dump.exe`.
- أو `PG_BIN=...` لمجلد `bin` الخاص بـ PostgreSQL.
- على Windows يبحث السكربت تلقائياً في `C:\Program Files\PostgreSQL\<النسخة>\bin`.

---

## نشر على Vercel

1. اربط المستودع بـ [Vercel](https://vercel.com).
2. في إعدادات المشروع:
   - **Root Directory:** `server`.
   - **Build Command:** فارغ.
   - **Output Directory:** فارغ.
   - **Install Command:** `npm install`.
3. أضف **Environment Variables**:
   - `DATABASE_URL` (مثلاً من [Neon](https://console.neon.tech)).
   - `JWT_SECRET`.
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
   - اختيارياً: `JWT_ACCESS_EXPIRY`, `JWT_REFRESH_EXPIRY_DAYS`, `CORS_ORIGIN`, `NODE_ENV=production`.
4. شغّل الهجرة على قاعدة الإنتاج من جهازك المحلي بعد ضبط `DATABASE_URL` ليشير إلى Neon:

   ```bash
   cd server
   npm run migrate
   ```

5. حدّث `.env` بجذر المشروع لاستخدام عنوان النشر:

   ```env
   EXPO_PUBLIC_API_URL=https://your-app.vercel.app
   ```

> Vercel يشغّل `npm start` الذي يُشغّل [`server/src/server.js`](server/src/server.js).

---

## نظرة عامة تقنية

| الجانب | التفاصيل |
|--------|----------|
| قاعدة البيانات | PostgreSQL (Neon في الإنتاج)، امتداد `pgcrypto` للـ UUID. |
| الخادم | Node.js + Express، ESM (`"type": "module"`)، Helmet + CORS + Multer. |
| التحقق من المدخلات | Zod عبر [`validate.middleware.js`](server/src/middleware/validate.middleware.js). |
| المصادقة | JWT Access قصير (`15m`) + Refresh عشوائي يُحفظ في `refresh_tokens` كـ hash. |
| رفع الصور | Cloudinary (Base64 ومتعدد الأجزاء). |
| الخريطة (موبايل) | Google Maps عبر `react-native-maps`. |
| الخريطة (ويب) | `@react-google-maps/api` أو `react-leaflet` كبديل. |
| إدارة الحالة | React Context + Zustand + AsyncStorage. |
| التوجيه | `expo-router` (file-based). |
| الواجهة | RTL مفعّل، ألوان/ثيم في [`constants/theme.ts`](constants/theme.ts). |

### بنية وحدات الخادم

```mermaid
flowchart LR
  client[Expo App / Browser] -->|JWT| express[Express + Helmet + CORS]
  express --> auth[auth]
  express --> places[places]
  express --> placeTypes[place-types + attribute defs]
  express --> ratings[ratings]
  express --> uploads[uploads]
  express --> placeCats[place-categories]
  express --> complexes[complexes + units]
  express --> admin[admin: users, reports, settings, stats, activity]
  auth --> db[(PostgreSQL)]
  places --> db
  placeCats --> db
  complexes --> db
  admin --> db
  uploads --> cloud[(Cloudinary)]
```

---

## هيكل الـ API

كل المسارات تحت `/api/`. المسارات المحمية تتطلب `Authorization: Bearer <accessToken>`. الاستجابات موحّدة عبر [`utils/response.js`](server/src/utils/response.js) (`success` / `paginated`).

### المصادقة (`/api/auth`)

| الطريقة | المسار | الوصف |
|---------|--------|-------|
| POST | `/auth/register` | تسجيل مستخدم جديد. |
| POST | `/auth/login` | يرجع `accessToken` + `refreshToken`. |
| POST | `/auth/refresh` | تجديد الـ access token. |
| POST | `/auth/logout` | إلغاء الـ refresh token. |
| GET  | `/auth/me` | بيانات المستخدم الحالي. |
| PATCH | `/auth/profile` | تحديث الاسم/الصورة الشخصية/تاريخ الميلاد/الهاتف. |
| PATCH | `/auth/change-password` | تغيير كلمة المرور. |

### أنواع الأماكن (`/api/place-types`)

| الطريقة | المسار | الصلاحية |
|---------|--------|----------|
| GET    | `/place-types` | عام. |
| POST   | `/place-types` | مدير. |
| PATCH  | `/place-types/:id` | مدير. |
| DELETE | `/place-types/:id` | مدير. |
| GET    | `/place-types/:id/attribute-definitions` | عام. |
| POST   | `/place-types/:id/attribute-definitions` | مدير. |
| PATCH  | `/place-types/:id/attribute-definitions/:defId` | مدير. |
| DELETE | `/place-types/:id/attribute-definitions/:defId` | مدير. |

### الأماكن (`/api/places`)

| الطريقة | المسار | الصلاحية |
|---------|--------|----------|
| GET    | `/places` | عام (يدعم Pagination + فلاتر). |
| GET    | `/places/mine` | مستخدم مسجّل. |
| GET    | `/places/:id` | عام. |
| POST   | `/places` | عام (يقبل ضيوفاً؛ تُنشأ بحالة `pending`). |
| POST   | `/places/from-admin` | مدير (نشر مباشر بحالة `active`). |
| PATCH  | `/places/:id` | المنشئ أو مدير. |
| DELETE | `/places/:id` | المنشئ أو مدير. |
| POST   | `/places/:id/images` | المنشئ أو مدير. |
| DELETE | `/places/:id/images/:imageId` | المنشئ أو مدير. |

### التصنيفات الشجرية (`/api/place-categories`)

تصنيف داخلي لكل نوع مكان (شجرة من قسمين رئيسي/فرعي مرتبطة بـ `place_type_id`).

| الطريقة | المسار | الصلاحية |
|---------|--------|----------|
| GET    | `/place-categories?place_type_id=&parent_id=` | عام. |
| GET    | `/place-categories/tree?place_type_id=` | عام (شجرة). |
| POST   | `/place-categories` | مدير. |
| PATCH  | `/place-categories/:id` | مدير. |
| DELETE | `/place-categories/:id` | مدير (يمنع الحذف إن كان مستخدماً). |

### المجمعات والوحدات (`/api/complexes` و `/api/complex-units`)

تصف المباني السكنية والتجارية المكوّنة من طوابق ووحدات قابلة للربط بأماكن أبناء (مثل بيت أو محل داخل مجمع).

| الطريقة | المسار | الوصف |
|---------|--------|-------|
| GET   | `/complexes/residential/child-place-ids` | معرفات أماكن مرتبطة بمجمعات سكنية. |
| GET   | `/complexes/commercial/child-place-ids`  | معرفات أماكن مرتبطة بمجمعات تجارية. |
| GET   | `/complexes/:placeId` | تفاصيل المجمع + قائمة وحداته. |
| POST  | `/complexes/:placeId/generate-units` | يولّد طوابق ووحدات (Idempotent). |
| PATCH | `/complex-units/:id/link-place` | ربط/فك ربط وحدة بمكان تابع. |

### التقييمات (`/api/ratings` و `/api/places/:placeId/ratings`)

| الطريقة | المسار | الصلاحية |
|---------|--------|----------|
| GET    | `/places/:placeId/ratings` | عام. |
| POST   | `/ratings` | مستخدم مسجّل. |
| PATCH  | `/ratings/:id` | المالك. |
| DELETE | `/ratings/:id` | المالك. |

### رفع الصور (`/api/upload`)

| الطريقة | المسار | الوصف |
|---------|--------|-------|
| POST | `/upload` | رفع ملف (`multipart/form-data` بحقل `image`). |
| POST | `/upload/base64` | رفع صورة Base64 إلى Cloudinary. |

### الإدارة (`/api`)

| الطريقة | المسار | الصلاحية |
|---------|--------|----------|
| GET    | `/admin/stats` | مدير (إحصائيات: مستخدمون، أماكن نشطة، طلبات معلّقة، …). |
| GET    | `/users` | مدير. |
| PATCH  | `/users/:id` | مدير (الاسم، البريد، الدور، الهاتف، تاريخ الميلاد، صور، حالة التوثيق). |
| PATCH  | `/users/:id/password` | مدير (إعادة ضبط كلمة المرور). |
| DELETE | `/users/:id` | مدير (حذف ناعم). |
| GET    | `/reports` | مستخدم مسجّل. |
| POST   | `/reports` | مستخدم مسجّل. |
| PATCH  | `/reports/:id` | مدير. |
| GET    | `/activity-log` | مدير. |
| GET    | `/settings` | عام. |
| PATCH  | `/settings` | مدير. |
| GET    | `/stores/:id/full` | عام (تفاصيل موسعة لمكان: صور، فيديو، هاتف). |

### Health

| الطريقة | المسار | الوصف |
|---------|--------|-------|
| GET | `/health` | فحص صحّة بسيط `{ ok: true }`. |

---

## نماذج البيانات

### User

```ts
{
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'owner' | 'store_owner';
  is_admin: boolean;
  phone_number?: string | null;
  date_of_birth?: string | null;
  profile_image_url?: string | null;
  id_card_image_url?: string | null;
  verification_status?: 'verified' | 'pending' | 'rejected' | 'unverified';
  created_at: string;
}
```

### PlaceType

```ts
{
  id: string;
  name: string;
  emoji?: string;
  color?: string;
  sort_order: number;
  kind: 'house' | 'store' | 'residentialComplex' | 'commercialComplex' | 'other';
  singular_label?: string;
  plural_label?: string;
  ui_labels: Record<string, unknown>;
  flags: Record<string, unknown>;
  aliases: string[];
}
```

### Place

```ts
{
  id: string;
  name: string;
  description?: string;
  type_id?: string;
  type_name?: string;
  latitude: number;
  longitude: number;
  status: 'active' | 'pending' | 'rejected';
  attributes: Record<string, unknown>;
  phone_number?: string | null;
  owner_id?: string | null;
  created_by?: string | null;
  avg_rating?: number;
  rating_count?: number;
  images: { id: string; url: string; type: 'image' | 'video'; sort_order: number }[];
  created_at: string;
}
```

### Complex / ComplexUnit

```ts
type Complex = {
  id: string;
  place_id: string;
  complex_type: 'residential' | 'commercial';
  floors_count: number;
  units_per_floor: number;
};

type ComplexUnit = {
  id: string;
  complex_id: string;
  floor_number: number;
  unit_number: string;
  child_place_id?: string | null;
  child_place_name?: string | null;
};
```

### PlaceCategory

```ts
{
  id: string;
  name: string;
  emoji?: string;
  color?: string;
  sort_order: number;
  parent_id?: string | null;
  place_type_id: string;
  children?: PlaceCategory[];
}
```

### Rating

```ts
{
  id: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  user_id: string;
  user_name?: string;
  created_at: string;
}
```

---

## مخطط قاعدة البيانات

> الجداول التي ينشئها [`server/scripts/migrate-v1.js`](server/scripts/migrate-v1.js) فقط (لا يوجد جداول legacy).

### Extensions

| Extension | الهدف |
|---|---|
| `pgcrypto` | توليد UUID عبر `gen_random_uuid()`. |

### المستخدمون والمصادقة

#### `users`

| Column | DataType | Notes |
|---|---|---|
| `id` | `UUID` | PK، `DEFAULT gen_random_uuid()`. |
| `name` | `VARCHAR(255)` | `NOT NULL`. |
| `email` | `VARCHAR(255)` | `UNIQUE`، `NOT NULL`. |
| `password_hash` | `VARCHAR(255)` | `NOT NULL` (bcrypt). |
| `role` | `VARCHAR(20)` | `'admin' \| 'user' \| 'owner' \| 'store_owner'`، افتراضي `user`. |
| `is_admin` | `BOOLEAN` | `DEFAULT false` (legacy). |
| `phone_number` | `VARCHAR(30)` | nullable. |
| `date_of_birth` | `DATE` | nullable. |
| `profile_image_url` | `TEXT` | nullable. |
| `id_card_image_url` | `TEXT` | nullable. |
| `verification_status` | `VARCHAR(20)` | افتراضي `unverified` (verified \| pending \| rejected \| unverified). |
| `created_at`, `updated_at`, `deleted_at` | `TIMESTAMPTZ` | حذف ناعم. |

#### `refresh_tokens`

| Column | DataType | Notes |
|---|---|---|
| `id` | `UUID` | PK. |
| `user_id` | `UUID` | FK -> `users(id)` `ON DELETE CASCADE`. |
| `token_hash` | `VARCHAR(255)` | `NOT NULL` (يخزَّن مشفّراً، لا تُحفظ القيم الخام). |
| `expires_at` | `TIMESTAMPTZ` | `NOT NULL`. |
| `created_at`, `revoked_at` | `TIMESTAMPTZ` | إبطال ناعم. |

### الأماكن

#### `place_types`

| Column | DataType | Notes |
|---|---|---|
| `id`, `name`, `created_at`, `updated_at` | — | الأساسيات. |
| `emoji` | `VARCHAR(64)` | اختياري. |
| `color` | `VARCHAR(32)` | لون HEX. |
| `sort_order` | `INTEGER` | افتراضي `100`. |
| `kind` | `VARCHAR(32)` | `house \| store \| residentialComplex \| commercialComplex \| other`. |
| `singular_label`, `plural_label` | `VARCHAR(150)` | تسميات عربية. |
| `ui_labels`, `flags` | `JSONB` | افتراضي `{}`. |
| `aliases` | `JSONB` | افتراضي `[]`. |

#### `place_type_attribute_definitions`

تعريف ديناميكي لخصائص كل نوع (مثلاً عدد الغرف لبيت، ساعات العمل لمحل).

| Column | DataType | Notes |
|---|---|---|
| `place_type_id` | `UUID` | FK -> `place_types`، `ON DELETE CASCADE`. |
| `key`, `label` | — | المفتاح والاسم المعروض. |
| `value_type` | `VARCHAR(20)` | `string \| number \| boolean \| json \| date \| phone`. |
| `is_required` | `BOOLEAN` | افتراضي `false`. |
| `options` | `JSONB` | اختياري (قائمة قيم). |

#### `places`

| Column | DataType | Notes |
|---|---|---|
| `id`, `name`, `description` | — | الأساسيات. |
| `type_id` | `UUID` | FK -> `place_types(id)` `ON DELETE SET NULL`. |
| `created_by`, `owner_id` | `UUID` | FK -> `users(id)` `ON DELETE SET NULL`. |
| `status` | `VARCHAR(20)` | افتراضي **`pending`** (`active \| pending \| rejected`). |
| `attributes` | `JSONB` | افتراضي `{}` — قيم خصائص المكان وفق تعريف نوعه. |
| `phone_number` | `VARCHAR(30)` | اختياري. |
| `created_at`, `updated_at`, `deleted_at` | — | حذف ناعم. |

#### `place_locations`

| Column | DataType | Notes |
|---|---|---|
| `place_id` | `UUID` | PK + FK -> `places(id)` `ON DELETE CASCADE`. |
| `latitude`, `longitude` | `DECIMAL(10,7)` | `NOT NULL`. |

#### `media`

> يحلّ محل `place_images` السابق ويدعم الصور والفيديو معاً.

| Column | DataType | Notes |
|---|---|---|
| `place_id` | `UUID` | FK -> `places(id)` `ON DELETE CASCADE`. |
| `type` | `VARCHAR(10)` | `image \| video`. |
| `url` | `TEXT` | `NOT NULL`. |
| `sort_order` | `INTEGER` | افتراضي `0`. |

#### `store_details`

| Column | DataType | Notes |
|---|---|---|
| `place_id` | `UUID` | PK + FK -> `places(id)` `ON DELETE CASCADE`. |
| `phone` | `VARCHAR(30)` | اختياري. |
| `opening_hours` | `TEXT` | اختياري. |

### المجمعات والوحدات

#### `complexes`

| Column | DataType | Notes |
|---|---|---|
| `place_id` | `UUID` | FK + UNIQUE -> `places(id)` `ON DELETE CASCADE`. |
| `complex_type` | `VARCHAR(20)` | `residential \| commercial`. |
| `floors_count`, `units_per_floor` | `INTEGER` | الطوابق والوحدات لكل طابق. |

#### `complex_units`

| Column | DataType | Notes |
|---|---|---|
| `complex_id` | `UUID` | FK -> `complexes(id)` `ON DELETE CASCADE`. |
| `floor_number` | `INTEGER` | رقم الطابق. |
| `unit_number` | `VARCHAR(20)` | رقم الوحدة. |
| `child_place_id` | `UUID` | FK -> `places(id)` (مكان تابع). |

UNIQUE على `(complex_id, floor_number, unit_number)`.

### التصنيفات الشجرية

#### `place_categories`

| Column | DataType | Notes |
|---|---|---|
| `id`, `name`, `emoji`, `color`, `sort_order` | — | الأساسيات. |
| `parent_id` | `UUID` | FK ذاتي `ON DELETE CASCADE` (يُكوّن شجرة). |
| `place_type_id` | `UUID` | FK -> `place_types(id)` `ON DELETE CASCADE`. |

UNIQUE على `(place_type_id, parent_id, name)`.

#### `place_category_links`

ربط مكان بتصنيف رئيسي وفرعي ضمن نوعه.

| Column | DataType | Notes |
|---|---|---|
| `place_id` | `UUID` | PK + FK -> `places(id)` `ON DELETE CASCADE`. |
| `main_category_id`, `sub_category_id` | `UUID` | FK -> `place_categories(id)` `ON DELETE SET NULL`. |

### التقييمات والإبلاغات

#### `ratings`

UNIQUE على `(place_id, user_id)`، تقييم بين 1–5، حذف ناعم عبر `deleted_at`.

#### `reports`

| Column | DataType | Notes |
|---|---|---|
| `place_id` | `UUID` | FK -> `places(id)` `ON DELETE CASCADE` (تم تصحيح FK من `stores` التاريخي). |
| `reported_by`, `resolved_by` | `UUID` | FK -> `users(id)` `ON DELETE SET NULL`. |
| `reason`, `details`, `status` | — | `pending \| resolved \| dismissed`. |

### السجل والإعدادات

- `activity_log`: سجل عمليات الإدارة (action، entity_type، entity_id، details JSONB).
- `app_settings`: إعدادات key/value JSONB (مثل `maintenance_mode`، `welcome_message`).

---

## التصنيفات الشجرية والمجمعات

```mermaid
flowchart TD
  pt[place_type: house/store/residentialComplex/commercialComplex] --> pc[place_categories <br/> رئيسي/فرعي]
  pt --> p[places]
  p --> pcl[place_category_links<br/>main + sub]
  pcl --> pc
  p --> cx[complexes<br/>residential/commercial]
  cx --> cu[complex_units]
  cu --> child[child_place_id -> places]
```

- يربط [`place_category_links`](server/scripts/migrate-v1.js) كل مكان بتصنيف رئيسي وفرعي اختياري.
- المجمع نفسه مكان (`places`) يحمل `place_type` من نوع `residentialComplex` أو `commercialComplex`، وله سجل في `complexes` يحدد عدد الطوابق والوحدات؛ كل وحدة قابلة للربط بمكان تابع (بيت داخل مجمع سكني، أو محل داخل مجمع تجاري).
- لمنع التعارض، لا يمكن ربط وحدة بمكان يمثّل بدوره مجمعاً (انظر [`complexes.routes.js`](server/src/modules/complexes/complexes.routes.js)).

---

## صلاحيات الأطراف

### الزائر (بدون تسجيل دخول)

| الصلاحية | |
|----------|--|
| عرض الخريطة والأماكن النشطة | متاح. |
| التصفية حسب نوع/تصنيف | متاح. |
| عرض تفاصيل مكان | متاح. |
| إرسال طلب إضافة مكان (`pending`) | متاح (`POST /api/places` مع `optionalAuth`). |
| إرسال إبلاغ، تقييم | يلزم تسجيل دخول. |

### المستخدم المسجّل

كل صلاحيات الزائر، إضافةً إلى:

| الصلاحية | |
|----------|--|
| إضافة مكان (يصبح `pending` للمراجعة) | متاح. |
| تعديل/حذف الأماكن التي أنشأها | متاح. |
| إضافة/تعديل/حذف تقييماته | متاح. |
| إرسال إبلاغ عن مكان | متاح. |
| تعديل ملفه الشخصي وكلمة مروره | متاح. |

### المدير (`role: 'admin'`)

| الصلاحية | |
|----------|--|
| لوحة الإدارة الكاملة | متاح. |
| نشر مكان مباشرةً (`/places/from-admin`) أو قبول/رفض الأماكن المعلّقة | متاح. |
| إدارة المستخدمين (تحديث، تعديل دور، إعادة كلمة مرور، حذف ناعم) | متاح. |
| إدارة أنواع الأماكن وتعاريف خصائصها | متاح. |
| إدارة شجرة التصنيفات | متاح. |
| إدارة المجمعات والوحدات وروابطها | متاح. |
| مراجعة الإبلاغات | متاح. |
| سجل النشاط | متاح. |

> **حساب المدير الافتراضي عند الهجرة الأولى:** `admin@system.local` / `ChangeMe123!` (قابل للتعديل عبر `ADMIN_EMAIL` و`ADMIN_PASSWORD`).

---

## التوجيه (Routing)

| المسار | الملف | الوصف |
|--------|-------|-------|
| `/` | [`app/index.tsx`](app/index.tsx) | نقطة بدء — توجّه لـ onboarding أو login أو map. |
| `/onboarding` | [`app/onboarding.tsx`](app/onboarding.tsx) | شرائح الترحيب الأولى. |
| `/(auth)/login` | [`app/(auth)/login.tsx`](app/(auth)/login.tsx) | تسجيل الدخول. |
| `/(auth)/register` | [`app/(auth)/register.tsx`](app/(auth)/register.tsx) | إنشاء حساب. |
| `/(main)/map` | [`app/(main)/map.tsx`](app/(main)/map.tsx) | الخريطة التفاعلية. |
| `/(main)/admin` | [`app/(main)/admin.tsx`](app/(main)/admin.tsx) | لوحة الإدارة الرئيسية. |
| `/(main)/admin-stores` | [`app/(main)/admin-stores.tsx`](app/(main)/admin-stores.tsx) | إدارة الأماكن. |
| `/(main)/admin-categories` | [`app/(main)/admin-categories.tsx`](app/(main)/admin-categories.tsx) | إدارة أنواع الأماكن. |
| `/(main)/admin-classification-tree` | [`app/(main)/admin-classification-tree.tsx`](app/(main)/admin-classification-tree.tsx) | شجرة التصنيفات. |
| `/(main)/admin-place-requests` | [`app/(main)/admin-place-requests.tsx`](app/(main)/admin-place-requests.tsx) | الأماكن المعلّقة. |
| `/(main)/admin-users` | [`app/(main)/admin-users.tsx`](app/(main)/admin-users.tsx) | إدارة المستخدمين. |
| `/(main)/admin-reports` | [`app/(main)/admin-reports.tsx`](app/(main)/admin-reports.tsx) | الإبلاغات. |
| `/(main)/admin-settings` | [`app/(main)/admin-settings.tsx`](app/(main)/admin-settings.tsx) | إعدادات التطبيق. |
| `/(main)/admin-activity` | [`app/(main)/admin-activity.tsx`](app/(main)/admin-activity.tsx) | سجل النشاط. |
| `/(main)/user-modifications` | [`app/(main)/user-modifications.tsx`](app/(main)/user-modifications.tsx) | تعديلات المستخدم على ملفه/أماكنه. |

---

## هيكل الملفات

> شجرة مختصرة تعكس الهيكل الفعلي الحالي (بدون `node_modules` و`.expo`).

### الجذر

```text
tulkarm-map/
├── app.json, app.config.js          # إعدادات Expo
├── eslint.config.js, tsconfig.json
├── package.json, package-lock.json
├── .env.example                     # متغيرات Expo
└── README.md
```

### الواجهة (`app/`, `api/`, `components/`, …)

```text
api/
├── client.ts                        # عميل HTTP موحّد + JWT/refresh تلقائي
└── config.ts                        # اشتقاق عنوان API حسب البيئة (Expo/Web)

app/
├── _layout.tsx                      # Providers + Stack + RTL على الويب
├── index.tsx                        # توجيه ذكي
├── onboarding.tsx
├── (auth)/login.tsx, register.tsx
└── (main)/
    ├── map.tsx                      # الخريطة الرئيسية
    ├── admin*.tsx                   # شاشات الإدارة (انظر جدول التوجيه)
    └── user-modifications.tsx

components/
├── AddPlaceModal/                   # نافذة إضافة مكان (نموذج + خصائص ديناميكية)
├── MapWrapper/                      # تغليف الخريطة (موبايل + ويب)
├── admin/                           # مكوّنات لوحة الإدارة
├── map/                             # شريط الفئات، البحث، المسارات، أوراق التفاصيل
├── places/                          # نموذج المكان، اختيار الموقع، التفاصيل، عارض المجمع
└── profile/                         # نوافذ تعديل الملف الشخصي وكلمة المرور

constants/                           # ثيم + ألوان + نطاق طولكرم + نمط الخريطة
context/                             # Auth, Categories, Stores, GoogleMapsLoader (web/native)
hooks/
├── map/                             # خطافات الخريطة (موقع، مسار، تصفّح فئات)
└── admin/                           # خطافات لوحة الإدارة

utils/
├── map/                             # routing, geo, storeModel, locationWatch, …
├── admin/                           # helpers لمعالجة بيانات لوحة الإدارة
├── geofencing.* , notifications.*   # موبايل + ويب stubs
└── placeTypesRegistry.ts, placeTypeLabels.ts, …
```

### الخادم (`server/`)

```text
server/
├── package.json
├── .env.example
├── scripts/
│   ├── migrate-v1.js               # المخطط الكامل + Seed
│   └── backup-db.js                # pg_dump إلى server/backups/
└── src/
    ├── server.js                   # listen + فحص اتصال DB
    ├── app.js                      # Express + ربط الوحدات
    ├── config/
    │   ├── env.js                  # تحميل وتحقق متغيرات البيئة
    │   └── db.js                   # Pool PostgreSQL
    ├── middleware/
    │   ├── auth.middleware.js      # JWT (authenticate / optionalAuth)
    │   ├── role.middleware.js      # requireRole('admin')
    │   ├── validate.middleware.js  # Zod
    │   └── error.middleware.js     # 404 + معالج أخطاء موحّد
    ├── modules/
    │   ├── auth/                   # routes, controller, service, repository, schema
    │   ├── placeTypes/             # CRUD + attribute-definitions
    │   ├── places/                 # CRUD + images + from-admin + mine
    │   ├── ratings/                # CRUD + استعلام لكل مكان
    │   ├── uploads/                # رفع ملف + Base64 إلى Cloudinary
    │   ├── placeCategories/        # شجرة التصنيفات
    │   ├── complexes/              # المجمعات والوحدات
    │   └── admin/                  # users, reports, activity, settings, stats, stores/full
    └── utils/
        ├── ApiError.js             # كلاس أخطاء API
        ├── hash.js                 # bcrypt
        ├── jwt.js                  # access + refresh
        └── response.js             # success / paginated
```

---


## سير عمل إضافة مكان

```mermaid
flowchart LR
  user[Visitor or User] -->|tap empty point| modal[AddPlaceModal]
  modal -->|"POST /api/places"| api[Express]
  api --> db[(places.status = pending)]
  db --> queue[admin-place-requests screen]
  queue -->|"PATCH /api/places/:id"| approve[active or rejected]
  approve --> map[map.tsx markers]
```

1. الزائر أو المستخدم المسجّل ينقر نقطة فارغة على خريطة طولكرم.
2. تظهر [`AddPlaceModal`](components/AddPlaceModal/AddPlaceModal.tsx): الاسم، نوع المكان، تصنيف رئيسي/فرعي اختياري، خصائص ديناميكية حسب التعريف، صور.
3. يُرسَل الطلب إلى `POST /api/places` بحالة `pending`.
4. يراجعه المدير في شاشة [`admin-place-requests.tsx`](app/(main)/admin-place-requests.tsx):
   - **قبول** → الحالة تصبح `active` ويظهر على الخريطة.
   - **رفض** → الحالة تصبح `rejected`.
5. عند الإضافة من لوحة الإدارة عبر `POST /api/places/from-admin`، يُنشر المكان مباشرةً بحالة `active`.

---

## مصادر إضافية

- [Expo Documentation](https://docs.expo.dev/).
- [Expo Router](https://docs.expo.dev/router/introduction/).
- [React Native Maps](https://github.com/react-native-maps/react-native-maps).
- [React Leaflet](https://react-leaflet.js.org/).
- [Neon PostgreSQL](https://neon.tech).
- [Cloudinary](https://cloudinary.com).
- [Discord مجتمع Expo](https://chat.expo.dev).

---

المشروع مفتوح المصدر. نرحب بالمساهمات.
