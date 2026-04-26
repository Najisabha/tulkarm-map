/**
 * مصدر واحد لمخطط قاعدة البيانات النهائي (idempotent).
 * شغّل: npm run migrate --prefix server
 */
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function ensureComplexesAndPhoneSchema() {
  // 1) رقم الهاتف مباشرة على places (كان في attributes فقط)
  await pool.query(`
    ALTER TABLE places ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30);
  `);

  // 2) جدول المجمعات (سكني / تجاري)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS complexes (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      place_id     UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
      complex_type VARCHAR(20) NOT NULL DEFAULT 'residential'
                   CHECK (complex_type IN ('residential','commercial')),
      floors_count   INTEGER NOT NULL DEFAULT 1,
      units_per_floor INTEGER NOT NULL DEFAULT 1,
      created_at   TIMESTAMPTZ DEFAULT now(),
      updated_at   TIMESTAMPTZ DEFAULT now(),
      CONSTRAINT complexes_place_unique UNIQUE (place_id)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_complexes_place ON complexes(place_id);
  `);

  // 3) جدول وحدات المجمعات
  await pool.query(`
    CREATE TABLE IF NOT EXISTS complex_units (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      complex_id    UUID NOT NULL REFERENCES complexes(id) ON DELETE CASCADE,
      floor_number  INTEGER NOT NULL,
      unit_number   VARCHAR(20) NOT NULL,
      child_place_id UUID REFERENCES places(id) ON DELETE SET NULL,
      created_at    TIMESTAMPTZ DEFAULT now(),
      CONSTRAINT complex_unit_unique UNIQUE (complex_id, floor_number, unit_number)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_complex_units_complex ON complex_units(complex_id);
    CREATE INDEX IF NOT EXISTS idx_complex_units_child ON complex_units(child_place_id)
      WHERE child_place_id IS NOT NULL;
  `);

  // 4) إضافة store_owner لقائمة الأدوار المسموحة (تبقى owner للتوافق للخلف)
  await pool.query(`
    DO $$
    BEGIN
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
      ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK (role IN ('admin','user','owner','store_owner'));
    EXCEPTION WHEN others THEN NULL;
    END $$;
  `);

  // 5) نقل بيانات الهاتف من store_details → places.phone_number (مرة واحدة)
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'store_details'
          AND column_name = 'phone'
      ) THEN
        UPDATE places p
        SET phone_number = sd.phone
        FROM store_details sd
        WHERE sd.place_id = p.id
          AND p.phone_number IS NULL
          AND sd.phone IS NOT NULL
          AND sd.phone <> '';
      END IF;
    END $$;
  `);

  console.log('✅ ensureComplexesAndPhoneSchema completed');
}

async function ensurePlaceCategorySchema() {
  await pool.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

  // شجرة تصنيفات الأماكن (main/sub/…)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS place_categories (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name       VARCHAR(150) NOT NULL,
      emoji      VARCHAR(16),
      color      VARCHAR(32),
      sort_order INTEGER NOT NULL DEFAULT 0,
      parent_id  UUID REFERENCES place_categories(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      CONSTRAINT place_categories_unique_name_per_parent UNIQUE (parent_id, name)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_place_categories_parent ON place_categories(parent_id, sort_order);
  `);

  // ربط مكان بتصنيف (main/sub) — مع إبقاء attributes كـ fallback
  await pool.query(`
    CREATE TABLE IF NOT EXISTS place_category_links (
      place_id    UUID PRIMARY KEY REFERENCES places(id) ON DELETE CASCADE,
      main_category_id UUID REFERENCES place_categories(id) ON DELETE SET NULL,
      sub_category_id  UUID REFERENCES place_categories(id) ON DELETE SET NULL,
      created_at  TIMESTAMPTZ DEFAULT now(),
      updated_at  TIMESTAMPTZ DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_place_category_links_main ON place_category_links(main_category_id);
    CREATE INDEX IF NOT EXISTS idx_place_category_links_sub ON place_category_links(sub_category_id);
  `);

  console.log('✅ ensurePlaceCategorySchema completed');
}

async function ensurePlaceCategoryTypeBinding() {
  // ربط كل تصنيف مكان بنوع محدد من place_types
  await pool.query(`
    ALTER TABLE place_categories
      ADD COLUMN IF NOT EXISTS place_type_id UUID REFERENCES place_types(id) ON DELETE CASCADE;
  `);

  // إسناد الصفوف الحالية (إن وُجدت) إلى «متجر تجاري» كنوع افتراضي
  await pool.query(`
    UPDATE place_categories
    SET place_type_id = (SELECT id FROM place_types WHERE name = 'متجر تجاري' LIMIT 1)
    WHERE place_type_id IS NULL;
  `);

  // الآن نضبط NOT NULL
  await pool.query(`
    DO $$
    BEGIN
      ALTER TABLE place_categories ALTER COLUMN place_type_id SET NOT NULL;
    EXCEPTION WHEN others THEN NULL;
    END $$;
  `);

  // استبدال القيد القديم بقيد يشمل place_type_id
  await pool.query(`
    ALTER TABLE place_categories DROP CONSTRAINT IF EXISTS place_categories_unique_name_per_parent;
  `);
  await pool.query(`
    DO $$
    BEGIN
      ALTER TABLE place_categories
        ADD CONSTRAINT place_categories_unique_type_parent_name UNIQUE (place_type_id, parent_id, name);
    EXCEPTION WHEN duplicate_table THEN NULL;
    END $$;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_place_categories_type ON place_categories(place_type_id, sort_order);
  `);

  console.log('✅ ensurePlaceCategoryTypeBinding completed');
}

async function ensureStoreDetailsPhoneLength() {
  // store_details.phone كان VARCHAR(20) بينما places.phone_number VARCHAR(30) —
  // مزامنة syncStoreDetailsFromPlace تفشل برسالة "value too long" → 500.
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'store_details'
          AND column_name = 'phone'
      ) THEN
        ALTER TABLE store_details ALTER COLUMN phone TYPE VARCHAR(30);
      END IF;
    END $$;
  `);
  console.log('✅ ensureStoreDetailsPhoneLength completed');
}

async function ensureStoreDetailsPhoneColumn() {
  // قواعد قديمة: وجود جدول store_details من مخطط سابق بلا عمود phone —
  // CREATE TABLE IF NOT EXISTS لا يضيف أعمدة، فيفشل syncStoreDetailsFromPlace بـ 42703.
  await pool.query(`
    ALTER TABLE store_details ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
  `);
  console.log('✅ ensureStoreDetailsPhoneColumn completed');
}

async function ensurePlaceTypeAttributeValueTypes() {
  await pool.query(`
    ALTER TABLE place_type_attribute_definitions DROP CONSTRAINT IF EXISTS ptad_value_type_check;
  `);
  await pool.query(`
    ALTER TABLE place_type_attribute_definitions ADD CONSTRAINT ptad_value_type_check
      CHECK (value_type IN ('string','number','boolean','json','date','phone'));
  `);
  console.log('✅ ensurePlaceTypeAttributeValueTypes completed');
}

async function enrichPlaceTypesSchemaAndLabels() {
  await pool.query(`
    ALTER TABLE place_types DROP CONSTRAINT IF EXISTS place_types_kind_check;
  `);
  await pool.query(`
    ALTER TABLE place_types
      ADD COLUMN IF NOT EXISTS kind VARCHAR(32) NOT NULL DEFAULT 'other',
      ADD COLUMN IF NOT EXISTS singular_label VARCHAR(150),
      ADD COLUMN IF NOT EXISTS plural_label VARCHAR(150),
      ADD COLUMN IF NOT EXISTS ui_labels JSONB NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS flags JSONB NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS aliases JSONB NOT NULL DEFAULT '[]'::jsonb;
  `);
  await pool.query(`
    DO $$
    BEGIN
      ALTER TABLE place_types ADD CONSTRAINT place_types_kind_check
        CHECK (kind IN ('house','store','residentialComplex','commercialComplex','other'));
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  // Backfill: تسميات وقواعد كانت في الواجهة (placeTypeLabels) — idempotent
  const placeTypeEnrichment = [
    {
      name: 'منزل',
      kind: 'house',
      singular_label: 'منزل',
      plural_label: 'المنازل',
      ui_labels: {
        nameFieldLabel: 'اسم صاحب المنزل',
        photosLabel: 'صور المنزل',
        attrLabels: { house_number: 'رقم المنزل' },
      },
      flags: {
        productCategoryForm: false,
        phoneAsStoreNumber: false,
        disallowComplexUnitChild: false,
        needsCategoryTree: false,
      },
      aliases: [],
    },
    {
      name: 'متجر تجاري',
      kind: 'store',
      singular_label: 'متجر تجاري',
      plural_label: 'المتاجر',
      ui_labels: {
        nameFieldLabel: 'اسم المتجر التجاري',
        mainCategoryLabel: 'التصنيف الرئيسي\u200c للمتجر',
        subCategoryLabel: 'التصنيف الفرعي\u200c للمتجر',
        phoneFieldLabel: 'رقم هاتف المتجر',
        photosLabel: 'صور المتجر',
        attrLabels: {
          store_type: 'التصنيف الرئيسي\u200c للمتجر',
          store_category: 'التصنيف الفرعي\u200c للمتجر',
          store_number: 'رقم هاتف المتجر',
        },
      },
      flags: {
        productCategoryForm: false,
        phoneAsStoreNumber: true,
        disallowComplexUnitChild: false,
        needsCategoryTree: true,
      },
      aliases: ['متجر'],
    },
    {
      name: 'مجمّع تجاري',
      kind: 'commercialComplex',
      singular_label: 'مجمّع تجاري',
      plural_label: 'المجمعات التجارية',
      ui_labels: {
        nameFieldLabel: 'اسم المجمّع التجاري',
        attrLabels: { complex_number: 'رقم المجمع التجاري' },
      },
      flags: {
        productCategoryForm: false,
        phoneAsStoreNumber: false,
        disallowComplexUnitChild: true,
        needsCategoryTree: false,
      },
      aliases: ['مجمع تجاري', 'commercial complex', 'commercialcomplex'],
    },
    {
      name: 'مجمّع سكني',
      kind: 'residentialComplex',
      singular_label: 'مجمّع سكني',
      plural_label: 'المجمعات السكنية',
      ui_labels: {
        nameFieldLabel: 'اسم المجمّع السكني',
        attrLabels: { complex_number: 'رقم المجمع' },
      },
      flags: {
        productCategoryForm: false,
        phoneAsStoreNumber: false,
        disallowComplexUnitChild: true,
        needsCategoryTree: false,
      },
      aliases: ['مجمع سكني', 'residential complex', 'residentialcomplex'],
    },
    {
      name: 'مطعم',
      kind: 'store',
      singular_label: 'مطعم',
      plural_label: 'المطاعم',
      ui_labels: {
        nameFieldLabel: 'اسم المطعم',
        mainCategoryLabel: 'التصنيف الرئيسي للمطعم',
        subCategoryLabel: 'التصنيف الفرعي للمطعم',
        phoneFieldLabel: 'رقم هاتف المطعم',
        photosLabel: 'صور المطعم',
      },
      flags: {
        productCategoryForm: true,
        phoneAsStoreNumber: true,
        disallowComplexUnitChild: false,
        needsCategoryTree: true,
      },
      aliases: ['مطاعم'],
    },
    {
      name: 'مسجد',
      kind: 'other',
      singular_label: 'مسجد',
      plural_label: 'المساجد',
      ui_labels: {
        nameFieldLabel: 'اسم المسجد',
        photosLabel: 'صور المسجد',
        attrLabels: { location_text: 'وصف الموقع' },
      },
      flags: {
        productCategoryForm: false,
        phoneAsStoreNumber: false,
        disallowComplexUnitChild: false,
        needsCategoryTree: false,
      },
      aliases: [],
    },
    {
      name: 'كنيسة',
      kind: 'other',
      singular_label: 'كنيسة',
      plural_label: 'الكنائس',
      ui_labels: {
        nameFieldLabel: 'اسم الكنيسة',
        photosLabel: 'صور الكنيسة',
        attrLabels: { location_text: 'وصف الموقع' },
      },
      flags: {
        productCategoryForm: false,
        phoneAsStoreNumber: false,
        disallowComplexUnitChild: false,
        needsCategoryTree: false,
      },
      aliases: [],
    },
    {
      name: 'موقف سيارات',
      kind: 'other',
      singular_label: 'موقف سيارات',
      plural_label: 'مواقف السيارات',
      ui_labels: {
        nameFieldLabel: 'اسم موقف السيارات',
        photosLabel: 'صور موقف السيارات',
        attrLabels: { location_text: 'وصف الموقع' },
      },
      flags: {
        productCategoryForm: false,
        phoneAsStoreNumber: false,
        disallowComplexUnitChild: false,
        needsCategoryTree: false,
      },
      aliases: ['موقف سيارات بالأجرة', 'parking', 'carpark', 'car park'],
    },
    {
      name: 'مكتب',
      kind: 'store',
      singular_label: 'مكتب',
      plural_label: 'المكاتب',
      ui_labels: {
        nameFieldLabel: 'اسم المكتب',
        mainCategoryLabel: 'التصنيف الرئيسي للمكتب',
        subCategoryLabel: 'التصنيف الفرعي للمكتب',
        phoneFieldLabel: 'رقم هاتف المكتب',
        photosLabel: 'صور المكتب',
      },
      flags: {
        productCategoryForm: true,
        phoneAsStoreNumber: true,
        disallowComplexUnitChild: false,
        needsCategoryTree: true,
      },
      aliases: ['مكاتب'],
    },
    {
      name: 'مستشفى',
      kind: 'store',
      singular_label: 'مستشفى',
      plural_label: 'المستشفيات',
      ui_labels: {
        nameFieldLabel: 'اسم المستشفى',
        mainCategoryLabel: 'التصنيف الرئيسي للمستشفى',
        subCategoryLabel: 'التصنيف الفرعي للمستشفى',
        phoneFieldLabel: 'رقم هاتف المستشفى',
        photosLabel: 'صور المستشفى',
      },
      flags: {
        productCategoryForm: true,
        phoneAsStoreNumber: true,
        disallowComplexUnitChild: false,
        needsCategoryTree: true,
      },
      aliases: ['مستشفيات'],
    },
    {
      name: 'عيادة',
      kind: 'store',
      singular_label: 'عيادة',
      plural_label: 'العيادات',
      ui_labels: {
        nameFieldLabel: 'اسم العيادة',
        mainCategoryLabel: 'التصنيف الرئيسي للعيادة',
        subCategoryLabel: 'التصنيف الفرعي للعيادة',
        phoneFieldLabel: 'رقم هاتف العيادة',
        photosLabel: 'صور العيادة',
      },
      flags: {
        productCategoryForm: true,
        phoneAsStoreNumber: true,
        disallowComplexUnitChild: false,
        needsCategoryTree: true,
      },
      aliases: ['عيادات'],
    },
    {
      name: 'صالون',
      kind: 'store',
      singular_label: 'صالون',
      plural_label: 'الصالونات',
      ui_labels: {
        nameFieldLabel: 'اسم الصالون',
        mainCategoryLabel: 'التصنيف الرئيسي للصالون',
        subCategoryLabel: 'التصنيف الفرعي للصالون',
        phoneFieldLabel: 'رقم هاتف الصالون',
        photosLabel: 'صور الصالون',
      },
      flags: {
        productCategoryForm: true,
        phoneAsStoreNumber: true,
        disallowComplexUnitChild: false,
        needsCategoryTree: true,
      },
      aliases: ['صالونات'],
    },
    {
      name: 'مؤسسة تعليمية',
      kind: 'store',
      singular_label: 'مؤسسة تعليمية',
      plural_label: 'المؤسسات التعليمية',
      ui_labels: {
        nameFieldLabel: 'اسم المؤسسة التعليمية',
        mainCategoryLabel: 'التصنيف الرئيسي للمؤسسة التعليمية',
        subCategoryLabel: 'التصنيف الفرعي للمؤسسة التعليمية',
        phoneFieldLabel: 'رقم هاتف المؤسسة التعليمية',
        photosLabel: 'صور المؤسسة التعليمية',
      },
      flags: {
        productCategoryForm: true,
        phoneAsStoreNumber: true,
        disallowComplexUnitChild: false,
        needsCategoryTree: true,
      },
      aliases: ['تعليمية', 'تعليمي'],
    },
    {
      name: 'مؤسسة حكومية',
      kind: 'other',
      singular_label: 'مؤسسة حكومية',
      plural_label: 'المؤسسات الحكومية',
      ui_labels: {
        nameFieldLabel: 'اسم المؤسسة الحكومية',
        mainCategoryLabel: 'التصنيف الرئيسي للمؤسسة الحكومية',
        subCategoryLabel: 'التصنيف الفرعي للمؤسسة الحكومية',
        phoneFieldLabel: 'رقم هاتف المؤسسة الحكومية',
        photosLabel: 'صور المؤسسة الحكومية',
        locationFieldLabel: 'وصف الموقع',
      },
      flags: {
        productCategoryForm: false,
        phoneAsStoreNumber: true,
        disallowComplexUnitChild: false,
        needsCategoryTree: true,
      },
      aliases: ['حكومية', 'حكومي'],
    },
    {
      name: 'أخرى',
      kind: 'other',
      singular_label: 'أخرى',
      plural_label: 'أخرى',
      ui_labels: {
        nameFieldLabel: 'اسم المكان',
        attrLabels: { location_text: 'وصف الموقع' },
      },
      flags: {
        productCategoryForm: false,
        phoneAsStoreNumber: false,
        disallowComplexUnitChild: false,
        needsCategoryTree: false,
      },
      aliases: ['اخرى'],
    },
  ];

  for (const u of placeTypeEnrichment) {
    const uiMerged = {
      descriptionFieldLabel: 'الوصف',
      mapLocationFieldLabel: 'الموقع على الخريطة',
      phoneFieldFallbackLabel: 'رقم الهاتف',
      ...u.ui_labels,
    };
    await pool.query(
      `UPDATE place_types SET
         kind = $2,
         singular_label = COALESCE(NULLIF(TRIM(singular_label), ''), $3),
         plural_label = COALESCE(NULLIF(TRIM(plural_label), ''), $4),
         ui_labels = $5::jsonb,
         flags = $6::jsonb,
         aliases = $7::jsonb,
         updated_at = now()
       WHERE name = $1`,
      [u.name, u.kind, u.singular_label, u.plural_label, JSON.stringify(uiMerged), JSON.stringify(u.flags), JSON.stringify(u.aliases)]
    );
  }

  await pool.query(`
    UPDATE place_types SET
      ui_labels = COALESCE(ui_labels, '{}'::jsonb) || jsonb_build_object(
        'descriptionFieldLabel', COALESCE(ui_labels->>'descriptionFieldLabel', 'الوصف'),
        'mapLocationFieldLabel', COALESCE(ui_labels->>'mapLocationFieldLabel', 'الموقع على الخريطة'),
        'phoneFieldFallbackLabel', COALESCE(ui_labels->>'phoneFieldFallbackLabel', 'رقم الهاتف')
      ),
      updated_at = now();
  `);

  // أي صفوف لم تُحدَّد أعلاه: املأ التسميات من الاسم إن كانت فارغة
  await pool.query(`
    UPDATE place_types SET
      singular_label = COALESCE(NULLIF(TRIM(singular_label), ''), name),
      plural_label = COALESCE(NULLIF(TRIM(plural_label), ''), name),
      updated_at = now()
    WHERE singular_label IS NULL OR singular_label = '' OR plural_label IS NULL OR plural_label = '';
  `);

  console.log('✅ enrichPlaceTypesSchemaAndLabels completed');
}

async function ensureBaseSchema() {
  const sql = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user'
    CHECK (role IN ('admin','user','owner')),
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS place_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  emoji VARCHAR(64),
  color VARCHAR(32),
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS place_type_attribute_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_type_id UUID NOT NULL REFERENCES place_types(id) ON DELETE CASCADE,
  key VARCHAR(100) NOT NULL,
  label VARCHAR(255) NOT NULL,
  value_type VARCHAR(20) NOT NULL DEFAULT 'string',
  is_required BOOLEAN DEFAULT false,
  options JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT ptad_type_key_unique UNIQUE(place_type_id, key),
      CONSTRAINT ptad_value_type_check CHECK (value_type IN ('string','number','boolean','json','date','phone'))
);

CREATE TABLE IF NOT EXISTS places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type_id UUID REFERENCES place_types(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('active','pending','rejected')),
  attributes JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_places_status ON places(status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS place_locations (
  place_id UUID PRIMARY KEY REFERENCES places(id) ON DELETE CASCADE,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_place_locations_coords ON place_locations(latitude, longitude);

CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  type VARCHAR(10) NOT NULL CHECK (type IN ('image','video')),
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(place_id, user_id)
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, place_id)
);

CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS place_tags (
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (place_id, tag_id)
);

CREATE TABLE IF NOT EXISTS store_details (
  place_id UUID PRIMARY KEY REFERENCES places(id) ON DELETE CASCADE,
  phone VARCHAR(20),
  opening_hours TEXT
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  stock INTEGER NOT NULL DEFAULT -1,
  is_available BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  main_category VARCHAR(100),
  sub_category VARCHAR(100),
  company_name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS store_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  is_available BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','completed','cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  reason VARCHAR(50) NOT NULL,
  details TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','resolved','dismissed')),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100),
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_main_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) UNIQUE NOT NULL,
  emoji VARCHAR(16),
  arrow_color VARCHAR(32),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_sub_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  main_category_id UUID NOT NULL REFERENCES product_main_categories(id) ON DELETE RESTRICT,
  name VARCHAR(150) NOT NULL,
  emoji VARCHAR(16),
  arrow_color VARCHAR(32),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT product_sub_unique UNIQUE (main_category_id, name)
);

CREATE INDEX IF NOT EXISTS idx_product_sub_main ON product_sub_categories(main_category_id, sort_order);
`;

  await pool.query(sql);

  // مخطط قديم (متاجر): store_id — المخطط الحالي place_id. CREATE TABLE IF NOT EXISTS لا يحدّث الأعمدة.
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'media' AND column_name = 'store_id')
         AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'media' AND column_name = 'place_id')
      THEN ALTER TABLE media RENAME COLUMN store_id TO place_id;
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ratings' AND column_name = 'store_id')
         AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ratings' AND column_name = 'place_id')
      THEN ALTER TABLE ratings RENAME COLUMN store_id TO place_id;
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'store_id')
         AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'place_id')
      THEN ALTER TABLE orders RENAME COLUMN store_id TO place_id;
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'store_services' AND column_name = 'store_id')
         AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'store_services' AND column_name = 'place_id')
      THEN ALTER TABLE store_services RENAME COLUMN store_id TO place_id;
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'reports' AND column_name = 'store_id')
         AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'reports' AND column_name = 'place_id')
      THEN ALTER TABLE reports RENAME COLUMN store_id TO place_id;
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'store_id')
         AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'place_id')
      THEN ALTER TABLE products RENAME COLUMN store_id TO place_id;
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'favorites' AND column_name = 'store_id')
         AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'favorites' AND column_name = 'place_id')
      THEN ALTER TABLE favorites RENAME COLUMN store_id TO place_id;
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'store_details' AND column_name = 'store_id')
         AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'store_details' AND column_name = 'place_id')
      THEN ALTER TABLE store_details RENAME COLUMN store_id TO place_id;
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'place_tags' AND column_name = 'store_id')
         AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'place_tags' AND column_name = 'place_id')
      THEN ALTER TABLE place_tags RENAME COLUMN store_id TO place_id;
      END IF;
    END $$;
  `);

  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS id_card_image_url TEXT;
    ALTER TABLE place_types ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 100;
    ALTER TABLE places ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE places ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE ratings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
    ALTER TABLE ratings ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_places_owner ON places(owner_id) WHERE owner_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_media_place ON media(place_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_ratings_place ON ratings(place_id) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_products_place ON products(place_id) WHERE is_available = true;
    CREATE INDEX IF NOT EXISTS idx_store_services_place ON store_services(place_id) WHERE is_available = true;
    CREATE INDEX IF NOT EXISTS idx_orders_place ON orders(place_id, created_at DESC);
  `);

  await pool.query(`
INSERT INTO app_settings (key, value, updated_at) VALUES
  ('maintenance_mode', 'false'::jsonb, now()),
  ('welcome_message', '"مرحباً بكم في خريطة طولكرم"'::jsonb, now())
ON CONFLICT (key) DO NOTHING;
`);

  const { rows: adminRows } = await pool.query(
    "SELECT id FROM users WHERE LOWER(email) = LOWER('admin@tulkarm.com') AND deleted_at IS NULL"
  );
  if (adminRows.length === 0) {
    const hash = await bcrypt.hash('admin123', 10);
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role, is_admin)
       VALUES ($1, $2, $3, 'admin', true)`,
      ['مدير التطبيق', 'admin@tulkarm.com', hash]
    );
    console.log('✅ Admin: admin@tulkarm.com / admin123');
  }

  await pool.query(`
INSERT INTO place_types (name, emoji, color, sort_order) VALUES
  ('منزل', '🏠', '#2E86AB', 1),
  ('متجر تجاري', '🏪', '#16A34A', 2),
  ('مجمّع تجاري', '🏬', '#F59E0B', 3),
  ('مجمّع سكني', '🏘️', '#2563EB', 4),
  ('مطعم', '🍽️', '#EF4444', 5),
  ('مسجد', '🕌', '#10B981', 6),
  ('كنيسة', '⛪', '#8B5CF6', 7),
  ('موقف سيارات', '🅿️', '#F59E0B', 8),
  ('مكتب', '🏢', '#0EA5E9', 9),
  ('مستشفى', '🏥', '#DC2626', 10),
  ('عيادة', '⚕️', '#F97316', 11),
  ('صالون', '💇', '#EC4899', 12),
  ('مؤسسة تعليمية', '🏫', '#3B82F6', 13),
  ('مؤسسة حكومية', '🏛️', '#6B7280', 14),
  ('أخرى', '📍', '#6B7280', 15)
ON CONFLICT (name) DO UPDATE SET
  emoji = EXCLUDED.emoji,
  color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
`);

  console.log('✅ ensureBaseSchema completed');
}

async function applyUnifiedSchema() {
  // --- Core schema ---
  await ensureBaseSchema();

  // --- Legacy-compatible alignments and new capabilities ---
  await ensureComplexesAndPhoneSchema();
  await ensurePlaceCategorySchema();
  await ensurePlaceCategoryTypeBinding();
  await ensureStoreDetailsPhoneLength();
  await ensureStoreDetailsPhoneColumn();
  await ensurePlaceTypeAttributeValueTypes();
  await enrichPlaceTypesSchemaAndLabels();

  console.log('✅ Unified migration completed');
}

async function main() {
  try {
    if (!process.env.DATABASE_URL?.trim()) {
      console.error('DATABASE_URL missing in server/.env');
      process.exit(1);
    }

    await applyUnifiedSchema();
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
