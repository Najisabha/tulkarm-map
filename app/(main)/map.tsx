/**
 * شاشة الخريطة الرئيسية: تجميع الخطافات (موقع، فئات، مسار/سفر) ثم طبقة العرض فقط.
 */
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { AddPlaceModal } from '../../components/AddPlaceModal';
import { Circle, MapView, Polyline, PROVIDER_GOOGLE } from '../../components/MapWrapper';
import { ReportModal } from '../../components/ReportModal';
import {
  CategoryPlacesSheet,
  MapCategoryBar,
  MapEnterExitBanner,
  MapLocateButton,
  MapMarkersLayer,
  MapPlaceSearch,
  MapRouteBanner,
  MapSidebar,
  MapTapOptionsSheet,
  MapTopBar,
  mapStyles as styles,
  StoreDetailSheet,
  TravelModeSheet,
  TravelPreviewSheet,
} from '../../components/map';
import { MAP_STYLE_NO_POI } from '../../constants/mapStyle';
import { useCategories } from '../../context/CategoryContext';
import type { UserLocation } from '../../hooks/map/types';
import { useMapCategoryExplorer } from '../../hooks/map/useMapCategoryExplorer';
import { useMapLocation } from '../../hooks/map/useMapLocation';
import { useMapTravelAndRouting } from '../../hooks/map/useMapTravelAndRouting';
import { useAuthPlacesBootstrap } from '../../hooks/useAuthPlacesBootstrap';
import { placeService } from '../../services/placeService';
import { useAuthStore } from '../../stores/useAuthStore';
import { usePlacesStore } from '../../stores/usePlacesStore';
import { isInsideTulkarm, TULKARM_REGION } from '../../utils/geofencing';
import { haversineDistance } from '../../utils/map/geo';
import { isActiveStore } from '../../utils/map/storeStatus';
import {
  submitMapComplexUnit,
  submitMapTapNewPlace,
  type MapAddUnitContext,
} from '../../utils/map/mapPlaceSubmissions';
import { matchesQuery, placeToStore, type Store } from '../../utils/map/storeModel';

export default function MapScreen() {
  const { user, logout, init } = useAuthStore();
  const { categories: categoryList } = useCategories();
  const { places, deletePlace, refresh, loadAll } = usePlacesStore();

  /** أماكن نشطة فقط، بصيغة موحّدة للخريطة */
  const stores = useMemo(
    () => places.map(placeToStore).filter(isActiveStore),
    [places],
  );

  const router = useRouter();
  const mapRef = useRef<MapView>(null);

  /** موقع المستخدم، التقريب، وبانر الدخول/الخروج من طولكرم */
  const location = useMapLocation(mapRef);

  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [placeSearchQuery, setPlaceSearchQuery] = useState('');
  const [tappedCoord, setTappedCoord] = useState<UserLocation | null>(null);
  const [addPlaceCoord, setAddPlaceCoord] = useState<UserLocation | null>(null);
  const [addUnitContext, setAddUnitContext] = useState<MapAddUnitContext | null>(null);

  /** شريط الفئات، ورقة الأماكن حسب الفئة، وشجرة التصنيف من الخادم */
  const category = useMapCategoryExplorer({
    mapRef,
    stores,
    categoryList,
    userLocation: location.userLocation,
  });

  /** مسار المعاينة، وضع التوجيه النشط، وخطوات معالج السفر */
  const travel = useMapTravelAndRouting({
    mapRef,
    selectedStore,
    setSelectedStore,
    userLocation: location.userLocation,
    setUserLocation: location.setUserLocation,
    setInTulkarm: location.setInTulkarm,
    ensureUserLocation: location.ensureUserLocation,
    mapRegionOverride: location.mapRegionOverride,
    setMapRegionOverride: location.setMapRegionOverride,
    setShowSidebar,
    setShowReportModal,
    setSelectedCategory: category.setSelectedCategory,
  });

  /** تهيئة مشتركة: المصادقة + تحميل الأماكن (كمشرف عند توفر الصلاحية) */
  useAuthPlacesBootstrap({ init, loadAll, user });

  const placeSearchQ = placeSearchQuery.trim().toLowerCase();

  /** نتائج البحث عن مكان بالاسم */
  const placeSearchResults = useMemo(
    () =>
      !placeSearchQ
        ? []
        : stores
            .filter((s) => matchesQuery(s, placeSearchQ))
            .sort((a, b) => a.name.localeCompare(b.name, 'ar')),
    [stores, placeSearchQ],
  );

  /**
   * زر «تقريب موقعي» يظهر فقط على الخريطة «النظيفة» (بدون طبقات تغطي الخريطة).
   */
  const showMapLocateButton =
    !selectedStore &&
    !tappedCoord &&
    !addPlaceCoord &&
    !addUnitContext &&
    !category.selectedCategory &&
    !showSidebar &&
    !travel.isRouting &&
    travel.travelStep === 1 &&
    !placeSearchQ;

  const NEAR_STORE_METERS = 2;

  /** نقرة على الخريطة: فتح خيارات إن لم تكن قرب علامة متجر */
  const handleMapPress = useCallback(
    (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
      const { latitude, longitude } = e.nativeEvent.coordinate;
      if (!isInsideTulkarm(latitude, longitude)) return;
      const nearStore = stores.some(
        (s) => haversineDistance(latitude, longitude, s.latitude, s.longitude) < NEAR_STORE_METERS,
      );
      if (!nearStore) setTappedCoord({ latitude, longitude });
    },
    [stores],
  );

  const handleNavigateToArea = () => {
    if (!tappedCoord) return;
    const url = `https://www.google.com/maps?q=${tappedCoord.latitude},${tappedCoord.longitude}`;
    Linking.openURL(url);
    setTappedCoord(null);
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const handleOpenChildPlace = (childPlaceId: string) => {
    const existing = stores.find((s) => s.id === childPlaceId);
    if (existing) {
      setSelectedStore(existing);
      return;
    }
    void (async () => {
      try {
        const p = await placeService.getById(childPlaceId);
        setSelectedStore(placeToStore(p));
      } catch {
        /* يبقى عرض الأب كما هو */
      }
    })();
  };

  const handleAddUnit = (
    unit: { id: string; floor_number: number | string; unit_number: number | string },
    parentStore: Store,
  ) => {
    if (user?.id === 'guest' || !user) {
      Alert.alert('تنبيه', 'يجب تسجيل الدخول لإضافة وحدة');
      return;
    }
    setAddUnitContext({
      complexPlaceId: parentStore.id,
      complexType: parentStore.category === 'مجمّع تجاري' ? 'commercial' : 'residential',
      unitRowId: unit.id,
      floorNumber: Number(unit.floor_number),
      unitNumber: String(unit.unit_number),
      latitude: parentStore.latitude,
      longitude: parentStore.longitude,
    });
  };

  const handleEditStore = () => {
    if (!selectedStore) return;
    const id = selectedStore.id;
    setSelectedStore(null);
    travel.setTravelStep(1);
    travel.setTravelChoice(null);
    travel.setTravelPreviewLoading(false);
    travel.clearRoute();
    router.push({ pathname: '/(main)/admin-stores', params: { editStoreId: id } });
  };

  const handleDeleteStore = async () => {
    if (!selectedStore) return;
    await deletePlace(selectedStore.id);
    setSelectedStore(null);
    travel.setTravelStep(1);
    travel.setTravelChoice(null);
    travel.setTravelPreviewLoading(false);
    travel.clearRoute();
  };

  /** عرض الواجهة: خريطة، طبقات، ثم النوافذ والأوراق حسب الحالة */
  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        customMapStyle={MAP_STYLE_NO_POI}
        onPress={handleMapPress}
        initialRegion={location.mapRegionOverride ?? location.defaultRegion}
        showsUserLocation={location.locationGranted}
        showsMyLocationButton={false}
        showsCompass
      >
        <Circle
          center={{ latitude: TULKARM_REGION.latitude, longitude: TULKARM_REGION.longitude }}
          radius={TULKARM_REGION.radius}
          fillColor="rgba(46, 134, 171, 0.08)"
          strokeColor="rgba(46, 134, 171, 0.4)"
          strokeWidth={2}
        />

        {travel.alternativeRoutes.map((coords, idx) =>
          coords.length >= 2 ? (
            <Polyline
              key={`alt-route-${idx}`}
              coordinates={coords}
              strokeColor="#9E9E9E"
              strokeWidth={3}
            />
          ) : null,
        )}

        {travel.routePath && travel.routePath.length >= 2 && (
          <Polyline coordinates={travel.routePath} strokeColor="#E53935" strokeWidth={4} />
        )}

        <MapMarkersLayer
          stores={stores}
          categoryList={categoryList}
          selectedCategory={category.selectedCategory}
          categoryBrowse={category.categoryBrowse}
          searchQuery={placeSearchQ}
          onSelectStore={setSelectedStore}
        />
      </MapView>

      <MapEnterExitBanner translateY={location.bannerAnim} message={location.bannerMessage} />

      {travel.routeInfo && (travel.travelStep === 3 || travel.isRouting) && (
        <MapRouteBanner
          distance={travel.routeInfo.distance}
          duration={travel.routeInfo.duration}
          onEnd={() => {
            travel.clearRoute();
            if (travel.travelStep === 3) travel.setTravelStep(2);
          }}
        />
      )}

      {!travel.isRouting && travel.travelStep === 1 && (
        <MapTopBar
          inTulkarm={location.inTulkarm}
          isAdmin={!!user?.isAdmin}
          onOpenSidebar={() => setShowSidebar(true)}
          onOpenAdmin={() => router.push('/(main)/admin')}
        />
      )}

      {!addPlaceCoord && !travel.isRouting && travel.travelStep === 1 && (
        <MapPlaceSearch
          query={placeSearchQuery}
          onChangeQuery={setPlaceSearchQuery}
          results={placeSearchResults}
          categoryList={categoryList}
          onSelectStore={(s) => {
            setPlaceSearchQuery('');
            category.setSelectedCategory(null);
            setSelectedStore(s);
          }}
        />
      )}

      {showMapLocateButton ? <MapLocateButton onPress={() => location.zoomToNearbyMe(5)} /> : null}

      {tappedCoord && (
        <MapTapOptionsSheet
          canAddPlace={!!user && user.id !== 'guest'}
          onAddPlace={() => {
            setAddPlaceCoord(tappedCoord);
            setTappedCoord(null);
          }}
          onNavigateToArea={handleNavigateToArea}
          onClose={() => setTappedCoord(null)}
        />
      )}

      {addPlaceCoord && (
        <AddPlaceModal
          visible={!!addPlaceCoord}
          onClose={() => setAddPlaceCoord(null)}
          submitSuccessTitle="تم إرسال الطلب بنجاح"
          submitSuccessMessage="سنراجع طلبك في أقرب وقت ممكن. كل البيانات أصبحت ضمن «طلبات المتاجر» في لوحة الإدارة. إذا وافق المدير: ينتقل المكان إلى «الأماكن» ويظهر على الخريطة للجميع. إذا رُفض الطلب: يُزال فوراً ولن يُنشر."
          onSubmit={(data) => submitMapTapNewPlace(data, refresh)}
          latitude={addPlaceCoord.latitude}
          longitude={addPlaceCoord.longitude}
        />
      )}

      {addUnitContext && (
        <AddPlaceModal
          visible={!!addUnitContext}
          onClose={() => setAddUnitContext(null)}
          submitSuccessTitle="تمت إضافة الوحدة بنجاح"
          submitSuccessMessage="تم إنشاء الوحدة وربطها بالمجمّع."
          complexUnitChildPicker
          complexUnitLabel={`${addUnitContext.floorNumber}-${addUnitContext.unitNumber}`}
          onSubmit={(data) => submitMapComplexUnit(data, addUnitContext, refresh)}
          latitude={addUnitContext.latitude}
          longitude={addUnitContext.longitude}
        />
      )}

      {!addPlaceCoord && !addUnitContext && !travel.isRouting && travel.travelStep === 1 && (
        <MapCategoryBar
          categories={category.categories}
          stores={stores}
          categoryList={categoryList}
          selectedCategory={category.selectedCategory}
          onToggleCategory={(cat) =>
            category.selectedCategory === cat
              ? category.clearCategorySheet()
              : category.handleCategoryPress(cat)
          }
        />
      )}

      {category.selectedCategory && (
        <CategoryPlacesSheet
          selectedCategory={category.selectedCategory}
          subtitle={category.categorySheetSubtitle}
          categoryList={categoryList}
          categoryBrowse={category.categoryBrowse}
          placeCategoryTree={category.placeCategoryTree}
          treeLoading={category.treeLoading}
          categoryStores={category.categoryStores}
          onBack={category.handleCategorySheetBack}
          onClose={category.clearCategorySheet}
          onPickMain={category.onPickMainCategory}
          onPickSub={category.onPickSubCategory}
          onPickStore={(s) => {
            category.clearCategorySheet();
            setSelectedStore(s);
          }}
        />
      )}

      {showSidebar && !travel.isRouting && travel.travelStep === 1 && (
        <MapSidebar
          user={user}
          categories={category.categories}
          stores={stores}
          categoryList={categoryList}
          onClose={() => setShowSidebar(false)}
          onPickCategory={(cat) => {
            setShowSidebar(false);
            category.handleCategoryPress(cat);
          }}
          onOpenAdmin={() => {
            setShowSidebar(false);
            router.push('/(main)/admin');
          }}
          onLogout={handleLogout}
        />
      )}

      {selectedStore && !travel.isRouting && travel.travelStep === 1 && (
        <StoreDetailSheet
          store={selectedStore}
          userLocation={location.userLocation}
          user={user}
          categoryList={categoryList}
          onClose={travel.closeTravelFlow}
          onNavigate={travel.handleOpenTravelModePicker}
          onReport={() => setShowReportModal(true)}
          onEdit={handleEditStore}
          onDelete={handleDeleteStore}
          onOpenChildPlace={handleOpenChildPlace}
          onAddUnit={handleAddUnit}
        />
      )}

      {selectedStore && !travel.isRouting && travel.travelStep === 1 && (
        <ReportModal
          visible={showReportModal}
          storeId={selectedStore.id}
          storeName={selectedStore.name}
          onClose={() => setShowReportModal(false)}
        />
      )}

      {selectedStore && !travel.isRouting && travel.travelStep === 2 && (
        <TravelModeSheet
          storeName={selectedStore.name}
          onPick={(choice) => {
            travel.setTravelChoice(choice);
            travel.setTravelStep(3);
          }}
          onBack={() => travel.setTravelStep(1)}
          onClose={travel.closeTravelFlow}
        />
      )}

      {selectedStore && travel.travelChoice && !travel.isRouting && travel.travelStep === 3 && (
        <TravelPreviewSheet
          storeName={selectedStore.name}
          travelChoice={travel.travelChoice}
          origin={travel.travelPreviewOrigin}
          loading={travel.travelPreviewLoading}
          routeInfo={travel.routeInfo}
          onCancel={() => {
            travel.clearRoute();
            travel.setTravelStep(2);
          }}
          onConfirm={travel.confirmTravel}
          onClose={travel.closeTravelFlow}
        />
      )}
    </View>
  );
}