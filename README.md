# طولكرم — دليل مدينة طولكرم على الخريطة 🏙️

تطبيق خريطة تفاعلية لمدينة طولكرم يستكشف الأماكن والمتاجر والخدمات. يعمل على **Expo / React Native** ويدعم **الموبايل والويب**. الخادم مبني على **Node.js + Express + PostgreSQL** مع نظام **JWT** للمصادقة.

---

## جدول المحتويات

- [البدء السريع](#البدء-السريع)
- [إعداد الخادم (Backend)](#إعداد-الخادم-backend)
- [هجرات قاعدة البيانات](#هجرات-قاعدة-البيانات)
- [نشر على Vercel](#نشر-على-vercel)
- [Google Maps API](#google-maps-api)
- [نظرة عامة على المشروع](#نظرة-عامة-على-المشروع)
- [هيكل الـ API](#هيكل-الـ-api)
- [نماذج البيانات](#نماذج-البيانات)
- [مخطط قاعدة البيانات](#مخطط-قاعدة-البيانات)
- [صلاحيات الأطراف](#صلاحيات-الأطراف)
- [التوجيه (Routing)](#التوجيه-routing)
- [هيكل الملفات](#هيكل-الملفات)
- [مصادر إضافية](#مصادر-إضافية)

---

## البدء السريع

```bash
# 1. تثبيت اعتماديات الواجهة الأمامية
npm install

# 2. تشغيل التطبيق
npx expo start
```

في المخرجات ستجد خيارات فتح التطبيق عبر:
- [Development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go)
- الويب: `npx expo start --web`

> لتشغيل التطبيق بشكل كامل مع البيانات الحية، يجب إعداد الخادم أدناه.

---

## إعداد الخادم (Backend)

### 1. تثبيت الاعتماديات

```bash
cd server
npm install
```

### 2. إعداد متغيّرات البيئة

```bash
# Windows
copy .env.example .env

# Mac/Linux
cp .env.example .env
```

عدّل `server/.env`:

```env
DATABASE_URL=postgresql://postgres:كلمة_المرور@localhost:5432/tulkarm-map
PORT=3000
JWT_SECRET=سر_طويل_وعشوائي
JWT_REFRESH_SECRET=سر_آخر_مختلف
CLOUDINARY_CLOUD_NAME=اسم_cloudinary
CLOUDINARY_API_KEY=مفتاح_cloudinary
CLOUDINARY_API_SECRET=سر_cloudinary
```

### 3. تهيئة قاعدة البيانات وتشغيل الهجرات

```bash
cd server

# إنشاء الجداول الأساسية للمرة الأولى
# إنشاء الجداول الأساسية + تشغيل الهجرات كلها (سكربت v1 موحّد)
npm run migrate:v1
```

> يمكن تشغيل الهجرات من جذر المشروع أيضاً:
> ```bash
> npm run migrate:v1
> ```

### 4. تشغيل الخادم

```bash
cd server
npm start
# أو في وضع المراقبة
npm run dev
```

يجب أن ترى: `DB connected` و `Server listening on port 3000`

### 5. ربط التطبيق بالخادم

في **جذر المشروع** (ليس داخل server)، عدّل ملف `.env`:

```env
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=مفتاحك_هنا
```

> - **Android محاكي:** استخدم `http://10.0.2.2:3000`
> - **جهاز حقيقي على نفس الشبكة:** استخدم IP جهازك مثل `http://192.168.1.5:3000`

**حساب المدير الافتراضي:**  
`admin@tulkarm.com` / `admin123`

---

## هجرات قاعدة البيانات

| الهجرة | ما تضيفه |
|--------|----------|
| `migrate:v1` | إنشاء الجداول الأساسية + ترحيلات `v2..v8` + seed لأنواع الأماكن الأساسية (`place_types`) + (اختياري) حذف `place_requests` عبر `--drop-unused-tables` |

> السكربت موحّد وآمن للتشغيل أكثر من مرة (معظم DDL تستخدم `IF NOT EXISTS`). الحذف تدميري ويظل اختياري.

---

## نشر على Vercel

1. اربط المستودع بـ [Vercel](https://vercel.com).
2. في إعدادات المشروع:
   - **Root Directory:** `server`
   - **Build Command:** *(فارغ)*
   - **Output Directory:** *(فارغ)*
   - **Install Command:** `npm install`
3. أضف **Environment Variables** على Vercel:
   - `DATABASE_URL` ← رابط Neon من [console.neon.tech](https://console.neon.tech)
   - `JWT_SECRET`, `JWT_REFRESH_SECRET`
   - `CLOUDINARY_*`
4. بعد النشر، حدّث `.env` في جذر المشروع:
   ```env
   EXPO_PUBLIC_API_URL=https://tulkarm-map.vercel.app
   ```
5. شغّل الهجرات على قاعدة بيانات الإنتاج (Neon):
   ```bash
   # من جهازك المحلي مع DATABASE_URL تشير لـ Neon
   npm run migrate:v1
   ```

> **ملاحظة:** Vercel يشغّل `npm start` الذي يُشغّل `node src/server.js` — وهو نفس ما يُشغّله `node index.js` الآن.

---

## Google Maps API

1. أنشئ مشروعاً في [Google Cloud](https://console.cloud.google.com) وفعّل:
   - Maps SDK for Android
   - Maps SDK for iOS
   - Maps JavaScript API (للويب)
2. أنشئ مفاتيح API من Credentials.
3. في `app.json` استبدل `YOUR_ANDROID_GOOGLE_MAPS_API_KEY` و `YOUR_IOS_GOOGLE_MAPS_API_KEY`.
4. في `.env` ضع مفتاح الويب: `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=...`
5. أعد تشغيل Expo بعد أي تعديل على `.env`.

### استكشاف خطأ "This page didn't load Google Maps correctly"

1. **تفعيل الفوترة:** يجب ربط مشروع Google Cloud بحساب فوترة.
2. **Maps JavaScript API:** تأكد من تفعيله من [المكتبات](https://console.cloud.google.com/apis/library).
3. **HTTP referrers:** أضف `http://localhost:*` و `http://127.0.0.1:*` للمفتاح.

---

## نظرة عامة على المشروع

| الجانب | التفاصيل |
|--------|----------|
| قاعدة البيانات | PostgreSQL (Neon في الإنتاج) |
| الخادم | Node.js + Express، ESM (`"type": "module"`) |
| المصادقة | JWT (access token قصير + refresh token في DB) |
| رفع الصور | Cloudinary |
| الخريطة (موبايل) | Google Maps عبر `react-native-maps` |
| الخريطة (ويب) | `@react-google-maps/api` |
| التوجيه | `expo-router` (file-based routing) |

---

## هيكل الـ API

جميع المسارات تحت `/api/`. المسارات المحمية تتطلب `Authorization: Bearer <token>`.

### المصادقة
| الطريقة | المسار | الوصف |
|---------|--------|-------|
| POST | `/api/auth/register` | تسجيل مستخدم جديد |
| POST | `/api/auth/login` | تسجيل دخول، يرجع `accessToken` + `refreshToken` |
| POST | `/api/auth/refresh` | تجديد الـ access token |
| POST | `/api/auth/logout` | إلغاء الـ refresh token |
| GET  | `/api/auth/me` | بيانات المستخدم الحالي |

### أنواع الأماكن (place_types)
| الطريقة | المسار | الوصف |
|---------|--------|-------|
| GET  | `/api/place-types` | قائمة جميع الأنواع |
| POST | `/api/place-types` | إنشاء نوع (مدير فقط) |
| PATCH | `/api/place-types/:id` | تعديل نوع (مدير فقط) |

### الأماكن (places)
| الطريقة | المسار | الوصف |
|---------|--------|-------|
| GET  | `/api/places` | قائمة الأماكن مع pagination وفلاتر |
| GET  | `/api/places/:id` | تفاصيل مكان |
| POST | `/api/places` | إضافة مكان (مسجّل دخول) |
| PATCH | `/api/places/:id` | تعديل مكان (مالك أو مدير) |
| DELETE | `/api/places/:id` | حذف مكان (مالك أو مدير) |
| POST | `/api/places/:id/images` | إضافة صورة |
| DELETE | `/api/places/:id/images/:imgId` | حذف صورة |

### التقييمات
| الطريقة | المسار | الوصف |
|---------|--------|-------|
| GET  | `/api/places/:id/ratings` | تقييمات مكان |
| POST | `/api/ratings` | إضافة تقييم |
| PATCH | `/api/ratings/:id` | تعديل تقييم |
| DELETE | `/api/ratings/:id` | حذف تقييم |

### رفع الصور
| الطريقة | المسار | الوصف |
|---------|--------|-------|
| POST | `/api/upload/base64` | رفع صورة Base64 إلى Cloudinary |

### الإدارة (مدير فقط)
| الطريقة | المسار | الوصف |
|---------|--------|-------|
| GET  | `/api/admin/stats` | إحصائيات عامة |
| GET  | `/api/users` | قائمة المستخدمين |
| PATCH | `/api/users/:id` | تعديل دور المستخدم |
| DELETE | `/api/users/:id` | حذف مستخدم |
| GET  | `/api/reports` | قائمة الإبلاغات |
| POST | `/api/reports` | إرسال إبلاغ |
| PATCH | `/api/reports/:id` | تعديل حالة إبلاغ |
| GET  | `/api/activity-log` | سجل النشاط |
| GET/PATCH | `/api/settings` | إعدادات التطبيق |
| GET  | `/api/my-stores` | أماكن المستخدم الحالي |
| GET  | `/api/places/:id/full` | تفاصيل مكان كاملة (للمدير) |
| PATCH | `/api/places/:id/owner` | تعيين مالك لمكان |

---

## نماذج البيانات

### User
```typescript
{ id, name, email, role: 'user'|'admin', is_admin, created_at }
```

### PlaceType
```typescript
{ id, name, emoji?, color?, created_at }
```

### Place
```typescript
{
  id, name, description?,
  type_id, type_name?,
  latitude, longitude,
  status: 'active'|'pending'|'rejected',
  avg_rating, rating_count,
  attributes: { key, value, value_type }[],
  images: { id, image_url, sort_order }[],
  created_by?, created_at
}
```

### Rating
```typescript
{ id, rating: 1-5, comment?, user_name, user_id, created_at }
```

---

## مخطط قاعدة البيانات

### الجداول الرئيسية

#### `users`
| العمود | النوع | الشرح |
|--------|-------|-------|
| `id` | UUID | PRIMARY KEY |
| `name` | VARCHAR(255) | الاسم |
| `email` | VARCHAR(255) | UNIQUE |
| `password_hash` | VARCHAR(255) | bcrypt |
| `is_admin` | BOOLEAN | DEFAULT false |
| `role` | VARCHAR(20) | `'user'` أو `'admin'` |
| `created_at` | TIMESTAMPTZ | |
| `deleted_at` | TIMESTAMPTZ | حذف ناعم |

#### `place_types`
| العمود | النوع | الشرح |
|--------|-------|-------|
| `id` | UUID | PRIMARY KEY |
| `name` | VARCHAR(100) | UNIQUE |
| `emoji` | VARCHAR(32) | أيقونة العرض |
| `color` | VARCHAR(32) | لون HEX |
| `created_at` | TIMESTAMPTZ | |

**أنواع افتراضية:** منزل، محل تجاري، مجمع سكني، مجمع تجاري، أخرى

#### `places`
| العمود | النوع | الشرح |
|--------|-------|-------|
| `id` | UUID | PRIMARY KEY |
| `name` | VARCHAR(255) | |
| `description` | TEXT | |
| `type_id` | UUID | FK → place_types |
| `created_by` | UUID | FK → users |
| `status` | VARCHAR(20) | `active`/`pending`/`rejected` |
| `created_at` | TIMESTAMPTZ | |
| `deleted_at` | TIMESTAMPTZ | حذف ناعم |

#### `place_locations`
| العمود | النوع | الشرح |
|--------|-------|-------|
| `place_id` | UUID | PK + FK → places |
| `latitude` | DECIMAL(10,7) | |
| `longitude` | DECIMAL(10,7) | |

#### `ratings`
| العمود | النوع | الشرح |
|--------|-------|-------|
| `id` | UUID | PRIMARY KEY |
| `place_id` | UUID | FK → places |
| `user_id` | UUID | FK → users |
| `rating` | SMALLINT | 1–5 |
| `comment` | TEXT | |

#### `refresh_tokens`
| العمود | النوع | الشرح |
|--------|-------|-------|
| `id` | UUID | PRIMARY KEY |
| `user_id` | UUID | FK → users |
| `token_hash` | TEXT | hash للـ refresh token |
| `expires_at` | TIMESTAMPTZ | |
| `revoked_at` | TIMESTAMPTZ | |

### الجداول القديمة (محتفظ بها للتوافق)
`categories`, `stores`, `place_requests` — تُقرأ فقط كـ fallback للبيانات القديمة.

---

## صلاحيات الأطراف

### الزائر (بدون تسجيل دخول)
| الصلاحية | |
|----------|--|
| عرض الخريطة والأماكن | ✅ |
| التصفية حسب النوع | ✅ |
| عرض تفاصيل مكان | ✅ |
| إرسال إبلاغ | ✅ |
| إضافة مكان | ❌ (يلزم تسجيل دخول) |
| لوحة الإدارة | ❌ |

### المستخدم المسجّل
نفس صلاحيات الزائر، إضافةً إلى:
| الصلاحية | |
|----------|--|
| إضافة مكان (يصبح pending للمراجعة) | ✅ |
| تعديل/حذف أماكنه | ✅ |
| إضافة وتعديل وحذف تقييماته | ✅ |
| لوحة المالك (owner-dashboard) | ✅ |

### المدير (`role: 'admin'`)
كل صلاحيات المستخدم، إضافةً إلى:
| الصلاحية | |
|----------|--|
| لوحة الإدارة الكاملة | ✅ |
| قبول/رفض الأماكن المعلّقة | ✅ |
| إدارة المستخدمين (ترقية/تخفيض/حذف) | ✅ |
| إدارة أنواع الأماكن (إضافة/تعديل) | ✅ |
| مراجعة الإبلاغات | ✅ |
| عرض سجل النشاط | ✅ |

**حساب المدير الافتراضي:**
- البريد: `admin@tulkarm.com`
- كلمة المرور: `admin123`

---

## التوجيه (Routing)

| المسار | الملف | الشرح |
|--------|-------|-------|
| `/` | `app/index.tsx` | نقطة البداية — يوجّه حسب حالة تسجيل الدخول |
| `/onboarding` | `app/onboarding.tsx` | شاشة الترحيب (3 شرائح) |
| `/(auth)/login` | `login.tsx` | تسجيل الدخول |
| `/(auth)/register` | `register.tsx` | إنشاء حساب |
| `/(main)/map` | `map.tsx` | الخريطة التفاعلية |
| `/(main)/admin` | `admin.tsx` | لوحة الإدارة |
| `/(main)/admin-stores` | `admin-stores.tsx` | إدارة الأماكن |
| `/(main)/admin-categories` | `admin-categories.tsx` | إدارة أنواع الأماكن |
| `/(main)/admin-place-requests` | `admin-place-requests.tsx` | الأماكن المعلّقة |
| `/(main)/admin-users` | `admin-users.tsx` | إدارة المستخدمين |
| `/(main)/admin-reports` | `admin-reports.tsx` | الإبلاغات |
| `/(main)/admin-settings` | `admin-settings.tsx` | إعدادات التطبيق |
| `/(main)/admin-activity` | `admin-activity.tsx` | سجل النشاط |
| `/(main)/owner-dashboard` | `owner-dashboard.tsx` | لوحة مالك المكان |

---

## هيكل الملفات

> هذه الشجرة تشمل الملفات الفعلية الحالية في المشروع (بدون `node_modules`).

```text
tulkarm-map/
├── .env.example # قالب متغيرات البيئة (Front/Expo)
├── .gitignore # تجاهل ملفات غير لازمة لـ Git
├── README.md # توثيق المشروع
├── app.config.js # إعدادات Expo حسب البيئة
├── app.json # إعدادات Expo الأساسية
├── eslint.config.js # قواعد ESLint
├── package-lock.json # قفل نسخ npm
├── package.json # سكربتات وتبعيات الواجهة
├── tsconfig.json # إعدادات TypeScript
├── .vscode/
│   ├── extensions.json # إضافات مقترحة
│   └── settings.json # إعدادات المحرر
├── api/
│   ├── client.ts # عميل API + JWT/refresh
│   └── config.ts # تحديد عنوان API
├── app/
│   ├── _layout.tsx # Providers + Stack + RTL(web)
│   ├── index.tsx # شاشة البداية (redirect)
│   ├── onboarding.tsx # شاشة الترحيب
│   ├── (auth)/
│   │   ├── _layout.tsx # layout للمصادقة
│   │   ├── login.tsx # تسجيل دخول
│   │   └── register.tsx # إنشاء حساب
│   └── (main)/
│       ├── _layout.tsx # layout بعد تسجيل الدخول
│       ├── admin.tsx # لوحة الإدارة
│       ├── admin-stores.tsx # إدارة الأماكن/المتاجر
│       ├── admin-categories.tsx # إدارة أنواع الأماكن
│       ├── admin-place-requests.tsx # مراجعة الطلبات المعلّقة
│       ├── admin-users.tsx # إدارة المستخدمين
│       ├── admin-reports.tsx # إدارة البلاغات
│       ├── admin-settings.tsx # إعدادات التطبيق
│       ├── admin-activity.tsx # سجل نشاط الإدارة
│       ├── map.tsx # الخريطة (المكان/الفئات/الطلبات)
│       └── owner-dashboard.tsx # لوحة صاحب المتجر
├── assets/
│   └── images/
│       ├── adaptive-icon.png # أيقونة Android
│       ├── favicon.png # favicon للويب
│       ├── icon.png # أيقونة التطبيق
│       └── splash-icon.png # شاشة البداية
├── components/
│   ├── AddPlaceModal.tsx # نافذة إضافة مكان
│   ├── ReportModal.tsx # نافذة إرسال بلاغ
│   ├── external-link.tsx # رابط خارجي
│   ├── haptic-tab.tsx # زر باهتزاز/UX
│   ├── hello-wave.tsx # عنصر ترحيبي
│   ├── parallax-scroll-view.tsx # Parallax Scroll
│   ├── themed-text.tsx # Text حسب الثيم
│   ├── themed-view.tsx # View حسب الثيم
│   ├── MapWrapper/
│   │   ├── index.tsx # Map للموبايل
│   │   └── index.web.tsx # Map للويب
│   └── ui/
│       ├── collapsible.tsx # عنصر قابل للطي
│       ├── icon-symbol.ios.tsx # أيقونات iOS
│       └── icon-symbol.tsx # أيقونات عامة
├── constants/
│   ├── categoryColors.ts # ألوان الفئات
│   ├── layout.ts # مقاسات ثابتة للواجهة
│   ├── mapStyle.ts # نمط الخريطة
│   ├── theme.ts # ألوان/ثيم عام
│   └── tulkarmRegion.ts # حدود/إحداثيات طولكرم
├── context/
│   ├── AuthContext.tsx # جلسة/صلاحيات المستخدم
│   ├── CategoryContext.tsx # تحميل أنواع الأماكن
│   ├── GoogleMapsLoaderContext.tsx # تحميل Google Maps (موبايل)
│   ├── GoogleMapsLoaderContext.web.tsx # تحميل Google Maps (ويب)
│   └── StoreContext.tsx # تحميل الأماكن/المتاجر
├── hooks/
│   ├── use-color-scheme.ts # ثيم النظام (موبايل)
│   ├── use-color-scheme.web.ts # ثيم النظام (ويب)
│   └── use-theme-color.ts # لون حسب الثيم
├── scripts/
│   └── reset-project.js # تنظيف/إعادة تهيئة المشروع
├── server/
│   ├── .env.example # قالب بيئة الخادم (DB/JWT/Cloudinary)
│   ├── db.js # (قديم) اتصال/تهيئة DB
│   ├── index.js # تشغيل (entrypoint)
│   ├── index.legacy.js # entrypoint توافق قديم
│   ├── package-lock.json # قفل نسخ الخادم
│   ├── package.json # سكربتات وتبعيات الخادم
│   ├── scripts/
│   │   └── migrate-v1.js # سكربت موحّد شامل (init-db + v2..v8 + seed + حذف اختياري)
│   └── src/
│       ├── app.js # Express + ربط routes
│       ├── legacy-bridge.js # جسر توافق بين النسخ
│       ├── server.js # listen + تحقق DB
│       ├── config/
│       │   ├── db.js # Pool PostgreSQL
│       │   └── env.js # قراءة/تحقق متغيرات البيئة
│       ├── middleware/
│       │   ├── auth.middleware.js # JWT حماية
│       │   ├── error.middleware.js # معالجة الأخطاء
│       │   ├── role.middleware.js # صلاحيات admin/owner
│       │   └── validate.middleware.js # تحقق عبر Zod
│       ├── modules/
│       │   ├── admin/
│       │   │   └── admin.routes.js # مسارات admin
│       │   ├── auth/
│       │   │   ├── auth.controller.js # handlers المصادقة
│       │   │   ├── auth.repository.js # استعلامات users/tokens
│       │   │   ├── auth.routes.js # endpoints auth
│       │   │   ├── auth.schema.js # Zod schemas
│       │   │   └── auth.service.js # منطق register/login/refresh
│       │   ├── orders/
│       │   │   └── orders.routes.js # endpoints الطلبات
│       │   ├── placeTypes/
│       │   │   ├── placeTypes.controller.js # handlers place types
│       │   │   ├── placeTypes.repository.js # DB لplace types
│       │   │   ├── placeTypes.routes.js # endpoints place types
│       │   │   ├── placeTypes.schema.js # تحقق المدخلات
│       │   │   └── placeTypes.service.js # منطق الأعمال
│       │   ├── places/
│       │   │   ├── places.controller.js # handlers للأماكن
│       │   │   ├── places.repository.js # DB للأماكن/الصور/الخصائص
│       │   │   ├── places.routes.js # endpoints places
│       │   │   ├── places.schema.js # تحقق المدخلات
│       │   │   └── places.service.js # منطق حالات pending/active
│       │   ├── ratings/
│       │   │   ├── ratings.controller.js # handlers التقييمات
│       │   │   ├── ratings.repository.js # DB للتقييمات
│       │   │   ├── ratings.routes.js # endpoints ratings
│       │   │   ├── ratings.schema.js # تحقق المدخلات
│       │   │   └── ratings.service.js # منطق الأعمال + المتوسط
│       │   ├── storeProducts/
│       │   │   └── storeProducts.routes.js # endpoints المنتجات
│       │   ├── storeServices/
│       │   │   └── storeServices.routes.js # endpoints الخدمات
│       │   └── uploads/
│       │       ├── uploads.controller.js # استقبال رفع الصور
│       │       ├── uploads.routes.js # endpoints رفع
│       │       └── uploads.service.js # رفع Cloudinary + إرجاع URL
│       └── utils/
│           ├── ApiError.js # كلاس أخطاء API
│           ├── hash.js # تشفير/مطابقة كلمات المرور
│           ├── jwt.js # إنشاء/تحقق توكنات JWT
│           └── response.js # توحيد شكل الاستجابة
└── utils/
    ├── geofencing.ts # geofencing (موبايل)
    ├── geofencing.web.ts # stub لgeofencing (ويب)
    ├── notifications.ts # إشعارات (موبايل)
    ├── notifications.web.ts # stub للإشعارات (ويب)
    └── shadowStyles.ts # ظلال متوافقة
```

## هيكل قاعدة البيانات

> هذه الشجرة تمثل الجداول الفعلية في PostgreSQL (بعد تشغيل `npm run migrate:v1`).

### Extensions

| Extension | الهدف |
|---|---|
| `uuid-ossp` | دعم توليد UUID |
| `pgcrypto` | دعم وظائف تشفير/تجزئة |

### Users / Auth

<details>
<summary><code>users</code></summary>

| Column | DataType | Notes |
|---|---|---|
| `id` | `UUID` | PK, `DEFAULT gen_random_uuid()` |
| `name` | `VARCHAR(255)` | `NOT NULL` |
| `email` | `VARCHAR(255)` | `UNIQUE`, `NOT NULL` |
| `password_hash` | `VARCHAR(255)` | `NOT NULL` (bcrypt hash) |
| `is_admin` | `BOOLEAN` | legacy فقط (default `false`) |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` |
| `role` | `VARCHAR(20)` | `DEFAULT 'user'` (قيد: `admin|user|owner`) |
| `updated_at` | `TIMESTAMPTZ` | (v3) `DEFAULT now()` |
| `deleted_at` | `TIMESTAMPTZ` | (v3) nullable (حذف ناعم) |

</details>

<details>
<summary><code>app_settings</code></summary>

| Column | DataType | Notes |
|---|---|---|
| `key` | `VARCHAR(100)` | PK |
| `value` | `JSONB` | `NOT NULL` |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()` |

</details>

### Legacy (محتفظ بها للتوافق)

<details>
<summary><code>categories</code></summary>

| Column | DataType | Notes |
|---|---|---|
| `id` | `UUID` | PK |
| `name` | `VARCHAR(100)` | `UNIQUE` |
| `emoji` | `VARCHAR(10)` | (legacy) |
| `color` | `VARCHAR(7)` | (legacy) |
| `sort_order` | `INTEGER` | `DEFAULT 0` |

</details>

<details>
<summary><code>stores</code></summary>

| Column | DataType | Notes |
|---|---|---|
| `id` | `UUID` | PK |
| `name` | `VARCHAR(255)` | `NOT NULL` |
| `description` | `TEXT` | `NOT NULL` |
| `category_id` | `UUID` | FK -> `categories(id)` `ON DELETE RESTRICT` |
| `latitude` | `DECIMAL(10,7)` | `NOT NULL` |
| `longitude` | `DECIMAL(10,7)` | `NOT NULL` |
| `phone` | `VARCHAR(20)` | nullable |
| `photos` | `JSONB` | `DEFAULT '[]'` |
| `videos` | `JSONB` | `DEFAULT '[]'` |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` |
| `owner_id` | `UUID` | (v4) FK -> `users(id)` `ON DELETE SET NULL` |

</details>

<details>
<summary><code>place_requests</code></summary>

| Column | DataType | Notes |
|---|---|---|
| `id` | `UUID` | PK |
| `name` | `VARCHAR(255)` | `NOT NULL` |
| `description` | `TEXT` | `NOT NULL` |
| `category_id` | `UUID` | FK -> `categories(id)` `ON DELETE RESTRICT` |
| `latitude` | `DECIMAL(10,7)` | `NOT NULL` |
| `longitude` | `DECIMAL(10,7)` | `NOT NULL` |
| `phone` | `VARCHAR(20)` | nullable |
| `photos` | `JSONB` | `DEFAULT '[]'` |
| `videos` | `JSONB` | `DEFAULT '[]'` |
| `status` | `VARCHAR(20)` | `DEFAULT 'pending'` (check: `pending|accepted|rejected`) |
| `created_by` | `UUID` | FK -> `users(id)` `ON DELETE SET NULL` |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` |

</details>

<details>
<summary><code>reports</code></summary>

| Column | DataType | Notes |
|---|---|---|
| `id` | `UUID` | PK |
| `store_id` | `UUID` | FK -> `stores(id)` `ON DELETE CASCADE` |
| `reported_by` | `UUID` | FK -> `users(id)` `ON DELETE SET NULL` |
| `reason` | `VARCHAR(50)` | `NOT NULL` |
| `details` | `TEXT` | nullable |
| `status` | `VARCHAR(20)` | `DEFAULT 'pending'` (check: `pending|resolved|dismissed`) |
| `resolved_at` | `TIMESTAMPTZ` | nullable |
| `resolved_by` | `UUID` | FK -> `users(id)` `ON DELETE SET NULL` |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` |

</details>

<details>
<summary><code>activity_log</code></summary>

| Column | DataType | Notes |
|---|---|---|
| `id` | `UUID` | PK |
| `action` | `VARCHAR(50)` | `NOT NULL` |
| `entity_type` | `VARCHAR(50)` | `NOT NULL` |
| `entity_id` | `VARCHAR(100)` | nullable |
| `details` | `JSONB` | `DEFAULT '{}'` |
| `actor_name` | `VARCHAR(255)` | nullable |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` |

</details>

### Places (الهيكل الأساسي الحديث)

<details>
<summary><code>place_types</code></summary>

| Column | DataType | Notes |
|---|---|---|
| `id` | `UUID` | PK |
| `name` | `VARCHAR(100)` | `UNIQUE` |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()` |
| `emoji` | `VARCHAR(32)` | (v5) nullable |
| `color` | `VARCHAR(32)` | (v5) nullable |

</details>

<details>
<summary><code>places</code></summary>

| Column | DataType | Notes |
|---|---|---|
| `id` | `UUID` | PK |
| `name` | `VARCHAR(255)` | `NOT NULL` |
| `description` | `TEXT` | nullable |
| `type_id` | `UUID` | FK -> `place_types(id)` `ON DELETE SET NULL` |
| `created_by` | `UUID` | FK -> `users(id)` `ON DELETE SET NULL` |
| `status` | `VARCHAR(20)` | `DEFAULT 'active'` (check: `active|pending|rejected`) |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()` |
| `deleted_at` | `TIMESTAMPTZ` | nullable (حذف ناعم) |

</details>

<details>
<summary><code>place_locations</code></summary>

| Column | DataType | Notes |
|---|---|---|
| `place_id` | `UUID` | PK + FK -> `places(id)` `ON DELETE CASCADE` |
| `latitude` | `DECIMAL(10,7)` | `NOT NULL` |
| `longitude` | `DECIMAL(10,7)` | `NOT NULL` |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()` |

</details>

<details>
<summary><code>place_type_attribute_definitions</code></summary>

| Column | DataType | Notes |
|---|---|---|
| `id` | `UUID` | PK |
| `place_type_id` | `UUID` | FK -> `place_types(id)` `ON DELETE CASCADE` |
| `key` | `VARCHAR(100)` |  |
| `label` | `VARCHAR(255)` |  |
| `value_type` | `VARCHAR(20)` | `DEFAULT 'string'` (check: `string|number|boolean|json|date`) |
| `is_required` | `BOOLEAN` | `DEFAULT false` |
| `options` | `JSONB` | nullable |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()` |

</details>

<details>
<summary><code>place_attributes</code></summary>

| Column | DataType | Notes |
|---|---|---|
| `id` | `UUID` | PK |
| `place_id` | `UUID` | FK -> `places(id)` `ON DELETE CASCADE` |
| `key` | `VARCHAR(100)` |  |
| `value` | `TEXT` |  |
| `value_type` | `VARCHAR(20)` | `DEFAULT 'string'` (check: `string|number|boolean|json|date`) |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()` |

</details>

<details>
<summary><code>place_images</code></summary>

| Column | DataType | Notes |
|---|---|---|
| `id` | `UUID` | PK |
| `place_id` | `UUID` | FK -> `places(id)` `ON DELETE CASCADE` |
| `image_url` | `TEXT` | `NOT NULL` |
| `sort_order` | `INTEGER` | `DEFAULT 0` |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()` |

</details>

<details>
<summary><code>ratings</code></summary>

| Column | DataType | Notes |
|---|---|---|
| `id` | `UUID` | PK |
| `place_id` | `UUID` | FK -> `places(id)` `ON DELETE CASCADE` |
| `user_id` | `UUID` | FK -> `users(id)` `ON DELETE CASCADE` |
| `rating` | `INTEGER` | `NOT NULL` (check: `BETWEEN 1 AND 5`) |
| `comment` | `TEXT` | nullable |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()` |
| `deleted_at` | `TIMESTAMPTZ` | nullable (حذف ناعم) |

</details>

<details>
<summary><code>refresh_tokens</code></summary>

| Column | DataType | Notes |
|---|---|---|
| `id` | `UUID` | PK |
| `user_id` | `UUID` | FK -> `users(id)` `ON DELETE CASCADE` |
| `token_hash` | `VARCHAR(255)` | `NOT NULL` |
| `expires_at` | `TIMESTAMPTZ` | `NOT NULL` |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` |
| `revoked_at` | `TIMESTAMPTZ` | nullable |

</details>

### Commerce / Owner (v4)

<details>
<summary><code>store_services</code></summary>

| Column | DataType | Notes |
|---|---|---|
| `id` | `UUID` | PK |
| `store_id` | `UUID` | FK -> `stores(id)` `ON DELETE CASCADE` |
| `name` | `VARCHAR(255)` | `NOT NULL` |
| `description` | `TEXT` | nullable |
| `price` | `DECIMAL(10,2)` | nullable |
| `currency` | `VARCHAR(10)` | `DEFAULT 'ILS'` |
| `is_available` | `BOOLEAN` | `DEFAULT true` |
| `sort_order` | `INTEGER` | `DEFAULT 0` |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()` |

</details>

<details>
<summary><code>store_products</code></summary>

| Column | DataType | Notes |
|---|---|---|
| `id` | `UUID` | PK |
| `store_id` | `UUID` | FK -> `stores(id)` `ON DELETE CASCADE` |
| `name` | `VARCHAR(255)` | `NOT NULL` |
| `description` | `TEXT` | nullable |
| `price` | `DECIMAL(10,2)` | `NOT NULL` |
| `currency` | `VARCHAR(10)` | `DEFAULT 'ILS'` |
| `image_url` | `TEXT` | nullable |
| `stock` | `INTEGER` | `DEFAULT -1` |
| `is_available` | `BOOLEAN` | `DEFAULT true` |
| `sort_order` | `INTEGER` | `DEFAULT 0` |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()` |

</details>

<details>
<summary><code>orders</code></summary>

| Column | DataType | Notes |
|---|---|---|
| `id` | `UUID` | PK |
| `store_id` | `UUID` | FK -> `stores(id)` `ON DELETE CASCADE` |
| `user_id` | `UUID` | FK -> `users(id)` `ON DELETE CASCADE` |
| `status` | `VARCHAR(20)` | `DEFAULT 'pending'` (check: `pending|confirmed|completed|cancelled`) |
| `total` | `DECIMAL(10,2)` | `NOT NULL` (default `0`) |
| `currency` | `VARCHAR(10)` | `DEFAULT 'ILS'` |
| `notes` | `TEXT` | nullable |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()` |

</details>

<details>
<summary><code>order_items</code></summary>

| Column | DataType | Notes |
|---|---|---|
| `id` | `UUID` | PK |
| `order_id` | `UUID` | FK -> `orders(id)` `ON DELETE CASCADE` |
| `product_id` | `UUID` | FK -> `store_products(id)` `ON DELETE SET NULL` (nullable) |
| `product_name` | `VARCHAR(255)` | `NOT NULL` |
| `quantity` | `INTEGER` | `NOT NULL` (default `1`) |
| `unit_price` | `DECIMAL(10,2)` | `NOT NULL` |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` |

</details>

### شرح كل ملف (للمبتدئ)

#### 1) ملفات الجذر

- `README.md`: دليل المشروع الكامل (هذا الملف).
- `.env.example`: قالب متغيرات البيئة للواجهة الأمامية (`EXPO_PUBLIC_*`).
- `.gitignore`: يحدد الملفات/المجلدات التي لا تُرفع إلى Git.
- `package.json`: سكربتات ومكتبات تطبيق Expo (الواجهة).
- `package-lock.json`: قفل نسخ مكتبات npm للواجهة.
- `tsconfig.json`: إعدادات TypeScript.
- `app.json`: إعدادات Expo القياسية (اسم التطبيق/الأيقونات/المفاتيح).
- `app.config.js`: إعداد Expo الديناميكي (حسب البيئة عند الحاجة).
- `eslint.config.js`: قواعد فحص الكود (Lint).

#### 2) إعدادات المحرر

- `.vscode/extensions.json`: إضافات VS Code/Cursor الموصى بها.
- `.vscode/settings.json`: إعدادات المحرر الخاصة بهذا المشروع.

#### 3) الواجهة الأمامية - API

- `api/config.ts`: يحدد عنوان الخادم الأساسي (`API URL`) حسب البيئة.
- `api/client.ts`: عميل HTTP موحد؛ يدير التوكن، التحديث التلقائي (`refresh`) وكل استدعاءات API.

#### 4) الواجهة الأمامية - التوجيه والشاشات (`app/`)

- `app/_layout.tsx`: الجذر العام للتطبيق (Providers + Stack + تهيئة RTL للويب).
- `app/index.tsx`: شاشة البداية الذكية؛ توجه إلى `onboarding` أو `login` أو `map`.
- `app/onboarding.tsx`: شاشة الترحيب/الشرح الأولي للمستخدم الجديد.
- `app/(auth)/_layout.tsx`: Layout لمجموعة شاشات المصادقة.
- `app/(auth)/login.tsx`: شاشة تسجيل الدخول.
- `app/(auth)/register.tsx`: شاشة إنشاء حساب جديد.
- `app/(main)/_layout.tsx`: Layout لشاشات ما بعد تسجيل الدخول.
- `app/(main)/map.tsx`: الشاشة الأساسية (الخريطة، الفئات، إضافة مكان، المسارات، تفاصيل المكان).
- `app/(main)/admin.tsx`: لوحة الإدارة الرئيسية.
- `app/(main)/admin-stores.tsx`: إدارة الأماكن (عرض/تعديل/حذف).
- `app/(main)/admin-categories.tsx`: إدارة أنواع الأماكن.
- `app/(main)/admin-place-requests.tsx`: مراجعة طلبات الإضافة (`pending`).
- `app/(main)/admin-users.tsx`: إدارة المستخدمين والأدوار.
- `app/(main)/admin-reports.tsx`: إدارة البلاغات.
- `app/(main)/admin-settings.tsx`: إعدادات التطبيق العامة.
- `app/(main)/admin-activity.tsx`: سجل نشاط الإدارة.
- `app/(main)/owner-dashboard.tsx`: لوحة صاحب المتجر (الطلبات/الخدمات/المنتجات).

#### 5) الواجهة الأمامية - المكونات (`components/`)

- `components/AddPlaceModal.tsx`: نافذة إضافة مكان جديد (نماذج، حقول ديناميكية، صور).
- `components/ReportModal.tsx`: نافذة إرسال بلاغ عن مكان.
- `components/external-link.tsx`: مكون رابط خارجي متوافق مع المنصات.
- `components/haptic-tab.tsx`: زر/تبويب مع اهتزاز (Haptics) على الأجهزة المدعومة.
- `components/hello-wave.tsx`: مكون UI بسيط (تحريك/ترحيب).
- `components/parallax-scroll-view.tsx`: ScrollView بتأثير Parallax.
- `components/themed-text.tsx`: نص يدعم الثيم (داكن/فاتح).
- `components/themed-view.tsx`: View يدعم الثيم.
- `components/MapWrapper/index.tsx`: تغليف مكونات الخريطة للموبايل (`react-native-maps`).
- `components/MapWrapper/index.web.tsx`: تغليف الخريطة للويب (`@react-google-maps/api`/Leaflet حسب التنفيذ).
- `components/ui/collapsible.tsx`: عنصر واجهة قابل للطي/الفتح.
- `components/ui/icon-symbol.tsx`: أيقونات عامة عبر المنصات.
- `components/ui/icon-symbol.ios.tsx`: تنفيذ أيقونات مخصص لـ iOS.

#### 6) الواجهة الأمامية - الحالة العامة (`context/`)

- `context/AuthContext.tsx`: إدارة حالة المستخدم، تسجيل الدخول/الخروج، حفظ الجلسة.
- `context/CategoryContext.tsx`: تحميل/تخزين أنواع الأماكن على مستوى التطبيق.
- `context/StoreContext.tsx`: تحميل/إدارة الأماكن (stores/places) وتحديثها.
- `context/GoogleMapsLoaderContext.tsx`: تحميل مكتبة Google Maps وإدارة حالتها.
- `context/GoogleMapsLoaderContext.web.tsx`: نسخة ويب خاصة لتحميل Google Maps.

#### 7) الواجهة الأمامية - الثوابت (`constants/`)

- `constants/tulkarmRegion.ts`: مركز طولكرم وحدود/نطاق الخريطة.
- `constants/mapStyle.ts`: نمط الخريطة (مثل إخفاء POI).
- `constants/layout.ts`: ثوابت قياسات الواجهة (هوامش/ارتفاعات).
- `constants/theme.ts`: ألوان/ثيم التطبيق.
- `constants/categoryColors.ts`: ألوان افتراضية للفئات/الأنواع.

#### 8) الواجهة الأمامية - أدوات مساعدة (`utils/`)

- `utils/geofencing.ts`: منطق geofencing للموبايل (داخل/خارج حدود طولكرم).
- `utils/geofencing.web.ts`: بديل ويب لمنطق geofencing.
- `utils/notifications.ts`: تهيئة وإرسال إشعارات للموبايل.
- `utils/notifications.web.ts`: بديل ويب للإشعارات.
- `utils/shadowStyles.ts`: توحيد أنماط الظلال بين iOS/Android/Web.

#### 9) الواجهة الأمامية - Hooks

- `hooks/use-color-scheme.ts`: قراءة نظام الألوان (فاتح/داكن) على الموبايل.
- `hooks/use-color-scheme.web.ts`: قراءة نظام الألوان على الويب.
- `hooks/use-theme-color.ts`: إرجاع لون مناسب حسب الثيم.

#### 10) الواجهة الأمامية - سكربتات وموارد

- `scripts/reset-project.js`: سكربت لإعادة ضبط مشروع Expo (تنظيف/تهيئة).
- `assets/images/icon.png`: أيقونة التطبيق الأساسية.
- `assets/images/adaptive-icon.png`: أيقونة Android adaptive.
- `assets/images/splash-icon.png`: صورة شاشة الإقلاع.
- `assets/images/favicon.png`: أيقونة المتصفح للويب.

#### 11) الخادم (`server/`) - ملفات الجذر

- `server/package.json`: تبعيات وسكربتات الخادم.
- `server/package-lock.json`: قفل تبعيات الخادم.
- `server/.env.example`: قالب متغيرات بيئة الخادم (DB/JWT/Cloudinary).
- `server/index.js`: نقطة دخول للتشغيل/التوافق (يوجه لتطبيق الخادم).
- `server/index.legacy.js`: نقطة دخول قديمة للتوافق مع نشر/بنية سابقة.
- `server/db.js`: جسر/مدخل قديم للاتصال بقاعدة البيانات.

#### 12) الخادم - سكربتات قاعدة البيانات

- `server/scripts/migrate-v1.js`: سكربت موحّد شامل (init-db + v2..v8 + seed + دعم حذف اختياري لـ `place_requests`).

#### 13) الخادم - النواة (`server/src/`)

- `server/src/server.js`: تشغيل الخادم (`listen`) بعد التحقق من اتصال قاعدة البيانات.
- `server/src/app.js`: إعداد Express وربط جميع المسارات والميدل وير.
- `server/src/legacy-bridge.js`: جسر توافق بين البنية القديمة والجديدة.

#### 14) الخادم - الإعدادات

- `server/src/config/env.js`: تحميل/تحقق متغيرات البيئة.
- `server/src/config/db.js`: إنشاء Pool اتصال PostgreSQL.

#### 15) الخادم - Middleware

- `server/src/middleware/auth.middleware.js`: يتحقق من JWT ويثبت المستخدم في الطلب.
- `server/src/middleware/role.middleware.js`: يتحقق من الصلاحيات (مثل admin).
- `server/src/middleware/validate.middleware.js`: يطبّق التحقق عبر Zod schemas.
- `server/src/middleware/error.middleware.js`: معالجة أخطاء 404 والأخطاء العامة.

#### 16) الخادم - وحدات الأعمال (Modules)

**auth**
- `server/src/modules/auth/auth.routes.js`: مسارات المصادقة.
- `server/src/modules/auth/auth.controller.js`: يستقبل الطلبات ويرجع الاستجابات.
- `server/src/modules/auth/auth.service.js`: منطق الأعمال (register/login/refresh/logout).
- `server/src/modules/auth/auth.repository.js`: استعلامات قاعدة البيانات الخاصة بالمستخدمين/التوكن.
- `server/src/modules/auth/auth.schema.js`: مخططات التحقق لطلبات المصادقة.

**placeTypes**
- `server/src/modules/placeTypes/placeTypes.routes.js`: مسارات أنواع الأماكن.
- `server/src/modules/placeTypes/placeTypes.controller.js`: تحكم API لأنواع الأماكن.
- `server/src/modules/placeTypes/placeTypes.service.js`: قواعد الأعمال لأنواع الأماكن.
- `server/src/modules/placeTypes/placeTypes.repository.js`: استعلامات DB لأنواع الأماكن وخصائصها.
- `server/src/modules/placeTypes/placeTypes.schema.js`: تحقق الإدخال لأنواع الأماكن.

**places**
- `server/src/modules/places/places.routes.js`: مسارات الأماكن (CRUD + صور + ملكية).
- `server/src/modules/places/places.controller.js`: طبقة التحكم لعمليات الأماكن.
- `server/src/modules/places/places.service.js`: المنطق الرئيسي للأماكن (حالات pending/active/rejected).
- `server/src/modules/places/places.repository.js`: استعلامات DB للأماكن، المواقع، الصور، الخصائص.
- `server/src/modules/places/places.schema.js`: التحقق من طلبات إنشاء/تعديل الأماكن.

**ratings**
- `server/src/modules/ratings/ratings.routes.js`: مسارات التقييمات.
- `server/src/modules/ratings/ratings.controller.js`: طبقة التحكم للتقييمات.
- `server/src/modules/ratings/ratings.service.js`: منطق الأعمال للتقييمات ومتوسطات التقييم.
- `server/src/modules/ratings/ratings.repository.js`: استعلامات DB للتقييمات.
- `server/src/modules/ratings/ratings.schema.js`: تحقق الإدخال لطلبات التقييم.

**uploads**
- `server/src/modules/uploads/uploads.routes.js`: مسارات رفع الصور.
- `server/src/modules/uploads/uploads.controller.js`: استقبال ومعالجة طلبات الرفع.
- `server/src/modules/uploads/uploads.service.js`: رفع فعلي إلى Cloudinary وإرجاع الرابط.

**orders**
- `server/src/modules/orders/orders.routes.js`: مسارات الطلبات (إنشاء طلب/تتبع/تحديث الحالة).

**storeServices**
- `server/src/modules/storeServices/storeServices.routes.js`: مسارات خدمات المتاجر.

**storeProducts**
- `server/src/modules/storeProducts/storeProducts.routes.js`: مسارات منتجات المتاجر.

**admin**
- `server/src/modules/admin/admin.routes.js`: مسارات الإدارة (stats/users/reports/settings/activity/ownership).

#### 17) الخادم - أدوات مساعدة

- `server/src/utils/ApiError.js`: كلاس موحّد لأخطاء API مع status code.
- `server/src/utils/hash.js`: دوال تشفير/مطابقة كلمات المرور.
- `server/src/utils/jwt.js`: إنشاء/التحقق من access و refresh tokens.
- `server/src/utils/response.js`: توحيد شكل الاستجابة الناجحة/الفاشلة.

---

## سير عمل إضافة مكان

1. المستخدم المسجّل ينقر على نقطة فارغة في خريطة طولكرم.
2. يظهر **AddPlaceModal**: اسم، نوع المكان، وصف، صور.
3. يُرسل الطلب إلى `POST /api/places` بحالة `pending`.
4. المدير يراجع الطلب في **admin-place-requests**:
   - **قبول** → تتغير الحالة إلى `active` ويظهر على الخريطة.
   - **رفض** → تتغير الحالة إلى `rejected`.

---

## مصادر إضافية

- [Expo Documentation](https://docs.expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [React Native Maps](https://github.com/react-native-maps/react-native-maps)
- [Neon PostgreSQL](https://neon.tech)
- [Cloudinary](https://cloudinary.com)
- [Discord مجتمع Expo](https://chat.expo.dev)

---

المشروع مفتوح المصدر. نرحب بالمساهمات! 🚀
