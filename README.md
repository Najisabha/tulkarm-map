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
npm run init-db

# إضافة الجداول الموسّعة (place_types، places، ratings، refresh_tokens، ...)
npm run migrate:v3

# إضافة جدول admin_logs وتحسينات
npm run migrate:v4

# إضافة أعمدة emoji و color لـ place_types
npm run migrate:v5
```

> يمكن تشغيل الهجرات من جذر المشروع أيضاً:
> ```bash
> npm run migrate:v3   # أو v4 أو v5
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
| `migrate:v2` / `init-db` | جداول `users`, `categories`, `stores`, `place_requests` |
| `migrate:v3` | `place_types`, `places`, `place_locations`, `place_attributes`, `place_images`, `ratings`, `refresh_tokens`, `place_type_attribute_definitions` — مع ترحيل البيانات من الجداول القديمة |
| `migrate:v4` | `admin_logs`, أعمدة `owner_id` في `places` |
| `migrate:v5` | أعمدة `emoji` و `color` في `place_types` |

> الهجرات آمنة للتشغيل أكثر من مرة (`IF NOT EXISTS`). الجداول القديمة **لا تُحذف**.

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
   npm run migrate:v3 && npm run migrate:v4 && npm run migrate:v5
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
| `/(main)/admin-backup` | `admin-backup.tsx` | النسخ الاحتياطي |
| `/(main)/owner-dashboard` | `owner-dashboard.tsx` | لوحة مالك المكان |

---

## هيكل الملفات

```
tulkarm-map/
├── app/
│   ├── (auth)/          # تسجيل الدخول والتسجيل
│   ├── (main)/          # الشاشات الرئيسية
│   ├── index.tsx        # التوجيه الأولي
│   └── onboarding.tsx   # شاشة الترحيب
├── api/
│   └── client.ts        # عميل HTTP الموحّد (JWT + refresh + جميع endpoints)
├── components/
│   ├── AddPlaceModal.tsx # نموذج إضافة مكان
│   ├── ReportModal.tsx   # نموذج إبلاغ
│   └── MapWrapper/      # مجلّد: index.tsx (موبايل) + index.web.tsx (ويب)
├── context/
│   ├── AuthContext.tsx   # المصادقة + JWT
│   ├── StoreContext.tsx  # تحميل الأماكن من API
│   └── CategoryContext.tsx # تحميل أنواع الأماكن من API
├── constants/
│   ├── tulkarmRegion.ts  # إحداثيات مركز طولكرم
│   ├── categoryColors.ts # 12 لوناً مسبق
│   └── mapStyle.ts       # إخفاء POIs من Google Maps
├── utils/
│   ├── geofencing.ts     # حدود طولكرم + إشعارات (موبايل)
│   ├── geofencing.web.ts # stub للويب
│   └── shadowStyles.ts   # ظلال متوافقة
└── server/
    ├── src/
    │   ├── app.js        # Express app + كل الـ routes
    │   ├── server.js     # نقطة الدخول (listen)
    │   ├── config/       # db.js، env.js
    │   ├── middleware/   # auth، role، validate، error
    │   ├── modules/      # auth، places، placeTypes، ratings، uploads، orders، admin
    │   └── utils/        # ApiError، jwt، hash، response
    ├── scripts/
    │   ├── migrate-v3.js
    │   ├── migrate-v4.js
    │   └── migrate-v5.js
    ├── index.js          # يستورد src/server.js (للتوافق مع Vercel القديم)
    └── package.json
```

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
