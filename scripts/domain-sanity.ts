/**
 * Domain sanity check — run with:
 *   npx ts-node --project tsconfig.json scripts/domain-sanity.ts
 *
 * Verifies that mapApiToPlace handles all known PlaceData shapes without
 * throwing, produces the correct `kind`, and correctly reads attribute
 * fallback values.
 *
 * No external dependencies; no network calls; no DB access.
 */

import {
  mapApiToPlace,
  mapFormToPayload,
  mapDomainToCreatePlacePayload,
  complexUnitName,
  listComplexUnitNames,
  type Place,
  type CategorizedPlace,
  type HousePlace,
  type ComplexPlace,
} from '../types/place';
import type { PlaceData } from '../api/client';

// ─── Minimal PlaceData factory ────────────────────────────────────────────────

function makePlaceData(overrides: Partial<PlaceData>): PlaceData {
  return {
    id: 'test-id',
    name: 'Test Place',
    description: null,
    type_name: 'أخرى',
    type_id: 'type-uuid',
    latitude: 32.0,
    longitude: 35.0,
    status: 'active',
    avg_rating: '4.5',
    rating_count: 10,
    attributes: [],
    images: [],
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// ─── Assertions ───────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

function section(title: string) {
  console.log(`\n── ${title} ──`);
}

// ─── Test cases ───────────────────────────────────────────────────────────────

section('simple_place (أخرى)');
{
  const p = mapApiToPlace(makePlaceData({ type_name: 'أخرى' }));
  assert('kind = simple', p.kind === 'simple');
  assert('no throw', true);
  assert('images is empty array', Array.isArray(p.images) && p.images.length === 0);
  assert('avgRating parsed', p.avgRating === 4.5);
}

section('simple_place (موقف سيارات)');
{
  const p = mapApiToPlace(makePlaceData({ type_name: 'موقف سيارات' }));
  assert('kind = simple', p.kind === 'simple');
  assert('ratingCount', p.ratingCount === 10);
}

section('categorized_place (متجر تجاري)');
{
  const p = mapApiToPlace(
    makePlaceData({
      type_name: 'متجر تجاري',
      attributes: [
        { key: 'store_type', value: 'مواد غذائية', value_type: 'text' },
        { key: 'store_category', value: 'بقالة', value_type: 'text' },
      ],
    }),
  ) as CategorizedPlace;
  assert('kind = categorized', p.kind === 'categorized');
  assert('mainCategory from store_type', p.mainCategory === 'مواد غذائية');
  assert('subCategory from store_category', p.subCategory === 'بقالة');
  assert('mainCategoryId null (no column)', p.mainCategoryId === null);
}

section('categorized_place — new column ids + attribute fallback');
{
  const p = mapApiToPlace(
    makePlaceData({
      type_name: 'متجر تجاري',
      main_category_id: 'cat-main-uuid',
      sub_category_id: 'cat-sub-uuid',
      attributes: [
        { key: 'main_category', value: 'إلكترونيات', value_type: 'text' },
      ],
    }),
  ) as CategorizedPlace;
  assert('kind = categorized', p.kind === 'categorized');
  assert('mainCategoryId from column', p.mainCategoryId === 'cat-main-uuid');
  assert('subCategoryId from column', p.subCategoryId === 'cat-sub-uuid');
  assert('mainCategory from attribute', p.mainCategory === 'إلكترونيات');
  assert('subCategory null (no attr)', p.subCategory === null);
}

section('house_place (منزل)');
{
  const p = mapApiToPlace(
    makePlaceData({
      type_name: 'منزل',
      attributes: [{ key: 'house_number', value: '3-7', value_type: 'text' }],
    }),
  ) as HousePlace;
  assert('kind = house', p.kind === 'house');
  assert('houseNumber from house_number attr', p.houseNumber === '3-7');
}

section('house_place — unit_number fallback');
{
  const p = mapApiToPlace(
    makePlaceData({
      type_name: 'منزل',
      attributes: [{ key: 'unit_number', value: '2-4', value_type: 'text' }],
    }),
  ) as HousePlace;
  assert('kind = house', p.kind === 'house');
  assert('houseNumber from unit_number attr', p.houseNumber === '2-4');
}

section('complex_place — residential (مجمّع سكني)');
{
  const p = mapApiToPlace(
    makePlaceData({
      type_name: 'مجمّع سكني',
      floors_count: 5,
      units_per_floor: 4,
    }),
  ) as ComplexPlace;
  assert('kind = complex', p.kind === 'complex');
  assert('complexType = residential', p.complexType === 'residential');
  assert('floorsCount = 5', p.floorsCount === 5);
  assert('unitsPerFloor = 4', p.unitsPerFloor === 4);
}

section('complex_place — commercial via complex_kind column');
{
  const p = mapApiToPlace(
    makePlaceData({
      type_name: 'مجمّع تجاري',
      complex_kind: 'commercial',
      floors_count: 3,
      units_per_floor: 10,
    }),
  ) as ComplexPlace;
  assert('kind = complex', p.kind === 'complex');
  assert('complexType = commercial', p.complexType === 'commercial');
}

section('complex_place — attribute fallback for floors/units');
{
  const p = mapApiToPlace(
    makePlaceData({
      type_name: 'مجمّع سكني',
      attributes: [
        { key: 'floors_count', value: '7', value_type: 'number' },
        { key: 'units_per_floor', value: '6', value_type: 'number' },
        { key: 'complex_type', value: 'residential', value_type: 'text' },
      ],
    }),
  ) as ComplexPlace;
  assert('kind = complex', p.kind === 'complex');
  assert('floorsCount from attribute', p.floorsCount === 7);
  assert('unitsPerFloor from attribute', p.unitsPerFloor === 6);
  assert('complexType from attribute', p.complexType === 'residential');
}

section('phone_number — column first, then attr fallback');
{
  const withColumn = mapApiToPlace(
    makePlaceData({ phone_number: '0599000001' }),
  );
  assert('phoneNumber from column', withColumn.phoneNumber === '0599000001');

  const withAttr = mapApiToPlace(
    makePlaceData({
      attributes: [{ key: 'phone', value: '0599000002', value_type: 'text' }],
    }),
  );
  assert('phoneNumber from attr (phone)', withAttr.phoneNumber === '0599000002');

  const withRaqm = mapApiToPlace(
    makePlaceData({
      type_name: 'موقف سيارات',
      attributes: [{ key: 'raqm', value: '0597000003', value_type: 'text' }],
    }),
  );
  assert('phoneNumber from attr (raqm)', withRaqm.phoneNumber === '0597000003');

  const none = mapApiToPlace(makePlaceData({}));
  assert('phoneNumber null when absent', none.phoneNumber === null);
}

section('images mapping');
{
  const p = mapApiToPlace(
    makePlaceData({
      images: [
        { id: 'img-1', image_url: 'https://example.com/a.jpg', sort_order: 0 },
        { id: 'img-2', image_url: 'https://example.com/b.jpg', sort_order: 1 },
      ],
    }),
  );
  assert('images length = 2', p.images.length === 2);
  assert('images[0].url correct', p.images[0].url === 'https://example.com/a.jpg');
  assert('images[0].sortOrder = 0', p.images[0].sortOrder === 0);
}

section('mapFormToPayload');
{
  const payload = mapFormToPayload({
    name: 'متجر الأمل',
    typeId: 'type-uuid',
    latitude: 32.1,
    longitude: 35.2,
    phoneNumber: '0599123456',
    complexKind: undefined,
    floorsCount: undefined,
    unitsPerFloor: undefined,
    mainCategory: 'مواد غذائية',
    subCategory: 'بقالة',
  });
  assert('name trimmed', payload.name === 'متجر الأمل');
  assert('phone_number top-level', payload.phone_number === '0599123456');
  assert('attributes contains phone key', !!payload.attributes?.find((a) => a.key === 'phone'));
  assert('attributes contains main_category', !!payload.attributes?.find((a) => a.key === 'main_category'));
  assert('attributes contains sub_category', !!payload.attributes?.find((a) => a.key === 'sub_category'));
}

section('mapFormToPayload — complex');
{
  const payload = mapFormToPayload({
    name: 'مجمع الرياض',
    typeId: 'complex-type-uuid',
    latitude: 32.0,
    longitude: 35.0,
    complexKind: 'residential',
    floorsCount: 4,
    unitsPerFloor: 8,
  });
  assert('complex_kind top-level', payload.complex_kind === 'residential');
  assert('floors_count top-level', payload.floors_count === 4);
  assert('units_per_floor top-level', payload.units_per_floor === 8);
  assert(
    'complex_type in attributes',
    !!payload.attributes?.find((a) => a.key === 'complex_type' && a.value === 'residential'),
  );
}

section('mapDomainToCreatePlacePayload round-trip');
{
  const original = mapApiToPlace(
    makePlaceData({
      type_name: 'مجمّع سكني',
      complex_kind: 'residential',
      floors_count: 3,
      units_per_floor: 5,
      phone_number: '0599999999',
    }),
  );
  const payload = mapDomainToCreatePlacePayload(original, ['data:image/png;base64,ABC']);
  assert('name preserved', payload.name === 'Test Place');
  assert('complex_kind preserved', payload.complex_kind === 'residential');
  assert('floors_count preserved', payload.floors_count === 3);
  assert('units_per_floor preserved', payload.units_per_floor === 5);
  assert('phone_number preserved', payload.phone_number === '0599999999');
  assert('image_urls set', payload.image_urls?.length === 1);
}

section('complexUnitName');
{
  assert('residential floor 1 unit 1', complexUnitName('residential', 1, 1) === 'بيت 1-1');
  assert('residential floor 2 unit 3', complexUnitName('residential', 2, 3) === 'بيت 2-3');
  assert('commercial floor 1 unit 2', complexUnitName('commercial', 1, 2) === 'وحدة 1-2');
}

section('listComplexUnitNames');
{
  const units = listComplexUnitNames('residential', 2, 3);
  assert('total count = 6', units.length === 6);
  assert('first unit name', units[0].name === 'بيت 1-1');
  assert('last unit name', units[5].name === 'بيت 2-3');
  assert('floor/unit metadata correct', units[3].floor === 2 && units[3].unit === 1);
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n─────────────────────────────────`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('Some checks FAILED — review the output above.');
  process.exit(1);
} else {
  console.log('All checks passed ✓');
}
