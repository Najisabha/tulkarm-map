# طولكرم — دليل مدينة طولكرم على الخريطة 🏙️

تطبيق خريطة تفاعلية لمدينة طولكرم يستكشف المتاجر والمطاعم والخدمات. يعمل على **Expo / React Native** ويدعم **الموبايل والويب**. المشروع مفتوح المصدر ويمكن لأي مطوّر المساهمة في تطويره.

---

## جدول المحتويات

- [البدء](#البدء)
- [ربط PostgreSQL](#ربط-postgresql)
- [Google Maps API](#google-maps-api)
- [نظرة عامة على المشروع](#نظرة-عامة-على-المشروع)
- [التوجيه (Routing)](#التوجيه-routing)
- [الفرق بين الموبايل والويب](#الفرق-بين-الموبايل-والويب)
- [قاعدة البيانات والتخزين](#قاعدة-البيانات-والتخزين)
- [صلاحيات الأطراف](#صلاحيات-الأطراف)
- [هيكل الملفات](#هيكل-الملفات)
- [سير عمل طلب إضافة مكان](#سير-عمل-طلب-إضافة-مكان)
- [نماذج البيانات](#نماذج-البيانات)
- [الملفات والتكوينات الإضافية](#الملفات-والتكوينات-الإضافية)
- [مصادر إضافية](#مصادر-إضافية)

---

## البدء

1. تثبيت الاعتماديات

   ```bash
   npm install
   ```

2. تشغيل التطبيق

   ```bash
   npx expo start
   ```

في المخرجات ستجد خيارات فتح التطبيق عبر:

- [Development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go)
- الويب: `npx expo start --web`

---

## ربط PostgreSQL

المشروع يدعم الاتصال بقاعدة بيانات **PostgreSQL** عبر خادم API. اتبع الخطوات التالية:

### 1. إعداد قاعدة البيانات

تأكد أن لديك:
- **PostgreSQL** مثبتاً ومُشغَّلاً (مثل pgAdmin الذي لديك)
- قاعدة بيانات باسم `tulkarm-map` (أنشئها من pgAdmin إن لم تكن موجودة)

### 2. تشغيل الخادم (Backend)

```bash
cd server
npm install
```

أنشئ ملف `.env` داخل مجلد `server`:

```bash
# انسخ المثال
copy .env.example .env   # Windows
# أو
cp .env.example .env    # Mac/Linux
```

عدّل ملف `.env` وضع كلمة مرور PostgreSQL الخاصة بك:

```
DATABASE_URL=postgresql://postgres:كلمة_المرور@localhost:5432/tulkarm-map
PORT=3000
```

ثم شغّل تهيئة الجداول والبيانات الافتراضية:

```bash
npm run init-db
```

ثم شغّل الخادم:

```bash
npm start
```

يجب أن ترى: `✅ متصل بـ PostgreSQL` و `🚀 الخادم يعمل على http://localhost:3000`

### 3. تفعيل الاتصال في التطبيق

في **جذر المشروع** (وليس داخل server)، أنشئ ملف `.env`:

```bash
copy .env.example .env   # Windows
```

عدّل المحتوى:

```
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_USE_API=true
```

> **لجهاز Android محاكي:** استخدم `http://10.0.2.2:3000` بدل localhost  
> **لجهاز حقيقي:** استخدم IP جهازك (مثل `http://192.168.1.5:3000`)

### 4. تشغيل التطبيق

```bash
npx expo start
```

سيتصل التطبيق الآن بـ PostgreSQL عبر الخادم. حساب المدير الافتراضي: `admin@tulkarm.com` / `admin123`

---

## Google Maps API

التطبيق يستخدم Google Maps ويخفي POIs المدمجة لعرض أماكنك المخصصة فقط. للتفعيل:

1. أنشئ مشروعاً في [Google Cloud](https://console.cloud.google.com) وفعّل **Maps SDK for Android** و **Maps SDK for iOS**.
2. أنشئ مفاتيح API (واحد لـ Android وواحد لـ iOS) من Credentials.
3. في `app.json` استبدل `YOUR_ANDROID_GOOGLE_MAPS_API_KEY` و `YOUR_IOS_GOOGLE_MAPS_API_KEY` بمفاتيحك.
4. أعد بناء التطبيق الأصلي (Expo Go يستخدم خرائطه الخاصة؛ الـ development build مطلوب لاستخدام مفاتيحك).

> **ملاحظة:** نسخة الويب تستخدم OpenStreetMap embed بدلاً من Google Maps.

---

## نظرة عامة على المشروع

- **قاعدة البيانات:** PostgreSQL (مدعومة عبر خادم API في مجلد `server/`).
- **التخزين الافتراضي:** محلي عبر AsyncStorage؛ فعّل `EXPO_PUBLIC_USE_API=true` للاتصال بـ PostgreSQL.
- **المصادقة:** مستخدمين محليين + زائر + مدير افتراضي.
- **الخريطة:** Google Maps على الموبايل، OpenStreetMap على الويب.
- **Geofencing:** إشعارات الدخول/الخروج عند محافظة طولكرم (موبايل فقط، يتطلب development build).

---

## التوجيه (Routing)

يستخدم المشروع **expo-router** مع التوجيه القائم على الملفات:

| المسار | الملف المُحمَّل | الشرح |
|--------|-----------------|-------|
| `/` | `app/index.tsx` | نقطة البداية: يتحقق من `onboarding_seen` ويوجّه إلى onboarding أو login أو map |
| `/onboarding` | `app/onboarding.tsx` | شاشة الترحيب (3 شرائح) |
| `/(auth)/login` | `app/(auth)/login.tsx` | تسجيل الدخول |
| `/(auth)/register` | `app/(auth)/register.tsx` | إنشاء حساب |
| `/(main)/map` | `map.tsx` (موبايل) / `map.web.tsx` (ويب) | الخريطة — يتم اختيار الملف حسب المنصة تلقائياً |
| `/(main)/admin` | `admin.tsx` (موبايل) / `admin.web.tsx` (ويب) | لوحة الإدارة |
| `/(main)/admin-stores` | `admin-stores.tsx` | إدارة المتاجر |
| `/(main)/admin-categories` | `admin-categories.tsx` | إدارة الفئات |
| `/(main)/admin-place-requests` | `admin-place-requests.tsx` | إدارة طلبات الأماكن |

---

## الفرق بين الموبايل والويب

| الميزة | الموبايل | الويب |
|--------|----------|-------|
| الخريطة | Google Maps (react-native-maps) | OpenStreetMap iframe |
| موقع المستخدم | ✅ GPS | ❌ غير متاح |
| المسافة للأماكن | ✅ تُعرض | ❌ لا تُعرض |
| Geofencing | ✅ إشعارات دخول/خروج | ❌ غير مدعوم |
| إضافة مكان | النقر على الخريطة | زر "اقترح مكاناً" (إحداثيات ثابتة) |
| تعديل/حذف المتجر (أدمن) | ✅ | ✅ |

---

## قاعدة البيانات والتخزين

### قاعدة البيانات: PostgreSQL

قاعدة بيانات المشروع المخططة والمعتمدة هي **PostgreSQL**.  
> ⚠️ **حالياً:** لا يتم استخدام أي قاعدة بيانات في المشروع. كل البيانات تُخزَّن محلياً في **AsyncStorage** على الجهاز. هذا القسم يوضح تصميم قاعدة البيانات عند ربط المشروع بخادم وPostgreSQL لاحقاً.

---

### التخزين الحالي (AsyncStorage)

| المفتاح | المحتوى | ملاحظة |
|---------|---------|--------|
| `users` | قائمة المستخدمين (مسجلين + مدير افتراضي) | سيصبح جدول `users` |
| `currentUser` | المستخدم الحالي المُسجّل دخوله | خاص بالعميل (session)، لا يُخزَّن في قاعدة البيانات |
| `stores` | قائمة المتاجر والأماكن المعتمدة | سيصبح جدول `stores` |
| `place_requests` | طلبات إضافة أماكن من المستخدمين | سيصبح جدول `place_requests` |
| `categories` | الفئات (تسوق، مطاعم، صحة، إلخ) | سيصبح جدول `categories` |
| `onboarding_seen` | هل تم عرض شاشة الترحيب | يبقى في العميل فقط |
| `stores_legacy_seed_cleared` | تنظيف بيانات تجريبية قديمة | داخلي، يمكن تجاهله عند الترحيل |

---

### مخطط PostgreSQL (عند التطبيق)

#### جدول `users`
| العمود | النوع | القيود | الشرح |
|--------|-------|--------|-------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | معرّف فريد للمستخدم |
| `name` | VARCHAR(255) | NOT NULL | الاسم الكامل |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | البريد الإلكتروني |
| `password_hash` | VARCHAR(255) | NOT NULL | كلمة المرور مُشَفَّرة (مثل bcrypt) |
| `is_admin` | BOOLEAN | DEFAULT false | هل المستخدم مديراً |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | تاريخ الإنشاء |

> **ملاحظة:** في التطبيق الحالي تُخزَّن كلمة المرور كنص صريح في AsyncStorage. في PostgreSQL يُفضَّل استخدام `password_hash` مع bcrypt أو argon2.

---

#### جدول `categories`
| العمود | النوع | القيود | الشرح |
|--------|-------|--------|-------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | معرّف الفئة |
| `name` | VARCHAR(100) | UNIQUE, NOT NULL | اسم الفئة (تسوق، مطاعم، إلخ) |
| `emoji` | VARCHAR(10) | NOT NULL | إيموجي الفئة |
| `color` | VARCHAR(7) | NOT NULL | اللون بصيغة HEX (#2E86AB) |
| `sort_order` | INTEGER | DEFAULT 0 | ترتيب العرض (اختياري) |

**الفئات الافتراضية:** تسوق، مطاعم، صحة، خدمات، ترفيه، تعليم.

---

#### جدول `stores`
| العمود | النوع | القيود | الشرح |
|--------|-------|--------|-------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | معرّف المتجر |
| `name` | VARCHAR(255) | NOT NULL | اسم المكان |
| `description` | TEXT | NOT NULL | الوصف |
| `category_id` | UUID | FOREIGN KEY → categories(id) | ربط بالفئة |
| `latitude` | DECIMAL(10,7) | NOT NULL | خط العرض |
| `longitude` | DECIMAL(10,7) | NOT NULL | خط الطول |
| `phone` | VARCHAR(20) | | رقم الهاتف |
| `photos` | JSONB / TEXT[] | | مصفوفة روابط الصور |
| `videos` | JSONB / TEXT[] | | مصفوفة روابط الفيديو |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | تاريخ الإضافة |

**فهرس مكاني (اختياري):** إنشاء index على `(latitude, longitude)` للبحث القريب.

---

#### جدول `place_requests`
| العمود | النوع | القيود | الشرح |
|--------|-------|--------|-------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | معرّف الطلب |
| `name` | VARCHAR(255) | NOT NULL | اسم المكان |
| `description` | TEXT | NOT NULL | الوصف |
| `category_id` | UUID | FOREIGN KEY → categories(id) | ربط بالفئة |
| `latitude` | DECIMAL(10,7) | NOT NULL | خط العرض |
| `longitude` | DECIMAL(10,7) | NOT NULL | خط الطول |
| `phone` | VARCHAR(20) | | رقم الهاتف |
| `photos` | JSONB / TEXT[] | | مصفوفة روابط الصور |
| `videos` | JSONB / TEXT[] | | مصفوفة روابط الفيديو |
| `status` | VARCHAR(20) | CHECK IN ('pending','accepted','rejected'), DEFAULT 'pending' | حالة الطلب |
| `created_by` | UUID | FOREIGN KEY → users(id), NULL | من أرسل الطلب (NULL للزائر) |
| `reviewed_by` | UUID | FOREIGN KEY → users(id), NULL | من راجع الطلب (مدير) |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | تاريخ الإرسال |
| `reviewed_at` | TIMESTAMPTZ | | تاريخ المراجعة |

---

### العلاقات بين الجداول

```
users
  ├── place_requests (created_by) — من أرسل الطلب
  └── place_requests (reviewed_by) — من راجع الطلب

categories
  ├── stores (category_id)
  └── place_requests (category_id)

stores ← تُنشأ من place_requests عند القبول
```

---

### صلاحيات الوصول (عند استخدام PostgreSQL)

| الجدول | الزائر | المستخدم | المدير |
|--------|--------|----------|--------|
| `users` | — | قراءة سجلته فقط | قراءة/تعديل (بحدود آمنة) |
| `categories` | قراءة | قراءة | قراءة + إدراج + تحديث + حذف |
| `stores` | قراءة | قراءة | قراءة + إدراج + تحديث + حذف |
| `place_requests` | إدراج فقط | إدراج + قراءة طلباته | قراءة + قبول + رفض + تعديل + حذف |

يمكن تطبيق هذه القواعد عبر **Row Level Security (RLS)** أو **سياسات في طبقة التطبيق (API)**.

---

### الترحيل من AsyncStorage إلى PostgreSQL

عند إضافة خادم وربط PostgreSQL:

1. إنشاء جداول `users`, `categories`, `stores`, `place_requests` كما في المخطط.
2. استبدال استدعاءات AsyncStorage في `AuthContext`, `StoreContext`, `CategoryContext` باستدعاءات API (REST أو GraphQL).
3. إنشاء واجهات API على الخادم (Node.js/Express، Next.js API Routes، Supabase، إلخ).
4. تخزين كلمات المرور بشكل آمن (hashing) في قاعدة البيانات.
5. الاعتماد على JWT أو sessions للمصادقة بدل تخزين `currentUser` محلياً فقط.

---

## صلاحيات الأطراف

### 1. الزائر (دخول كضيف)

| الصلاحية | التفاصيل |
|----------|----------|
| عرض الخريطة | ✅ مع جميع المتاجر |
| التصفية حسب الفئة | ✅ |
| عرض تفاصيل المكان | ✅ |
| إضافة مكان | ✅ يُرسل طلباً للأدمن للموافقة |
| التوجه للمكان | ✅ عبر Google Maps |
| إشعارات الدخول/الخروج | ✅ (موبايل فقط) |
| تعديل/حذف المتاجر | ❌ |
| لوحة الإدارة | ❌ |

### 2. المستخدم المسجّل

نفس صلاحيات الزائر، مع تسجيل دخول بحساب خاص.

### 3. المدير (`isAdmin: true`)

| الصلاحية | التفاصيل |
|----------|----------|
| كل صلاحيات الزائر/المستخدم | ✅ |
| لوحة الإدارة | ✅ |
| إضافة متجر مباشرة | ✅ |
| تعديل المتاجر | ✅ |
| حذف المتاجر | ✅ |
| إدارة الفئات | ✅ إضافة/تعديل/حذف |
| طلبات الأماكن | ✅ قبول/رفض/تعديل/حذف |
| تعديل المتجر من الخريطة | ✅ من نافذة التفاصيل |

**حساب المدير الافتراضي:**
- البريد: `admin@tulkarm.com`
- كلمة المرور: `admin123`

---

## هيكل الملفات

### `app/`

| الملف | الوظيفة التفصيلية |
|-------|-------------------|
| `_layout.tsx` | التخطيط الجذر؛ يضم AuthProvider، CategoryProvider، StoreProvider؛ يستدعي `setupNotificationHandler` |
| `index.tsx` | يقرأ `onboarding_seen` و `currentUser`؛ يوجّه إلى onboarding إن لم يُشاهد، وإلى map إن كان مسجلاً، وإلى login إن لم يكن |
| `onboarding.tsx` | 3 شرائح تعريفية + أزرار تسجيل دخول / إنشاء حساب / دخول كضيف |

### `app/(auth)/`

| الملف | الوظيفة التفصيلية |
|-------|-------------------|
| `_layout.tsx` | Stack للمسارات login و register |
| `login.tsx` | نموذج بريد وكلمة مرور، زر زائر، رابط للتسجيل؛ يتحقق من المستخدمين في AsyncStorage |
| `register.tsx` | نموذج اسم، بريد، كلمة مرور، تأكيد؛ يتحقق من صحة البريد وعدم التكرار |

### `app/(main)/`

| الملف | الوظيفة التفصيلية |
|-------|-------------------|
| `_layout.tsx` | Stack للمسارات: map، admin، admin-stores، admin-categories، admin-place-requests |
| `map.tsx` | خريطة تفاعلية، موقع المستخدم، geofencing، إضافة مكان بالنقر، تصفية بالفئة، تفاصيل المتجر، تعديل/حذف للأدمن، إعادة توجيه للموقع |
| `map.web.tsx` | iframe لـ OpenStreetMap، تصفية بالفئة، قائمة المتاجر، تفاصيل المتجر، تعديل/حذف للأدمن، زر "اقترح مكاناً" |
| `admin.tsx` | لوحة إحصائيات (عدد المتاجر، الفئات، طلبات الانتظار) مع روابط للصفحات الفرعية |
| `admin.web.tsx` | نفس لوحة الإدارة للويب |
| `admin-stores.tsx` | قائمة المتاجر، إضافة، تعديل، حذف؛ يتحقق من صلاحية الأدمن |
| `admin-categories.tsx` | قائمة الفئات، إضافة، تعديل، حذف؛ يحدّث المتاجر وطلبات الأماكن عند تغيير اسم الفئة |
| `admin-place-requests.tsx` | قائمة الطلبات مع فلتر (قيد الانتظار/مقبول/مرفوض)، قبول/رفض/تعديل/حذف |

### `context/`

| الملف | الوظيفة التفصيلية |
|-------|-------------------|
| `AuthContext.tsx` | users في AsyncStorage؛ مدير افتراضي (admin@tulkarm.com)؛ login، register، loginAsGuest، logout |
| `StoreContext.tsx` | stores و place_requests؛ addStore، updateStore، deleteStore؛ addPlaceRequest، acceptPlaceRequest، rejectPlaceRequest؛ تحديث الفئات عند تغيير الاسم |
| `CategoryContext.tsx` | categories مع 6 فئات افتراضية؛ addCategory، updateCategory، deleteCategory؛ لا يسمح بحذف آخر فئة |

### `components/`

| الملف | الوظيفة التفصيلية |
|-------|-------------------|
| `AddPlaceModal.tsx` | نموذج: اسم، وصف، فئة، هاتف، حتى 3 صور، حتى 1 فيديو؛ اختيار الصور والفيديو من المعرض (غير متاح على الويب) |
| `MapWrapper/index.tsx` | تصدير MapView، Marker، Circle، PROVIDER_GOOGLE من react-native-maps |
| `MapWrapper/index.web.tsx` | placeholder عند استيراد MapWrapper على الويب (لا يُستخدم لأن map.web.tsx يستخدم iframe مباشرة) |

### `utils/`

| الملف | الوظيفة التفصيلية |
|-------|-------------------|
| `geofencing.ts` | حدود طولكرم (TULKARM_BOUNDS)، منطقة geofencing (TULKARM_REGION)، إشعارات دخول/خروج؛ لا يعمل على Expo Go |
| `geofencing.web.ts` | TULKARM_BOUNDS، TULKARM_REGION، isInsideTulkarm؛ دوال geofencing فارغة (غير مدعومة على الويب) |
| `notifications.ts` | setupNotificationHandler لعارض الإشعارات |
| `notifications.web.ts` | دوال فارغة (الإشعارات غير مدعومة على الويب) |
| `shadowStyles.ts` | دالة shadow() لأنماط ظلال متوافقة مع الموبايل والويب |

### `constants/`

| الملف | الوظيفة التفصيلية |
|-------|-------------------|
| `tulkarmRegion.ts` | إحداثيات مركز طولكرم (32.327, 35.088) |
| `categoryColors.ts` | مصفوفة PRESET_COLORS (12 لوناً) لاختيار ألوان الفئات |
| `mapStyle.ts` | MAP_STYLE_NO_POI — يخفي كل POIs المدمجة في Google Maps (صيدليات، بنوك، مطاعم افتراضية، إلخ) لعرض أماكنك فقط |

---

## سير عمل طلب إضافة مكان

1. **المستخدم/الزائر** ينقر على نقطة داخل طولكرم (موبايل) أو يضغط "اقترح مكاناً" (ويب).
2. يظهر **AddPlaceModal** لملء: الاسم، الوصف، الفئة، الهاتف، صور، فيديو.
3. يُرسل الطلب عبر `addPlaceRequest` → يُحفظ كـ **PlaceRequest** بحالة `pending`.
4. **المدير** يفتح لوحة طلبات الأماكن، يراجع الطلب، ويختار:
   - **قبول** → يُنشأ Store جديد ويُضاف للخريطة، وتُحدَّث حالة الطلب إلى `accepted`.
   - **رفض** → تُحدَّث الحالة إلى `rejected`.
   - **تعديل** → يُعدّل بيانات الطلب قبل القبول.

---

## نماذج البيانات

### User
```typescript
{ id, name, email, password, isAdmin, createdAt }
```

### Store
```typescript
{ id, name, description, category, latitude, longitude, phone?, photos?, videos?, createdAt }
```

### PlaceRequest
```typescript
{ id, name, description, category, latitude, longitude, phone?, photos?, videos?, status: 'pending'|'accepted'|'rejected', createdAt }
```

### Category
```typescript
{ id, name, emoji, color }
```

---

## الملفات والتكوينات الإضافية

### `app.json`
- اسم التطبيق، bundleIdentifier، أذونات الموقع (عند الاستخدام، دائم، في الخلفية)
- مفاتيح Google Maps لـ iOS و Android
- إعدادات expo-router، expo-location، expo-notifications، expo-image-picker، expo-splash-screen
- صور: icon، adaptive-icon، favicon، splash-icon

### `assets/images/`
| الملف | الاستخدام |
|-------|-----------|
| `icon.png` | أيقونة التطبيق |
| `adaptive-icon.png` | أيقونة Android التكيفية |
| `favicon.png` | أيقونة المتصفح للويب |
| `splash-icon.png` | شاشة البداية |

### ملفات التكوين
| الملف | الوظيفة |
|-------|---------|
| `package.json` | الاعتماديات والسكربتات (start، android، ios، web، lint) |
| `tsconfig.json` | إعدادات TypeScript |
| `eslint.config.js` | إعدادات ESLint |

### `scripts/reset-project.js`
> ⚠️ **تحذير:** سكربت قالب Expo لإعادة ضبط المشروع. **لا تشغّله** — سينقل أو يحذف مجلدات app و components و constants ويعيد إنشاء مشروع فارغ.

### ملفات قالب Expo غير مستخدمة
الملفات التالية من قالب `create-expo-app` ولا يُستدعَى أي منها من شاشات التطبيق الرئيسية؛ يمكن حذفها إن أردت تبسيط المشروع:
- `components/themed-text.tsx`, `themed-view.tsx`
- `components/parallax-scroll-view.tsx`, `external-link.tsx`, `hello-wave.tsx`, `haptic-tab.tsx`
- `components/ui/icon-symbol.tsx`, `icon-symbol.ios.tsx`, `collapsible.tsx`
- `hooks/use-theme-color.ts`, `use-color-scheme.ts`, `use-color-scheme.web.ts`
- `constants/theme.ts`

---

## مصادر إضافية

- [Expo Documentation](https://docs.expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [React Native Maps](https://github.com/react-native-maps/react-native-maps)
- [Discord مجتمع Expo](https://chat.expo.dev)

---

المشروع مفتوح المصدر. نرحب بالمساهمات! 🚀
